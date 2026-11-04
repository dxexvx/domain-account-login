// DAL-10: same-origin floating controls, current-tab navigation and persisted layout.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const stage=process.env.QA_STAGE||'implementation',output=process.env.QA_DIR;
if(!output)throw Error('Set QA_DIR to a verified external evidence run.');
fs.mkdirSync(output,{recursive:true});const profile=fs.mkdtempSync(path.join(output,'profile-'));
const aliases=['관리자','매체사(그로스텔라)','매체사(KIMG)','랩사(플랫브레드)'];
const received=[],events=[],errors=[],cases=[];
const fixture=login=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>플로팅 계정 검증</title><style>body{font:16px/1.5 system-ui;margin:0;color:#26313d;background:#f5f6f8}header{background:white;border-bottom:1px solid #dce0e5;padding:20px 28px}main{max-width:680px;margin:56px auto;padding:24px}h1{font-size:26px;font-weight:600}form{max-width:360px}label{display:block;margin:18px 0}input{display:block;box-sizing:border-box;width:100%;font:inherit;padding:12px}button{font:inherit;padding:12px 24px}p{color:#59636e}</style><header>확장프로그램 검증용 서비스</header><main><h1>${login?'로그인':'업무 현황'}</h1><p>${login?'저장한 계정으로 로그인하세요.':'로그인 입력란이 없는 업무 화면입니다.'}</p>${login?'<form><label>아이디<input id="user" autocomplete="username"></label><label>비밀번호<input id="pass" type="password" autocomplete="current-password"></label><button id="submit">로그인</button></form><p id="result" role="status"></p>':'<p>같은 도메인의 어느 화면에서든 계정 목록을 열 수 있습니다.</p><button id=logout hidden>로그아웃</button>'}</main><script>document.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const response=await fetch('/session',{method:'POST',body:JSON.stringify({username:document.querySelector('#user').value,password:document.querySelector('#pass').value})});document.querySelector('#result').textContent=response.ok?'로그인 요청 확인':'로그인 실패';if(response.ok)location.href='/home';});document.querySelector('#logout')?.addEventListener('click',async()=>{await fetch('/logout',{method:'POST'});location.href='/login-page';});</script></html>`;
const server=http.createServer((req,res)=>{if(req.url==='/session'){let body='';req.on('data',d=>body+=d);req.on('end',()=>{received.push(JSON.parse(body));events.push('login');if(JSON.parse(body).username==='fixture-reject')res.statusCode=401;res.end('ok');});}else if(req.url==='/logout'){events.push('logout');res.end('ok');}else{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture(new URL(req.url,'http://fixture').pathname==='/login-page'));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let context;
const record=name=>{cases.push(name);console.log('PASS '+name);};
try{
 const extension=path.resolve('.');
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));context.setDefaultTimeout(10000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,origin=`http://127.0.0.1:${server.address().port}`;
 const manager=await context.newPage();await manager.goto('chrome://extensions');await manager.evaluate(async({id,origin})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});await chrome.developerPrivate.addHostPermission(id,origin+'/*');},{id,origin});
 const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);
 const send=m=>options.evaluate(m=>chrome.runtime.sendMessage(m),m);
 assert((await send({type:'STATUS'})).ready);assert.equal(await options.locator('#master').count(),0);
 await options.reload();await options.locator('#workspace').waitFor({state:'visible'});await options.locator('#origin').fill(origin);await options.locator('#login-url').fill(origin+'/login-page');await options.locator('#login-settings').evaluate(el=>el.open=true);for(const [field,value] of [['username','#user'],['password','#pass'],['submit','#submit']])await options.locator('#selector-'+field).fill(value);await options.locator('#site-form button.primary').click();await options.locator('#account-section').waitFor({state:'visible'});const saved={id:await options.locator('#site-id').inputValue()};
 for(let i=0;i<aliases.length;i++)assert((await send({type:'SAVE_ACCOUNT',siteId:saved.id,account:{alias:aliases[i],username:'fixture-'+i,password:'synthetic-floating-'+i}})).ok);
 const page=await context.newPage(),widget=page.locator('#domain-account-login');
 for(const [device,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   for(const route of ['login-page','workspace']){
     await page.goto(origin+'/'+route);if(route==='login-page'||stage!=='baseline')await widget.getByRole('button',{name:aliases[0],exact:true}).waitFor();
     await page.screenshot({animations:'disabled',path:path.join(output,`${stage}-${route}-${device}.png`)});
   }
 }
 if(stage!=='baseline'){
   await page.setViewportSize({width:1920,height:1080});await page.goto(origin+'/workspace');
   const accounts=widget.locator('.account');await accounts.first().waitFor();
   assert.equal(await widget.locator('.panel').evaluate(el=>getComputedStyle(el).animationName),'arrive');
   await widget.locator('.panel').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
   const labels=await accounts.allTextContents();assert.equal(labels.length,4);assert(labels.every(s=>[...s].length<=4));
   const rects=await accounts.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));assert(rects.every((r,i)=>Math.round(r.w)>=44&&Math.round(r.h)>=44&&(!i||r.y>rects[i-1].y)));record('네 계정 축약·위에서 아래 순서·44px 조작');
   await accounts.nth(1).hover();await widget.getByRole('tooltip').filter({hasText:aliases[1]}).waitFor();await page.screenshot({animations:'disabled',path:path.join(output,'implementation-tooltip-desktop.png')});
   await accounts.nth(2).focus();assert.equal(await widget.getByRole('tooltip').textContent(),aliases[2]);record('마우스·키보드 전체 별칭 툴팁');
   const trigger=widget.getByRole('button',{name:'계정 목록 접기'});await trigger.click();await widget.getByRole('button',{name:'계정 목록 펼치기'}).waitFor();await page.screenshot({animations:'disabled',path:path.join(output,'implementation-collapsed-desktop.png')});
   await widget.getByRole('button',{name:'계정 목록 펼치기'}).click();await accounts.first().waitFor();record('펼침·접힘과 표시 애니메이션');
   const grip=widget.getByRole('button',{name:'계정 버튼 이동'}),before=await widget.boundingBox(),box=await grip.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(80,160,{steps:12});await page.mouse.up();
   await page.waitForFunction(()=>document.querySelector('#domain-account-login').getBoundingClientRect().x<150);
   assert.equal(received.length,0);await page.waitForTimeout(250);
   let state=await send({type:'LIST'});assert(state.sites[0].floating.x<.1);assert(state.sites[0].floating.expanded);
   await page.reload();await accounts.first().waitFor();const after=await widget.boundingBox();assert(after.x<150&&Math.abs(after.x-before.x)>100);record('드래그 이동·도메인 위치 저장·재열기');
   // Arrow movement is available to keyboard users; narrow viewport stays inside bounds.
   await grip.focus();await grip.press('ArrowRight');await page.waitForTimeout(200);
   for(const size of [{width:390,height:844},{width:320,height:240}]){await page.setViewportSize(size);await page.waitForTimeout(100);const r=await widget.boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=size.width&&r.y+r.height<=size.height);}
   await page.setViewportSize({width:1920,height:1080});record('키보드 이동·좁은 화면 위치 보정');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await widget.locator('.panel').evaluate(el=>getComputedStyle(el).animationDuration),'0s');await page.emulateMedia({reducedMotion:'no-preference'});record('모션 감소 설정 준수');
   state=await send({type:'LIST'});assert((await send({type:'SAVE_SITE',site:state.sites[0]})).ok);assert.deepEqual((await send({type:'LIST'})).sites[0].floating,state.sites[0].floating);record('도메인 편집 시 위치·계정 유지');
   const original=origin+'/workspace?view=all#row-2';await page.goto(origin+'/workspace');await accounts.first().waitFor();await page.evaluate(url=>history.pushState({},'',url),original);
   const count=context.pages().length;await widget.getByRole('button',{name:aliases[1],exact:true}).click();await page.waitForURL(origin+'/login-page').catch(()=>{});await page.waitForURL(original);await page.waitForFunction(()=>document.querySelector('#logout'));
   for(let i=0;received.length<1&&i<30;i++)await page.waitForTimeout(100);
   assert.deepEqual(received,[{username:'fixture-1',password:'synthetic-floating-1'}]);assert.deepEqual(events,['logout','login']);assert.equal(context.pages().length,count);record('DAL-11/12 SPA 이동 후 정상 로그아웃→선택 계정 로그인→원래 경로·쿼리·해시 복귀');
   await page.reload();await accounts.first().waitFor();assert.equal(received.length,1);record('새로고침 시 계정 전환 재실행 없음');
   const tabId=await worker.evaluate(async origin=>(await chrome.tabs.query({url:origin+'/*'}))[0].id,origin);
   const request=m=>worker.evaluate(async({tabId,m})=>(await chrome.scripting.executeScript({target:{tabId},func:m=>chrome.runtime.sendMessage({...m,pageUrl:location.href}),args:[m]}))[0].result,{tabId,m});
   const accountId=(await send({type:'LIST'})).sites[0].accounts[0].id;
   assert.equal((await request({type:'LOGIN',accountId,mode:'private'})).ok,false);
   assert.equal((await request({type:'SAVE_FLOATING',floating:{x:2,y:0,expanded:true}})).ok,false);
   await worker.evaluate(async({tabId,siteId,accountId})=>chrome.storage.session.set({['pending-'+tabId]:{siteId,accountId,expires:Date.now()+60000,loginUrl:location.origin+'/wrong'}}),{tabId,siteId:saved.id,accountId});
   assert.equal((await request({type:'CLAIM'})).submitted,undefined);assert.equal(received.length,1);await worker.evaluate(async({tabId,siteId,accountId,origin})=>chrome.storage.session.set({['pending-'+tabId]:{siteId,accountId,expires:Date.now()-1,loginUrl:origin+'/login-page'}}),{tabId,siteId:saved.id,accountId,origin});assert.equal((await request({type:'CLAIM'})).submitted,undefined);assert.equal(received.length,1);record('시크릿·잘못된 위치·다른 URL·만료 의도 거부');
   // A duplicate logout must stop before either session mutation; a failed login stays on the login screen.
   await worker.evaluate(tabId=>chrome.storage.session.remove('pending-'+tabId),tabId);
   await page.goto(origin+'/workspace');await accounts.first().waitFor();
   await page.evaluate(()=>{const b=document.createElement('button');b.textContent='로그아웃';document.body.append(b);});
   await widget.getByRole('button',{name:aliases[0],exact:true}).click();await widget.getByRole('status').filter({hasText:'로그아웃 요소가 여러 개'}).waitFor();assert.deepEqual(events,['logout','login']);record('DAL-11 중복 로그아웃 요소에서 전환 중단');
   await send({type:'SAVE_ACCOUNT',siteId:saved.id,account:{alias:'실패 검증',username:'fixture-reject',password:'synthetic-reject'}});
   await page.reload();await widget.getByRole('button',{name:'실패 검증',exact:true}).waitFor();await widget.getByRole('button',{name:'실패 검증',exact:true}).click();
   await page.waitForURL(origin+'/login-page');await page.getByText('로그인 실패',{exact:true}).waitFor();await page.waitForTimeout(250);assert.equal(page.url(),origin+'/login-page');assert.deepEqual(events,['logout','login','logout','login']);record('DAL-11 로그인 실패 시 원래 화면으로 잘못 복귀하지 않음');
   const other=await context.newPage();await other.goto(`http://localhost:${server.address().port}/workspace`);assert.equal(await other.locator('#domain-account-login').count(),0);record('허용하지 않은 도메인 표시 차단');
   assert.deepEqual(errors,[]);
 }
 fs.writeFileSync(path.join(output,stage+'-results.json'),JSON.stringify({stage,runtime:context.browser().version(),aliases,cases,errors,cleanup:'owned context/server/profile removed in finally'},null,2));
}finally{await context?.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
