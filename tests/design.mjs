import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const output=process.env.QA_DIR,stage=process.env.QA_STAGE||'implementation';if(!output)throw Error('QA_DIR required');
fs.mkdirSync(output,{recursive:true});const profile=fs.mkdtempSync(path.join(output,'profile-'));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>합성 로그인</title><style>body{font:16px system-ui;padding:60px}input,button{font:inherit;padding:10px}</style><h1>합성 로그인 화면</h1><form><label>아이디<input id="user"></label><label>비밀번호<input id="pass" type="password"></label><button id="submit">로그인</button></form>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));let context;
try{
 const ext=path.resolve('.');context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host,origin=`http://127.0.0.1:${server.address().port}`;
 const management=await context.newPage();await management.goto('chrome://extensions');await management.evaluate(async({id,origin})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});await chrome.developerPrivate.addHostPermission(id,origin+'/*');},{id,origin});
 const page=await context.newPage();await page.goto(`chrome-extension://${id}/options.html`);
 await page.screenshot({path:path.join(output,`${stage}-vault-desktop.png`)});
 await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('#origin').fill(origin);await page.locator('#login-url').fill(origin+'/login');await page.locator('#site-form button.primary').click();await page.locator('#account-section').waitFor();
 await page.evaluate(async origin=>{const ask=async m=>{const r=await chrome.runtime.sendMessage(m);if(!r.ok)throw Error(r.error);return r;};const {id}=await ask({type:'SAVE_SITE',site:{id:document.querySelector('#site-id').value,origin,loginUrl:origin+'/login',selectors:{username:'#user',password:'#pass',submit:'#submit'}}});for(const [i,alias] of ['관리자','매체사(그로스텔라)','매체사(KIMG)','랩사(플랫브레드) · 긴 별칭 확인'].entries())await ask({type:'SAVE_ACCOUNT',siteId:id,account:{alias,username:`synthetic-role-${i}`,password:'synthetic-only-password'}});},origin);
 await page.reload();await page.locator('.account').nth(3).waitFor();
 for(const [name,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
 await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`${stage}-settings-${name}.png`)});
 }
 await page.setViewportSize({width:1920,height:1080});
 const login=await context.newPage();await login.goto(origin+'/login');await login.locator('#domain-account-login').getByRole('button',{name:/관리자/}).waitFor();
 for(const [name,width,height] of [['desktop',1920,1080],['mobile',390,844]]){await login.setViewportSize({width,height});await login.screenshot({animations:'disabled',path:path.join(output,`${stage}-toolbar-${name}.png`)});if(stage==='implementation'){const heights=await login.locator('#domain-account-login').locator('button,select').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height));assert(heights.every(h=>Math.round(h)===44));}assert(await login.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 if(stage==='implementation'){
 // Candidate B has the same controls and content, with domains across the top.
 const style=await page.addStyleTag({content:'.columns{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line)}#sites{display:flex;flex-wrap:wrap}aside .help{display:none}.account-layout{grid-template-columns:minmax(0,1fr) 320px}'});await page.screenshot({path:path.join(output,'candidate-b-top-navigation.png')});await style.evaluate(s=>s.remove());
 await page.screenshot({path:path.join(output,'candidate-a-domain-sidebar.png')});
 const group=await page.locator('.account .actions button').evaluateAll(bs=>bs.map(b=>({height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width})));assert(group.every(x=>x.height===44&&x.width===44));
 await page.locator('.account').first().getByRole('button',{name:'수정',exact:true}).click();await page.locator('#alias').fill('관리자 수정 확인');await page.locator('#account-form button.primary').click();await page.reload();await page.getByText('관리자 수정 확인',{exact:true}).waitFor();await page.locator('.account').filter({hasText:'관리자 수정 확인'}).getByRole('button',{name:'수정',exact:true}).click();await page.locator('#alias').fill('관리자');await page.locator('#account-form button.primary').click();await page.getByText('관리자',{exact:true}).waitFor();
 await page.locator('#new-site').click();await page.locator('#origin').fill(origin);await page.locator('#login-url').fill('https://different.example/login');await page.locator('#site-form button.primary').click();await page.locator('#notice.error').waitFor();await page.screenshot({path:path.join(output,'implementation-domain-error.png')});
 await page.locator('#new-site').click();assert(await page.locator('#login-settings').evaluate(x=>x.open));await page.screenshot({path:path.join(output,'implementation-domain-empty.png')});
 }
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await popup.setViewportSize({width:380,height:430});await popup.screenshot({path:path.join(output,`${stage}-popup.png`)});
 const geometry=await popup.evaluate(()=>({html:document.documentElement.getBoundingClientRect().width,body:document.body.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth}));
 await popup.setViewportSize({width:240,height:430});const narrow=await popup.evaluate(()=>({html:document.documentElement.getBoundingClientRect().width,body:document.body.getBoundingClientRect().width}));if(stage==='implementation'){assert.deepEqual(narrow,{html:380,body:380});assert.deepEqual(geometry,{html:380,body:380,scroll:380});const controls=await popup.locator('button').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height));assert(controls.every(x=>x===44));}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,stage+'-design-results.json'),JSON.stringify({stage,geometry,errors,runtime:context.browser().version(),fixture:'four synthetic accounts, light theme, DPR1',cleanup:'owned profile/context/server removed'},null,2));console.log(stage,'design captures passed',geometry);
}finally{await context?.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
