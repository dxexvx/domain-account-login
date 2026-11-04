import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const extension=path.resolve('.');
const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));
assert.equal(manifest.action.default_popup,'popup.html','아이콘은 옵션 팝업을 열어야 합니다.');
const {mapLogin}=await import('../mapping.js');
const output=process.env.QA_DIR;if(!output)throw Error('QA_DIR required');fs.mkdirSync(output,{recursive:true});
const profile=fs.mkdtempSync(path.join(output,'profile-'));
const html='<!doctype html><title>매핑 fixture</title><form><input id="uId" autocomplete="username"><input id="uPwd" type="password"><button type="submit">로그인</button></form>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;let context;
try{
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 const manager=await context.newPage();await manager.goto('chrome://extensions');
 await manager.evaluate(async({id,origin})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});await chrome.developerPrivate.addHostPermission(id,origin+'/*');},{id,origin});
 const page=await context.newPage();await page.goto(origin+'/login?return=home');
 assert.deepEqual(await page.evaluate(mapLogin,origin),{selectors:{username:'#uId',password:'#uPwd',submit:'button[type="submit"]'},missing:[]});
 assert.equal(await page.locator('#uId').inputValue(),'');
 await page.evaluate(()=>document.querySelector('form').insertAdjacentHTML('beforeend','<button type="submit">로그인</button>'));
 assert((await page.evaluate(mapLogin,origin)).missing.includes('submit'));
 await page.reload();
 // A popup sender may map, but a web page may not invoke this management operation.
 async function pageId(){await page.bringToFront();return worker.evaluate(async()=>(await chrome.tabs.query({active:true,currentWindow:true}))[0].id);}
 await page.bringToFront();const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 // The actual action popup uses its opener tab. A direct popup tab uses the explicit test target through the same trusted message contract.
 const tabId=await pageId();
 await popup.evaluate(origin=>{document.querySelector('#manage').onclick=()=>chrome.permissions.request({origins:[origin+'/*']});},origin);
 await popup.locator('#manage').click();
 assert.equal((await worker.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:()=>chrome.runtime.sendMessage({type:'MAP_LOGIN',tabId:1,url:location.href})}))[0].result,tabId)).ok,false);
 const mapped=await popup.evaluate(({tabId,url})=>chrome.runtime.sendMessage({type:'MAP_LOGIN',tabId,url}),{tabId,url:origin+'/login?return=home'});
 assert.equal(mapped.ok,true);assert.equal(mapped.site.origin,origin);
 await popup.setViewportSize({width:380,height:440});await popup.screenshot({path:path.join(output,'implementation-popup.png')});
 const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);
 await options.getByText(origin,{exact:false}).first().waitFor();
 await options.screenshot({path:path.join(output,'implementation-domain-vault.png')});

 await options.locator('#account-section').waitFor();
 assert.equal(await options.locator('#origin').inputValue(),origin);assert.equal(await options.locator('#login-url').inputValue(),origin+'/login?return=home');
 assert.equal(await options.locator('#selector-username').inputValue(),'#uId');
 await options.reload();await options.locator('#account-section').waitFor();assert.equal(await options.locator('#selector-password').inputValue(),'#uPwd');
 await options.evaluate(async()=>{const sites=(await chrome.runtime.sendMessage({type:'LIST'})).sites;const r=await chrome.runtime.sendMessage({type:'SAVE_ACCOUNT',siteId:sites[0].id,account:{alias:'보존 확인',username:'synthetic-preserved',password:'synthetic-password'}});if(!r.ok)throw Error(r.error);});
 const remapped=await popup.evaluate(({tabId,url})=>chrome.runtime.sendMessage({type:'MAP_LOGIN',tabId,url}),{tabId,url:origin+'/login?return=home'});assert(remapped.ok);await options.reload();await options.getByText('보존 확인',{exact:true}).waitFor();await options.reload();await options.getByText('보존 확인',{exact:true}).waitFor();
 assert.equal((await popup.evaluate(({tabId,url})=>chrome.runtime.sendMessage({type:'MAP_LOGIN',tabId,url}),{tabId,url:origin+'/wrong'})).ok,false);
 await page.evaluate(()=>{document.querySelector('form').insertAdjacentHTML('afterend','<form><input type="password"><button>로그인</button></form>');});
 assert.deepEqual((await page.evaluate(mapLogin,origin)).missing,['username','password','submit']);
 assert.equal(errors.length,0);fs.writeFileSync(path.join(output,'mapping-results.json'),JSON.stringify({status:'passed',checks:9,errors:0},null,2));console.log('PASS DAL-08 popup, mapping ambiguity, draft→vault persistence, sender and URL boundaries');
}finally{await context?.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
