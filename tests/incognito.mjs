import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

// DAL-17: exercise Chrome's real permission, isolated cookie jar and shared vault.
const output=process.env.QA_DIR;
if(!output)throw Error('Set QA_DIR to a verified external evidence run.');
const profile=fs.mkdtempSync(path.join(output,'incognito-profile-'));
const received=[],cases=[];
const record=name=>{cases.push({name,status:'passed'});console.log('PASS '+name);};
const server=http.createServer((req,res)=>{
  if(req.url==='/session'){
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      received.push(JSON.parse(body));res.setHeader('Set-Cookie','session=private-user; Path=/; SameSite=Lax');res.end('signed-in');
    });return;
  }
  res.setHeader('Content-Type','text/html;charset=utf-8');
  res.end(`<!doctype html><meta charset="utf-8"><title>DAL-17 local fixture</title><form><input id="user" autocomplete="username"><input id="pass" type="password"><button id="submit">로그인</button></form><output></output><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();document.querySelector('output').textContent=await(await fetch('/session',{method:'POST',body:JSON.stringify({username:document.querySelector('#user').value,password:document.querySelector('#pass').value})})).text();};</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let context;
try{
  const extension=path.resolve('.'),origin=`http://127.0.0.1:${server.address().port}`;
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  context.setDefaultTimeout(10000);
  let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host,manager=await context.newPage();
  await manager.goto('chrome://extensions');
  await manager.evaluate(async({id,origin})=>{
    await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});
    await chrome.developerPrivate.addHostPermission(id,origin+'/*');
  },{id,origin});
  assert.equal(await worker.evaluate(()=>chrome.extension.isAllowedIncognitoAccess()),false);
  record('시크릿 접근은 기본 거부');
  const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);
  await options.locator('#workspace').waitFor();
  await options.locator('#origin').fill(origin);await options.locator('#login-url').fill(origin+'/login');
  for(const [field,selector]of [['username','#user'],['password','#pass'],['submit','#submit']])await options.locator('#selector-'+field).fill(selector);
  await options.locator('#site-form button.primary').click();await options.locator('#account-section').waitFor();
  await options.locator('#alias').fill('시크릿 검증');await options.locator('#username').fill('private-fixture');await options.locator('#password').fill('synthetic-only-password');
  await options.locator('#account-form button.primary').click();await options.getByText('시크릿 검증',{exact:true}).waitFor();
  const regular=await context.newPage();await regular.goto(origin+'/login');
  await regular.evaluate(()=>document.cookie='session=regular-user; Path=/; SameSite=Lax');
  await regular.getByRole('button',{name:'시크릿 검증',exact:true}).waitFor();
  // This is a disposable test-owned profile; never edit a user's profile files.
  const restarted=context.waitForEvent('serviceworker');
  await manager.evaluate(async id=>chrome.developerPrivate.updateExtensionConfiguration({extensionId:id,incognitoAccess:true}),id);
  worker=await restarted;
  assert.equal(await worker.evaluate(()=>chrome.extension.isAllowedIncognitoAccess()),true);
  record('Chrome 실제 시크릿 허용 전환 적용');
  await worker.evaluate(async url=>chrome.windows.create({url,incognito:true}),origin+'/login');
  let privatePage;
  for(let i=0;i<100&&!privatePage;i++){
    privatePage=context.pages().find(p=>p!==regular&&p.url()===origin+'/login');
    if(!privatePage)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(privatePage,'Chrome incognito page must be observable');
  assert.equal(await privatePage.evaluate(()=>document.cookie),'');
  await privatePage.getByRole('button',{name:'시크릿 검증',exact:true}).click();
  await privatePage.locator('output').filter({hasText:'signed-in'}).waitFor();
  assert.deepEqual(received,[{username:'private-fixture',password:'synthetic-only-password'}]);
  assert.equal(await privatePage.evaluate(()=>document.cookie),'session=private-user');
  assert.equal(await regular.evaluate(()=>document.cookie),'session=regular-user');
  assert.equal(privatePage.url(),origin+'/login');
  record('공유 보관함 계정으로 시크릿 현재 탭 로그인·일반 세션 유지');
  await privatePage.screenshot({path:path.join(output,'incognito-login.png')});
  fs.writeFileSync(path.join(output,'incognito-results.json'),JSON.stringify({runtime:context.browser().version(),cases,cleanup:'owned browser/server/profile removed in finally'},null,2));
}finally{
  await context?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
}
