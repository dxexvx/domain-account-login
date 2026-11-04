import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {openBackup} from '../backup.js';
const output=process.env.QA_DIR;if(!output)throw Error('QA_DIR required');fs.mkdirSync(output,{recursive:true});
const extension=path.resolve('.'),contexts=[],profiles=[],errors=[];
const password='synthetic-backup-password';let received,receive;const post=new Promise(resolve=>receive=resolve);
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Type','text/html;charset=utf-8');
 if(req.method==='POST'){let body='';req.on('data',x=>body+=x);req.on('end',()=>{received=Object.fromEntries(new URLSearchParams(body));receive(received);res.end('<p>로그인 요청 수신</p>');});return;}
 res.end('<!doctype html><meta charset="utf-8"><form method="post"><input id="u" name="username"><input id="p" name="password" type="password"><button>로그인</button></form>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,other=`http://localhost:${server.address().port}`;
async function launch(name){
 const profile=fs.mkdtempSync(path.join(output,`profile-${name}-`));profiles.push(profile);
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,acceptDownloads:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});contexts.push(context);
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const manager=await context.newPage();await manager.goto('chrome://extensions');await manager.evaluate(()=>chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true}));
 const grant=async site=>manager.evaluate(({id,site})=>chrome.developerPrivate.addHostPermission(id,site+'/*'),{id,site});
 const page=await context.newPage();await page.goto(`chrome-extension://${id}/options.html`);await page.locator('#workspace').waitFor();
 const ask=m=>page.evaluate(m=>chrome.runtime.sendMessage(m),m);
 const fingerprint=()=>worker.evaluate(async()=>JSON.stringify((await chrome.storage.local.get('vault')).vault));
 return {context,worker,id,manager,grant,page,ask,fingerprint};
}
async function saveSite(owner,site){
 await owner.page.locator('#new-site').click();
 await owner.page.locator('#origin').fill(site.origin);await owner.page.locator('#login-url').fill(site.loginUrl);
 for(const field of ['username','password','submit','logout'])await owner.page.locator('#selector-'+field).fill(site.selectors[field]||'');
 await owner.page.locator('#site-form button.primary').click();await owner.page.getByText('도메인을 저장했습니다. 로그인 요소와 계정을 등록하세요.',{exact:true}).waitFor();
 const found=(await owner.ask({type:'LIST'})).sites.find(s=>s.origin===site.origin);assert(found,'site saved through permission gesture');return {ok:true,id:found.id};
}
async function exportFile(page,scope='all'){
 await page.locator('#backup-scope').selectOption(scope);await page.locator('#export-password').fill(password);await page.locator('#export-confirm').fill(password);
 const event=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await event;const text=fs.readFileSync(await download.path(),'utf8');assert(!text.includes('synthetic-'));assert(!text.includes('deviceKey'));return JSON.parse(text);
}
async function prepare(page,envelope,secret=password){
 await page.locator('#backup-file').setInputFiles({name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});await page.locator('#import-password').fill(secret);await page.locator('#preview-backup').click();
}
try{
 const source=await launch('source');await source.grant(origin);
 const site={origin,loginUrl:origin+'/login',selectors:{username:'#u',password:'#p',submit:'button',logout:'.logout'}};
 const saved=await saveSite(source,site);assert(saved.ok,saved.error);
 const aliases=['관리자','매체사(그로스텔라)','매체사(KIMG)','랩사(플랫브레드) · 긴 별칭 확인'];
 for(const [i,alias] of aliases.entries())assert((await source.ask({type:'SAVE_ACCOUNT',siteId:saved.id,account:{alias,username:'synthetic-role-'+i,password:'synthetic-secret-'+i}})).ok);
 await source.page.reload();await source.page.locator('.account').nth(3).waitFor();
 for(const [name,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await source.page.setViewportSize({width,height});await source.page.screenshot({path:path.join(output,`implementation-settings-${name}.png`)});assert(await source.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await source.page.locator('#backup-tools summary').click();
 for(const [name,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await source.page.setViewportSize({width,height});await source.page.screenshot({path:path.join(output,`backup-${name}.png`),fullPage:true});assert(await source.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const heights=await source.page.locator('#backup-tools button,#backup-tools select,#backup-tools input:not([type=file])').evaluateAll(cs=>cs.filter(c=>c.getBoundingClientRect().height).map(c=>c.getBoundingClientRect().height));assert(heights.every(h=>h===44));
 }
 await source.page.setViewportSize({width:1920,height:1080});
 await source.page.locator('#export-password').fill(password);await source.page.locator('#export-confirm').fill('synthetic-mismatch');await source.page.locator('#export-backup').click();await source.page.getByText('백업 암호 확인이 일치하지 않습니다.',{exact:true}).waitFor();
 await source.grant(other);const second=await saveSite(source,{...site,origin:other,loginUrl:other+'/login'});assert(second.ok);
 assert((await source.ask({type:'SAVE_ACCOUNT',siteId:second.id,account:{alias:'다른 도메인',username:'synthetic-other',password:'synthetic-other-secret'}})).ok);
 const single=await exportFile(source.page,'current');assert.equal((await openBackup(single,password)).length,1);
 const envelope=await exportFile(source.page);assert.equal((await openBackup(envelope,password)).length,2);assert.equal(await source.page.locator('#export-password').inputValue(),'');assert.equal(await source.page.locator('#export-confirm').inputValue(),'');
 fs.writeFileSync(path.join(output,'encrypted-synthetic-backup.json'),JSON.stringify(envelope));
 const target=await launch('target');await target.grant(origin);
 const beforeSite=await saveSite(target,{...site,loginUrl:origin+'/custom-login',selectors:{...site.selectors,logout:'.existing-logout'}});
 for(const account of [{alias:'기존 관리자',username:'synthetic-role-0',password:'synthetic-preserved-password'},{alias:'기존 전용 계정',username:'synthetic-existing',password:'synthetic-existing-password'}])assert((await target.ask({type:'SAVE_ACCOUNT',siteId:beforeSite.id,account})).ok);
 await target.page.reload();await target.page.locator('#backup-tools summary').click();
 const original=await target.fingerprint();
 await prepare(target.page,envelope,'synthetic-wrong-password');await target.page.getByText(/백업 암호가 다르거나 파일이 손상/).waitFor();assert.equal(await target.fingerprint(),original);assert(await target.page.locator('#backup-preview').isHidden());
 const tampered={...envelope,ciphertext:(envelope.ciphertext[0]==='A'?'B':'A')+envelope.ciphertext.slice(1)};await prepare(target.page,tampered);await target.page.getByText(/백업 암호가 다르거나 파일이 손상/).waitFor();assert.equal(await target.fingerprint(),original);
 await target.page.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await target.page.locator('#import-password').fill(password);await target.page.locator('#preview-backup').click();await target.page.getByText('JSON 형식의 계정 백업 파일을 선택하세요.',{exact:true}).waitFor();assert.equal(await target.fingerprint(),original);
 await prepare(target.page,envelope);await target.page.locator('#backup-preview').waitFor();assert.match(await target.page.locator('#backup-summary').innerText(),/새 도메인 1개 · 추가할 계정 4개 · 중복 1개/);assert.equal(await target.fingerprint(),original,'preview must not mutate');
 await target.page.locator('#cancel-backup').click();assert(await target.page.locator('#backup-preview').isHidden());assert.equal(await target.fingerprint(),original);
 const denied=await target.ask({type:'IMPORT_BACKUP',envelope,password});assert.equal(denied.ok,false);assert.match(denied.error,/접근 권한/);assert.equal(await target.fingerprint(),original);
 const popup=await target.context.newPage();await popup.goto(`chrome-extension://${target.id}/popup.html`);
 for(const type of ['EXPORT_BACKUP','PREVIEW_BACKUP','IMPORT_BACKUP'])assert.equal((await popup.evaluate(m=>chrome.runtime.sendMessage(m),{type,envelope,password})).ok,false);
 const web=await target.context.newPage();await web.goto(origin+'/login');const tabId=await target.worker.evaluate(async origin=>(await chrome.tabs.query({url:origin+'/*'}))[0].id,origin);
 const contentDenied=await target.worker.evaluate(async({tabId})=>(await chrome.scripting.executeScript({target:{tabId},func:()=>chrome.runtime.sendMessage({type:'EXPORT_BACKUP',password:'synthetic-backup-password'})}))[0].result,{tabId});assert.equal(contentDenied.ok,false);
 // Preview first, then grant in the owned browser. The final trusted click still exercises permissions.request.
 await prepare(target.page,envelope);await target.page.locator('#backup-preview').waitFor();await target.grant(other);await target.page.bringToFront();await target.page.locator('#import-backup').click();await target.page.getByText('계정 4개와 새 도메인 1개를 가져왔습니다. 중복 1개는 건너뛰었습니다.',{exact:true}).waitFor();
 await target.page.reload();const list=await target.ask({type:'LIST'});assert.equal(list.sites.length,2);const first=list.sites.find(s=>s.origin===origin);assert.equal(first.id,beforeSite.id);assert.equal(first.accounts.length,5);assert.equal(first.loginUrl,origin+'/custom-login');assert.equal(first.selectors.logout,'.existing-logout');assert(first.accounts.every(a=>!('password' in a)));
 const values=await target.page.evaluate(async()=>{const {browserKey}=await import('./vault.js');const {decrypt}=await import('./core.js');return decrypt((await chrome.storage.local.get('vault')).vault,await browserKey());});assert.equal(values.sites[0].accounts.find(a=>a.username==='synthetic-role-0').password,'synthetic-preserved-password');
 const sourceKey=await source.worker.evaluate(async()=>(await chrome.storage.local.get('deviceKey')).deviceKey),targetKey=await target.worker.evaluate(async()=>(await chrome.storage.local.get('deviceKey')).deviceKey);assert.notEqual(sourceKey,targetKey);
 await target.page.locator('#backup-tools summary').click();await prepare(target.page,envelope);await target.page.locator('#backup-preview').waitFor();assert.match(await target.page.locator('#backup-summary').innerText(),/추가할 계정 0개 · 중복 5개/);
 const merged=await target.fingerprint();await target.page.locator('#import-backup').click();await target.page.getByText('계정 0개와 새 도메인 0개를 가져왔습니다. 중복 5개는 건너뛰었습니다.',{exact:true}).waitFor();assert.equal(await target.fingerprint(),merged,'repeat import is a no-op');
 await prepare(target.page,envelope);await target.page.locator('#backup-preview').waitFor();
 for(const [name,width,height] of [['desktop',1920,1080],['mobile',390,844]]){await target.page.setViewportSize({width,height});await target.page.screenshot({path:path.join(output,`preview-${name}.png`),fullPage:true});assert(await target.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await web.reload();await web.locator('#domain-account-login').getByRole('button',{name:aliases[1],exact:true}).click();await Promise.race([post,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('imported login POST missing')),10000);t.unref();})]);
 assert.deepEqual(received,{username:'synthetic-role-1',password:'synthetic-secret-1'});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'passed',checks:12,downloadEncrypted:true,currentAndAllScope:true,separateProfileKeys:true,previewReadOnly:true,wrongPasswordAndTamperAtomic:true,cancelAtomic:true,permissionBoundary:true,untrustedSendersRejected:true,mergePreservesExisting:true,replayNoOp:true,realImportedLoginPost:true,responsive44px:true,consoleErrors:0},null,2));
 console.log('PASS DAL-13: 12 backup groups, cross-profile file roundtrip, safe merge, rejection boundaries, imported login POST and responsive controls');
}finally{for(const c of contexts)await c.close();await new Promise(r=>server.close(r));for(const p of profiles)fs.rmSync(p,{recursive:true,force:true});}
