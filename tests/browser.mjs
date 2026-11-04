import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const stage=process.env.QA_STAGE||'implementation';
const output=process.env.QA_DIR;if(!output)throw Error('Set QA_DIR to a verified external evidence run.');
const extension=path.resolve('.');
fs.mkdirSync(output,{recursive:true});const profile=fs.mkdtempSync(path.join(output,'profile-'));
let received=[];const errors=[];
const fixture=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로컬 로그인 검증</title><style>body{font:16px/1.5 system-ui;background:#f3f6f6;color:#233b42;margin:0;padding:60px 24px 250px}main{max-width:420px;margin:auto;background:white;padding:28px;border:1px solid #c9d6d9;border-radius:8px}h1{font-size:25px;font-weight:500}label{display:block;margin:18px 0}input{box-sizing:border-box;display:block;width:100%;padding:12px;font:inherit}button{padding:12px 22px;font:inherit;background:#174b4c;color:white;border:0;border-radius:4px}p{color:#52646b}</style><main><h1>테스트 서비스 로그인</h1><p>확장 동작 확인용 로컬 페이지</p><form><label>로그인 아이디<input id="login-id" autocomplete="username"></label><label>비밀번호<input id="login-password" type="password" autocomplete="current-password"></label><button id="login-submit" type="submit">로그인</button></form><p id="result" role="status"></p></main><script>window.count=0;window.inputEvents=0;document.querySelector('form').addEventListener('input',()=>window.inputEvents++);document.querySelector('form').onsubmit=async e=>{e.preventDefault();window.count++;const r=await fetch('/login',{method:'POST',body:JSON.stringify({username:document.querySelector('#login-id').value,password:document.querySelector('#login-password').value})});document.querySelector('#result').textContent=await r.text();};</script></html>`;
const server=http.createServer((req,res)=>{if(req.url==='/login'){let body='';req.on('data',d=>body+=d);req.on('end',()=>{received.push(JSON.parse(body));res.setHeader('Set-Cookie','fixture-session='+JSON.parse(body).username+'; Path=/; SameSite=Lax');res.end('로그인 요청 확인');});}else{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let context;
const cases=[];
const record=name=>{cases.push({name,status:'passed'});console.log(`PASS ${name}`);};
try {
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 context.setDefaultTimeout(10000);context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const origin=`http://127.0.0.1:${server.address().port}`;
 const manager=await context.newPage();await manager.goto('chrome://extensions');
 await manager.evaluate(async()=>chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true}));
 // Native Chrome permission setup, not a mocked extension API.
 await manager.evaluate(async({id,origin})=>{
   await chrome.developerPrivate.addHostPermission(id,origin+'/*');
 },{id,origin});
 let options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);
 await options.locator('#workspace').waitFor({state:'visible'});
 await options.locator('#origin').fill(origin);await options.locator('#login-url').fill(origin+'/login-page');
 await options.locator('#site-form button.primary').click();await options.locator('#account-section').waitFor({state:'visible'});
 const siteId=await options.locator('#site-id').inputValue();assert(siteId);
 assert.equal(await options.locator('#master').count(),0);record('DAL-01 브라우저 보관함 자동 준비·도메인 저장');
 const page=await context.newPage();await page.goto(origin+'/login-page');
 // Select actual page elements; the intercepted submit click must not authenticate.
 for(const [field,selector] of [['username','#login-id'],['password','#login-password'],['submit','#login-submit']]) {
   await options.bringToFront();await options.locator('#login-settings').evaluate(el=>el.open=true);await options.locator(`[data-pick=${field}]`).click();
   try{await page.locator('#domain-account-login .pick').waitFor();}catch(e){console.log('picker failure',field,await options.locator('#notice').textContent(),await page.locator('#domain-account-login').count());throw e;}await page.locator(selector).click();
   await options.bringToFront();await options.reload();await options.locator('#account-section').waitFor({state:'visible'});
   await options.waitForFunction(({field,selector})=>document.querySelector('#selector-'+field).value===selector,{field,selector});
 }
 assert.equal(await page.evaluate(()=>window.count),0);record('DAL-03 화면에서 세 요소 지정·저장 readback·선택 클릭 제출 방지');
 for(const [alias,user,password] of [['관리자','fixture-admin','synthetic-admin-password'],['운영 담당자 · 긴 별칭과 공백 표시 확인','fixture-operator','synthetic-operator-password']]) {
   await options.locator('#alias').fill(alias);await options.locator('#username').fill(user);await options.locator('#password').fill(password);await options.locator('#account-form button.primary').click();await options.getByText(alias,{exact:true}).waitFor();
 }
 await options.reload();await options.getByText('관리자',{exact:true}).waitFor();
 const storage=await worker.evaluate(()=>chrome.storage.local.get(null));assert(!JSON.stringify(storage).includes('fixture-admin'));assert(!JSON.stringify(storage).includes('synthetic-admin-password'));
 await options.evaluate(()=>scrollTo(0,0));
 if(stage==='implementation')assert.equal(await options.evaluate(()=>getComputedStyle(document.body).fontSize),'15px');
 console.log('settings typography',await options.evaluate(()=>({body:getComputedStyle(document.body).fontSize,root:getComputedStyle(document.documentElement).fontSize})));
 await options.screenshot({path:path.join(output,`${stage}-settings-desktop.png`)});
 for(const [name,width,height] of [['tablet',768,1024],['mobile',390,844]]){await options.setViewportSize({width,height});assert(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await options.evaluate(()=>scrollTo(0,0));await options.screenshot({path:path.join(output,`${stage}-settings-${name}.png`)});}
 await options.setViewportSize({width:1920,height:1080});record('DAL-02 계정 등록·재열기·암호문 저장');
 // Edit without revealing the stored password; an empty password retains it.
 await options.locator('.account').filter({hasText:'관리자'}).getByRole('button',{name:'수정',exact:true}).click();assert.equal(await options.locator('#password').inputValue(),'');
 await options.locator('#alias').fill('관리자 수정');await options.locator('#account-form button.primary').click();await options.getByText('관리자 수정',{exact:true}).waitFor();
 await page.bringToFront();await page.reload();
 const bar=page.locator('#domain-account-login');await bar.getByRole('button',{name:'관리자 수정',exact:true}).waitFor();
 await page.screenshot({path:path.join(output,`${stage}-login-desktop.png`)});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,`${stage}-login-mobile.png`)});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1920,height:1080});
 assert.equal(await bar.getByRole('combobox').count(),0);record('DAL-06 현재 탭 로그인 기본값·세션 선택 제거');
 await bar.getByRole('button',{name:'관리자 수정',exact:true}).click();await page.getByText('로그인 요청 확인',{exact:true}).waitFor();assert.deepEqual(received.at(-1),{username:'fixture-admin',password:'synthetic-admin-password'});assert.equal(await page.evaluate(()=>window.inputEvents),2);record('DAL-04 input/change·실제 클릭·로컬 서버 요청값 확인');
 // Host text and credential boundaries.
 const other=await context.newPage();await other.goto(`http://localhost:${server.address().port}/`);assert.equal(await other.locator('#domain-account-login').count(),0);record('DAL-05 비허용 hostname에서 바 없음');
 // Content-script source cannot read the trusted local ciphertext/key APIs.
 const isolated=await worker.evaluate(async tabId=>{return (await chrome.scripting.executeScript({target:{tabId},func:async()=>{try {await chrome.storage.local.get(null);return false;}catch{return true;}}}))[0].result;},(await worker.evaluate(async()=>{const t=await chrome.tabs.query({});return t.find(x=>x.url?.includes('/login-page')).id;})));assert.equal(isolated,true);record('DAL-05 content script 저장소 접근 차단');
 // Duplicate visible selectors refuse to fill/submit.
 await page.evaluate(()=>{const clone=document.querySelector('#login-submit').cloneNode(true);document.querySelector('form').append(clone);});
 await bar.getByRole('button',{name:'관리자 수정',exact:true}).click();await bar.getByRole('status').filter({hasText:'여러 개'}).waitFor();assert.equal(received.length,1);
 await page.evaluate(()=>document.querySelectorAll('#login-submit')[1].remove());record('DAL-05 중복 로그인 요소 제출 거부');
 // Allowed domains retain their widget even when SPA login elements disappear.
 await page.locator('#login-submit').evaluate(el=>el.hidden=true);await page.waitForTimeout(200);assert(await bar.isVisible());await page.locator('#login-submit').evaluate(el=>el.hidden=false);
 await page.locator('#login-password').evaluate(el=>el.style.display='none');await page.waitForTimeout(200);assert(await bar.isVisible());await page.locator('#login-password').evaluate(el=>el.style.display='');record('DAL-10 SPA 업무 화면에도 플로팅 유지');
 await options.bringToFront();options.once('dialog',d=>d.accept());await options.locator('.account').filter({hasText:'운영 담당자'}).getByRole('button',{name:'삭제',exact:true}).click();await options.waitForFunction(()=>document.querySelectorAll('.account').length===1);await options.reload();await options.waitForFunction(()=>document.querySelectorAll('.account').length===1);record('DAL-02 계정 수정·비밀번호 유지·삭제 readback');
 // DAL-12: browser-owned encryption survives extension/browser restart without a master prompt.
 await worker.evaluate(()=>chrome.storage.session.set({unlock:{key:'expired-unused-fixture',expires:1}}));
 await options.reload();await options.locator('.account').waitFor();assert.equal(await options.locator('#master').count(),0);
 await context.close();
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);await options.locator('.account').waitFor();assert.equal(await options.locator('.account').count(),1);assert.equal(await options.locator('#master').count(),0);
 const resumed=await context.newPage();await resumed.goto(origin+'/login-page');await resumed.getByRole('button',{name:'관리자 수정',exact:true}).waitFor();await resumed.getByRole('button',{name:'관리자 수정',exact:true}).click();await resumed.getByText('로그인 요청 확인',{exact:true}).waitFor();assert.equal(received.length,2);record('DAL-12 마스터·만료 잠금 없음·브라우저 재시작 후 계정 유지와 실제 로그인');
 assert.deepEqual(errors,[]);record('페이지 JS 오류 없음');
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({runtime:await context.browser().version(),cases,errors,cleanup:'owned context/server/profile removed in finally'},null,2));
} finally {await context?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
