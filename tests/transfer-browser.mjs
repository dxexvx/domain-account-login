import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {sealTransfer} from '../transfer.js';
const output=process.env.QA_DIR;if(!output)throw Error('QA_DIR required');fs.mkdirSync(output,{recursive:true});
const extension=path.resolve('.'),profile=fs.mkdtempSync(path.join(output,'profile-'));
let receive;const received=new Promise(resolve=>receive=resolve);
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html;charset=utf-8');
 if(req.method==='POST'&&req.url==='/session'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{receive(Object.fromEntries(new URLSearchParams(body)));res.end('<!doctype html><p>로그인 요청 수신</p>');});return;}
 res.end('<!doctype html><form method="post" action="/session"><input id="uId" name="username"><input id="uPwd" name="password" type="password"><button>로그인</button></form>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let context;
try{
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},acceptDownloads:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const manager=await context.newPage();await manager.goto('chrome://extensions');await manager.evaluate(async({id,origin})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});await chrome.developerPrivate.addHostPermission(id,origin+'/*');},{id,origin});
 const page=await context.newPage();await page.goto(`chrome-extension://${id}/options.html`);
 const ask=m=>page.evaluate(m=>chrome.runtime.sendMessage(m),m);
 await page.locator('#workspace').waitFor();
 await page.locator('#origin').fill(origin);await page.locator('#login-url').fill(origin+'/login');await page.locator('#selector-username').fill('#uId');await page.locator('#selector-password').fill('#uPwd');await page.locator('#selector-submit').fill('button');await page.locator('#site-form button.primary').click();await page.locator('#account-section').waitFor();
 const saved={id:(await ask({type:'LIST'})).sites[0].id};await page.reload();await page.locator('#account-section').waitFor();
 await page.locator('#account-import summary').click();
 const downloadEvent=page.waitForEvent('download');await page.locator('#begin-import').click();const download=await downloadEvent;const request=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(request.origin,origin);assert(!request.publicKey.d);
 const accounts=['관리자','매체사(그로스텔라)','매체사(KIMG)','랩사(플랫브레드)'].map((alias,i)=>({alias,username:'synthetic-role-'+i,password:'synthetic-secret-'+i}));
 const envelope=await sealTransfer(request,accounts),file=path.join(output,'synthetic-transfer.json');fs.writeFileSync(file,JSON.stringify(envelope),{mode:0o600});
 await page.locator('#import-file').setInputFiles(file);await page.getByText('4개 계정을 가져왔습니다.',{exact:true}).waitFor();await page.reload();await page.locator('.account').last().waitFor();assert.equal(await page.locator('.account').count(),4);
 const list=await ask({type:'LIST'});assert.equal(list.sites[0].accounts.length,4);assert(list.sites[0].accounts.every(a=>!('password' in a)));
 assert.equal((await ask({type:'IMPORT_ACCOUNTS',siteId:saved.id,envelope})).ok,false,'consumed request rejected');
 const duplicate=await ask({type:'BEGIN_IMPORT',siteId:saved.id});assert.equal((await ask({type:'IMPORT_ACCOUNTS',siteId:saved.id,envelope:await sealTransfer(duplicate.request,accounts)})).ok,false);assert.equal((await ask({type:'LIST'})).sites[0].accounts.length,4,'all-or-nothing duplicate rejection');
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);assert.equal((await popup.evaluate(siteId=>chrome.runtime.sendMessage({type:'BEGIN_IMPORT',siteId}),saved.id)).ok,false);
 const web=await context.newPage();await web.goto(origin+'/login');const tabId=await worker.evaluate(async origin=>(await chrome.tabs.query({url:origin+'/*'}))[0].id,origin);
 assert.equal((await worker.evaluate(async({tabId,siteId})=>(await chrome.scripting.executeScript({target:{tabId},func:siteId=>chrome.runtime.sendMessage({type:'BEGIN_IMPORT',siteId}),args:[siteId]}))[0].result,{tabId,siteId:saved.id})).ok,false);
 await web.locator('#domain-account-login').waitFor();
 // A stored imported account must actually reach the configured form through the normal trusted login path.
 await web.locator('#domain-account-login').getByRole('button',{name:accounts[1].alias,exact:true}).click();
 assert.deepEqual(await Promise.race([received,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('imported form request missing')),10000);timer.unref();})]),{username:accounts[1].username,password:accounts[1].password});
 await page.bringToFront();await page.locator('#account-import summary').click();
 await page.screenshot({path:path.join(output,'import-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'import-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const pending=await ask({type:'BEGIN_IMPORT',siteId:saved.id});await ask({type:'BEGIN_IMPORT',siteId:saved.id});assert.equal((await ask({type:'IMPORT_ACCOUNTS',siteId:saved.id,envelope:await sealTransfer(pending.request,[{alias:'추가',username:'extra',password:'synthetic-extra'}])})).ok,false);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'passed',checks:8,imported:4,replayRejected:true,duplicateAtomic:true,untrustedSenderRejected:true,replacementRevokes:true,formSubmission:true,responsive:true}));console.log('PASS DAL-09: 4-account file import, readback, replay/duplicate/sender/replacement boundaries, form submission and responsive UI');
}finally{await context?.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
