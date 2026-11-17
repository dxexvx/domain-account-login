// DAL-19 / idea 61567: actual MV3, two localhost ports, same-port POST and return.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const output=process.env.QA_DIR;if(!output)throw Error('Set QA_DIR to a verified external evidence run.');
const stage=process.env.QA_STAGE||'implementation',profile=fs.mkdtempSync(path.join(output,'localhost-profile-'));
const received=[],errors=[],cases=[],servers=[],remoteRequests=[];
const record=name=>{cases.push({name,status:'passed'});console.log('PASS '+name);};
const fixture=login=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>localhost 공유 검증</title><style>body{font:16px/1.5 system-ui;margin:40px;color:#26313d}main{max-width:420px;margin:auto}label{display:block;margin:16px 0}input,button{font:inherit;padding:12px}input{display:block}h1{font-weight:400}</style><main><h1>${login?'로컬 테스트 로그인':'로컬 업무 화면'}</h1>${login?'<form><label>아이디<input id="user" autocomplete="username"></label><label>비밀번호<input id="pass" type="password"></label><button id="submit">로그인</button></form>':'<p>합성 계정으로 확장 동작을 확인합니다.</p><button id="logout">로그아웃</button>'}</main><script>document.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();await fetch('/session',{method:'POST',body:JSON.stringify({username:document.querySelector('#user').value,password:document.querySelector('#pass').value})});location.href='/home';});document.querySelector('#logout')?.addEventListener('click',async()=>{await fetch('/logout',{method:'POST'});location.href='/login-page';});</script></html>`;
let context;
try{
 for(let index=0;index<2;index++){
  const server=http.createServer((req,res)=>{
   if(req.url==='/session'){let body='';req.on('data',d=>body+=d);req.on('end',()=>{received.push({index,...JSON.parse(body)});res.end('ok');});}
   else if(req.url==='/logout')res.end('ok');
   else{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture(new URL(req.url,'http://fixture').pathname==='/login-page'));}
  });servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 }
 const origins=servers.map(s=>'http://localhost:'+s.address().port),sourceOrigin='https://baropro.vrixon.com';
 const extension=path.resolve('.');
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 context.setDefaultTimeout(10000);context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route(sourceOrigin+'/**',r=>{remoteRequests.push(r.request().url());return r.abort();});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const manager=await context.newPage();await manager.goto('chrome://extensions');
 const grant=patterns=>manager.evaluate(async({id,patterns})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});for(const p of patterns)await chrome.developerPrivate.addHostPermission(id,p);},{id,patterns});
 await grant([sourceOrigin+'/*','http://localhost/*','https://localhost/*']);
 const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);await options.locator('#workspace').waitFor({state:'visible'});
 const send=m=>options.evaluate(m=>chrome.runtime.sendMessage(m),m);
 await options.locator('#origin').fill(sourceOrigin);await options.locator('#login-url').fill(sourceOrigin+'/login-page');
 for(const [f,v] of [['username','#user'],['password','#pass'],['submit','#submit']])await options.locator('#selector-'+f).fill(v);
 await options.locator('#site-form button.primary').click();await options.locator('#account-section').waitFor({state:'visible'});
 const sourceId=await options.locator('#site-id').inputValue();
 for(const [alias,username] of [['기존 BARO 계정','fixture-baro'],['추가 계정','fixture-second']]){
  await options.locator('#alias').fill(alias);await options.locator('#username').fill(username);await options.locator('#password').fill('synthetic-localhost-only');await options.locator('#account-form button.primary').click();await options.getByText(alias,{exact:true}).waitFor();
 }
 await options.reload();await options.waitForFunction(id=>document.querySelector('#site-id').value===id,sourceId);await options.locator('#login-settings').evaluate(el=>el.open=true);
 for(const [device,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await options.setViewportSize({width,height});await options.locator('#site-form').evaluate(el=>el.scrollIntoView({block:'start'}));
  await options.screenshot({path:path.join(output,`${stage}-localhost-settings-${device}.png`)});
  assert(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 if(stage==='baseline'){record('공유 추가 전 실제 설정 화면 baseline');}
 else{
  await options.setViewportSize({width:1920,height:1080});
  const localPages=[];
  for(const origin of origins){const page=await context.newPage();await page.goto(origin+'/workspace?view=all#row');localPages.push(page);assert.equal(await page.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);}
  await options.locator('#share-localhost').check();await options.locator('#site-form button.primary').click();await options.getByRole('status').filter({hasText:'도메인을 저장'}).waitFor();
  await options.reload();await options.waitForFunction(id=>document.querySelector('#site-id').value===id,sourceId);assert(await options.locator('#share-localhost').isChecked());
  const state=(await send({type:'LIST'})).sites;assert.equal(state.length,1);assert.equal(state[0].accounts.length,2);assert.equal(state[0].id,sourceId);record('공유 선택·재열기·기존 두 계정/원본 한 곳 유지');
  for(let i=0;i<localPages.length;i++){
   const page=localPages[i],original=page.url();await page.getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();
   await page.getByRole('button',{name:'기존 BARO 계정',exact:true}).click();await page.waitForURL(origins[i]+'/login-page');await page.waitForURL(original);
   assert.deepEqual(received.at(-1),{index:i,username:'fixture-baro',password:'synthetic-localhost-only'});
  }
  assert.equal(received.length,2);assert.equal(remoteRequests.length,0);record('두 포트 모두 기존 계정으로 실제 POST·정상 로그아웃·같은 포트 경로/쿼리/해시 복귀·운영 요청 0');
  // Different hostname stays outside the opt-in alias, even when permission is granted.
  await grant(['http://127.0.0.1/*']);const other=await context.newPage();await other.goto(origins[0].replace('localhost','127.0.0.1')+'/workspace');assert.equal(await other.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);record('localhost 외 hostname으로 계정 공유 거부');
  await options.evaluate(()=>chrome.permissions.remove({origins:['http://localhost/*']}));await localPages[0].reload();assert.equal(await localPages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);record('localhost 접근 권한 취소 시 계정 버튼/로그인 차단');
  await grant(['http://localhost/*','https://localhost/*']);
  await options.locator('#login-settings').evaluate(el=>el.open=true);
  await options.locator('#site-form button.primary').click();
  await options.getByRole('status').filter({hasText:'도메인을 저장'}).waitFor();
  const restoredPermission=await send({type:'SAVE_SITE',site:state[0]});assert(restoredPermission.ok,restoredPermission.error);
  // Exact localhost configuration owns its accounts; the source alias cannot override it.
  let r=await send({type:'SAVE_SITE',site:{origin:origins[0],loginUrl:origins[0]+'/login-page',selectors:state[0].selectors}});assert(r.ok);
  const localId=r.id;assert((await send({type:'SAVE_ACCOUNT',siteId:localId,account:{alias:'로컬 전용',username:'fixture-local',password:'synthetic-own'}})).ok);
  await localPages[0].reload();await localPages[0].getByRole('button',{name:'로컬 전용',exact:true}).waitFor();assert.equal(await localPages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);record('정확한 localhost 등록 계정이 공유보다 우선');
  r=await send({type:'SAVE_SITE',site:{...state[0],id:'',origin:'https://other.example',loginUrl:'https://other.example/login-page'}});assert.equal(r.ok,false);assert.match(r.error,/한 도메인/);record('동시 두 공유 원본 저장 거부');
  assert((await send({type:'DELETE_SITE',id:localId})).ok);
  await localPages[0].reload();await localPages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();record('로컬 전용 등록 삭제 후 원본 공유·사용 중인 localhost 권한 유지');
  assert((await send({type:'SAVE_SITE',site:{...state[0],shareOnLocalhost:false}})).ok);
  await localPages[1].reload();assert.equal(await localPages[1].getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);assert.equal((await send({type:'LIST'})).sites.find(s=>s.id===sourceId).accounts.length,2);record('공유 해제 즉시 차단·기존 원본 계정 보존');
  assert((await send({type:'SAVE_SITE',site:state[0]})).ok);await options.reload();await options.waitForFunction(id=>document.querySelector('#site-id').value===id,sourceId);await options.locator('#login-settings').evaluate(el=>el.open=true);
  for(const [device,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
   await options.setViewportSize({width,height});await options.locator('#site-form').evaluate(el=>el.scrollIntoView({block:'start'}));await options.screenshot({path:path.join(output,`implementation-localhost-settings-${device}.png`)});assert(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const control=await options.locator('.localhost-sharing').evaluate(el=>{const r=el.getBoundingClientRect(),input=el.querySelector('input').getBoundingClientRect();return{height:r.height,direction:getComputedStyle(el).flexDirection,inputWidth:input.width};});assert.equal(control.direction,'row');assert(control.height>=44);assert.equal(control.inputWidth,20);
  }
  await localPages[1].reload();await localPages[1].getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();await localPages[1].screenshot({path:path.join(output,'implementation-localhost-widget.png')});
  assert.deepEqual(errors,[]);record('실제 확장 UI desktop/mobile 가로 넘침 없음·페이지 JS 오류 0');
 }
 fs.writeFileSync(path.join(output,`${stage}-localhost-results.json`),JSON.stringify({runtime:context.browser().version(),cases,errors,remoteRequests,cleanup:'owned context/servers/profile removed in finally'},null,2));
}finally{await context?.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));fs.rmSync(profile,{recursive:true,force:true});}
