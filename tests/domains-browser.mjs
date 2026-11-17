// DAL-20 / idea 61570: actual MV3 CRUD, shared login paths and domain boundaries.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const output=process.env.QA_DIR;if(!output)throw Error('Set QA_DIR to a verified external evidence run.');
const profile=fs.mkdtempSync(path.join(output,'domains-profile-')),received=[],errors=[],cases=[],servers=[],remoteRequests=[];
const record=name=>{cases.push({name,status:'passed'});console.log('PASS '+name);};
const fixture=login=>`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>공유 도메인 검증</title><style>body{font:16px/1.5 system-ui;margin:40px;color:#26313d}main{max-width:420px;margin:auto}label{display:block;margin:16px 0}input,button{font:inherit;padding:12px}input{display:block}h1{font-weight:400}</style><main><h1>${login?'테스트 로그인':'테스트 업무 화면'}</h1>${login?'<form><label>아이디<input id="user" autocomplete="username"></label><label>비밀번호<input id="pass" type="password"></label><button id="submit">로그인</button></form>':'<p>합성 계정으로 확장 동작을 확인합니다.</p><button id="logout">로그아웃</button>'}</main><script>document.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();await fetch('/session',{method:'POST',body:JSON.stringify({username:document.querySelector('#user').value,password:document.querySelector('#pass').value})});location.href='/home';});document.querySelector('#logout')?.addEventListener('click',async()=>{await fetch('/logout',{method:'POST'});location.href='/login-page';});</script></html>`;
let context;
try{
 for(let index=0;index<2;index++){
  const server=http.createServer((req,res)=>{
   if(req.url==='/session'){let body='';req.on('data',d=>body+=d);req.on('end',()=>{received.push({index,...JSON.parse(body)});res.end('ok');});}
   else if(req.url==='/logout')res.end('ok');
   else{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture(new URL(req.url,'http://fixture').pathname==='/login-page'));}
  });servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 }
 const origins=servers.map(s=>'http://localhost:'+s.address().port),loopback=origins[1].replace('localhost','127.0.0.1'),sourceOrigin='https://baropro.vrixon.com',dev='https://dev.example.test';
 context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1920,height:1080},args:[`--disable-extensions-except=${path.resolve('.')}`,`--load-extension=${path.resolve('.')}`]});
 context.setDefaultTimeout(10000);context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route(sourceOrigin+'/**',r=>{remoteRequests.push(r.request().url());return r.abort();});
 // This synthetic HTTPS host tests domain matching only. Real POSTs use the local servers.
 await context.route(dev+'/**',r=>r.fulfill({contentType:'text/html;charset=utf-8',body:fixture(true)}));
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,optionsUrl=`chrome-extension://${id}/options.html`;
 const manager=await context.newPage();await manager.goto('chrome://extensions');
 const grant=patterns=>manager.evaluate(async({id,patterns})=>{await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});for(const p of patterns)await chrome.developerPrivate.addHostPermission(id,p);},{id,patterns});
 await grant([sourceOrigin+'/*','http://localhost/*','https://localhost/*','http://127.0.0.1/*',dev+'/*']);
 const options=await context.newPage();await options.goto(optionsUrl);await options.locator('#workspace').waitFor({state:'visible'});
 const send=m=>options.evaluate(m=>chrome.runtime.sendMessage(m),m);
 const openSettings=()=>options.locator('#login-settings').evaluate(el=>el.open=true);
 const saveUi=async()=>{await options.locator('#site-form button.primary').click();await options.getByRole('status').filter({hasText:'도메인을 저장'}).waitFor();};
 const add=async value=>{await options.locator('#add-domain').click();await options.locator('#additional-domains input').last().fill(value);};
 await options.locator('#origin').fill(sourceOrigin);await options.locator('#login-url').fill('/login-page');
 for(const [f,v] of [['username','#user'],['password','#pass'],['submit','#submit']])await options.locator('#selector-'+f).fill(v);
 await saveUi();await options.locator('#account-section').waitFor({state:'visible'});const sourceId=await options.locator('#site-id').inputValue();
 for(const [alias,username] of [['기존 BARO 계정','fixture-baro'],['추가 계정','fixture-second']]){
  await options.locator('#alias').fill(alias);await options.locator('#username').fill(username);await options.locator('#password').fill('synthetic-localhost-only');await options.locator('#account-form button.primary').click();await options.getByText(alias,{exact:true}).waitFor();
 }
 const pages=[];for(const origin of [origins[0],loopback]){const page=await context.newPage();await page.goto(origin+'/workspace?view=all#row');pages.push(page);assert.equal(await page.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);}
 record('미등록 두 도메인은 접근 권한이 있어도 계정 버튼을 표시하지 않음');
 await openSettings();for(const value of [dev,origins[0],loopback])await add(value);await saveUi();await options.reload();await options.locator('#account-section').waitFor({state:'visible'});await openSettings();
 assert.equal(await options.locator('#login-url').inputValue(),'/login-page');assert.equal(await options.locator('#share-localhost').count(),0);
 let state=(await send({type:'LIST'})).sites;assert.equal(state.length,1);assert.equal(state[0].id,sourceId);assert.equal(state[0].accounts.length,2);assert.deepEqual(state[0].additionalDomains,[dev,origins[0],loopback]);
 assert.equal(await options.locator('#sites .site-group').count(),1);assert.equal(await options.locator('#sites .site-domains li').count(),3);
 record('UI에서 추가 도메인 세 개 저장·재열기·기준 아래 계층 표시·경로만 표시·계정/ID 유지');
 for(let i=0;i<pages.length;i++){
  const page=pages[i],original=page.url();await page.reload();await page.getByRole('button',{name:'기존 BARO 계정',exact:true}).click();await page.waitForURL(original);
  await page.waitForFunction(()=>!document.querySelector('form'));
  // Wait for the real sink before asserting return; the initial URL can equal the destination.
  await assertEventually(()=>received.some(x=>x.index===i&&x.username==='fixture-baro'));
  await page.waitForURL(original);assert.deepEqual(received.find(x=>x.index===i),{index:i,username:'fixture-baro',password:'synthetic-localhost-only'});
 }
 assert.equal(received.length,2);assert.equal(remoteRequests.length,0);record('localhost·127.0.0.1의 실제 POST·정상 로그아웃·각 원래 포트/경로/쿼리/해시 복귀·운영 요청0');
 const devPage=await context.newPage();await devPage.goto(dev+'/login-page');await devPage.getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();
 await openSettings();await options.locator('#additional-domains input').nth(0).fill('https://preview.example.test');await options.locator('#additional-domains .domain-row').nth(1).getByRole('button').click();
 await grant(['https://preview.example.test/*']);await saveUi();await devPage.reload();assert.equal(await devPage.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);await pages[0].reload();assert.equal(await pages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);
 state=(await send({type:'LIST'})).sites;assert.deepEqual(state[0].additionalDomains,['https://preview.example.test',loopback]);assert.equal(state[0].accounts.length,2);record('UI 수정·제거 저장 후 이전 도메인 차단·계정 보존');
 await openSettings();await options.locator('#additional-domains input').nth(0).fill(dev);await add('localhost:*');await saveUi();state=(await send({type:'LIST'})).sites;
 const before=structuredClone(state);let r=await send({type:'SAVE_SITE',site:{...state[0],id:'',origin:'https://other.example',loginUrl:'/login-page'}});assert.equal(r.ok,false);assert.deepEqual((await send({type:'LIST'})).sites,before);record('서로 다른 기준 도메인의 중복 추가 도메인/localhost 범위 저장 거부·정본 불변');
 // Model a denied host request in the extension page, without changing real browser policy.
 await openSettings();await add('https://denied.example.test');
 await options.evaluate(()=>{window.originalPermissionRequest=chrome.permissions.request;chrome.permissions.request=async()=>false;});
 await options.locator('#site-form button.primary').click();await options.locator('#notice.error').waitFor();assert.deepEqual((await send({type:'LIST'})).sites,before);
 await options.evaluate(()=>{chrome.permissions.request=window.originalPermissionRequest;delete window.originalPermissionRequest;});await options.reload();await options.locator('#account-section').waitFor({state:'visible'});record('합성 권한 거부 시 저장·계정 불변 (native 승인창 조작은 제외)');
 const secondLocal=await context.newPage();await secondLocal.goto(origins[1]+'/workspace?view=all#row');await secondLocal.getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();
 const original=secondLocal.url();await secondLocal.getByRole('button',{name:'기존 BARO 계정',exact:true}).click();await assertEventually(()=>received.length===3);await secondLocal.waitForURL(original);record('localhost:* 목록 항목으로 다른 포트에서도 동일 경로 로그인·복귀');
 await options.evaluate(()=>chrome.permissions.remove({origins:['http://localhost/*']}));await secondLocal.reload();assert.equal(await secondLocal.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);await grant([sourceOrigin+'/*','http://localhost/*','https://localhost/*','http://127.0.0.1/*',dev+'/*']);
 // developerPrivate changes site access; an optional grant revoked by permissions.remove
 // must be requested again from the real Save click, as a user would do.
 await openSettings();await saveUi();assert.deepEqual((await send({type:'LIST'})).sites,state);record('사용자가 host 권한을 철회하면 차단·저장 클릭의 재허용으로 복원');
 r=await send({type:'SAVE_SITE',site:{origin:origins[0],loginUrl:'/login-page',selectors:state[0].selectors}});assert(r.ok,r.error);const localId=r.id;
 assert((await send({type:'SAVE_ACCOUNT',siteId:localId,account:{alias:'로컬 전용',username:'fixture-local',password:'synthetic-own'}})).ok);
 await pages[0].reload();await pages[0].getByRole('button',{name:'로컬 전용',exact:true}).waitFor();assert.equal(await pages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);
 assert((await send({type:'DELETE_SITE',id:localId})).ok);await pages[0].reload();await pages[0].getByRole('button',{name:'기존 BARO 계정',exact:true}).waitFor();record('정확 등록 우선·그 등록 삭제 후 기존 wildcard/사용 권한 유지');
 // A popup mapping on an alias must update the owning group, never create another vault.
 await pages[1].goto(loopback+'/login-page?from=alias#form');const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,pages[1].url());
 r=await popup.evaluate(m=>chrome.runtime.sendMessage(m),{type:'MAP_LOGIN',tabId,url:pages[1].url()});assert(r.ok,r.error);
 r=await send({type:'APPLY_DRAFT'});assert(r.ok,r.error);assert.equal(r.id,sourceId);state=(await send({type:'LIST'})).sites;assert.equal(state.length,1);assert.equal(state[0].origin,sourceOrigin);assert.equal(state[0].accounts.length,2);assert.deepEqual(state[0].additionalDomains,[dev,loopback,'localhost:*']);assert.equal(state[0].loginUrl,sourceOrigin+'/login-page?from=alias#form');
 record('추가 도메인에서 자동 매핑해도 기준 그룹·계정·추가 목록 보존');
 // Exercise the actual legacy encrypted-vault read path, using synthetic credentials only.
 await options.evaluate(async site=>{const core=await import('./core.js'),{browserKey}=await import('./vault.js');const legacy={...site,shareOnLocalhost:true};delete legacy.additionalDomains;const {vault}=await chrome.storage.local.get('vault');await chrome.storage.local.set({vault:await core.encrypt({sites:[legacy]},await browserKey(),vault.salt)});},state[0]);
 await options.reload();await options.locator('#account-section').waitFor({state:'visible'});await openSettings();assert.deepEqual(await options.locator('#additional-domains input').evaluateAll(xs=>xs.map(x=>x.value)),['localhost:*']);assert.equal(await options.locator('#login-url').inputValue(),'/login-page?from=alias#form');
 await options.locator('#additional-domains .domain-row').getByRole('button').click();await saveUi();await options.reload();await options.locator('#account-section').waitFor({state:'visible'});assert.equal((await send({type:'LIST'})).sites[0].additionalDomains,undefined);await secondLocal.reload();assert.equal(await secondLocal.getByRole('button',{name:'기존 BARO 계정',exact:true}).count(),0);
 record('1.4.0 암호화 보관함의 공유를 목록으로 이전·제거 후 재열기에도 공유 부활 없음');
 // Restore representative final settings through the UI for comparison captures.
 await grant(['http://localhost/*','https://localhost/*','http://127.0.0.1/*',dev+'/*']);await openSettings();await options.locator('#login-url').fill('/login-page');for(const value of [dev,loopback,'localhost:*'])await add(value);await saveUi();await options.reload();await options.locator('#account-section').waitFor({state:'visible'});await openSettings();
 const geometry=[];
 for(const [device,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await options.setViewportSize({width,height});await options.evaluate(()=>scrollTo(0,0));await options.screenshot({path:path.join(output,`implementation-domains-overview-${device}.png`)});await options.locator('#site-form').evaluate(el=>el.scrollIntoView({block:'start'}));
  assert(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const rows=await options.locator('.domain-row').evaluateAll(rows=>rows.map(row=>{const a=row.querySelector('input').getBoundingClientRect(),b=row.querySelector('button').getBoundingClientRect();return {inputHeight:a.height,buttonHeight:b.height,centerDelta:Math.abs(a.y+a.height/2-b.y-b.height/2),gap:b.x-a.right,right:b.right};}));
  for(const row of rows){assert.equal(row.inputHeight,44);assert.equal(row.buttonHeight,44);assert(row.centerDelta<=1);assert(row.gap>=8);assert(row.right<=width);}
  geometry.push({device,width,height,rows});await options.screenshot({path:path.join(output,`implementation-localhost-settings-${device}.png`)});
 }
 await options.setViewportSize({width:390,height:844});const touch=await context.newCDPSession(options);await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await options.locator('#add-domain').scrollIntoViewIfNeeded();const box=await options.locator('#add-domain').boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await options.locator('.domain-row').count(),4);await options.locator('.domain-row').last().getByRole('button').click();await touch.detach();
 record('세 폭에서 실제 렌더·44px 동급 제어 정렬·가로 넘침 없음·touch 추가/제거');
 await options.setViewportSize({width:1920,height:1080});
 const performance={};
 for(const journey of ['new document entry','warm reload','back reentry','persisted revisit']){
  const values=[],requests=[];let page=await context.newPage();
  if(journey!=='new document entry'){await page.goto(optionsUrl);await page.locator('#account-section').waitFor({state:'visible'});}
  for(let sample=0;sample<5;sample++){
   if(journey==='back reentry')await page.goto('about:blank');
   if(journey==='persisted revisit'){await page.close();page=await context.newPage();}
   let network=0;const count=req=>{if(/^https?:/.test(req.url()))network++;};page.on('request',count);const start=Date.now();
   if(journey==='warm reload')await page.reload();else if(journey==='back reentry')await page.goBack();else await page.goto(optionsUrl);
   await page.locator('#account-section').waitFor({state:'visible'});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));values.push(Date.now()-start);requests.push(network);page.off('request',count);
   if(journey==='new document entry'){await page.close();page=await context.newPage();}
  }
  await page.close();assert(Math.max(...values)<2500,'document ready must stay under the 2500ms load ceiling');assert(requests.every(n=>n===0));performance[journey]={values,max:Math.max(...values),criticalPathNetworkRequests:requests};
 }
 const same=[];for(let sample=0;sample<5;sample++){await openSettings();const start=Date.now();await options.locator('#add-domain').click();await options.locator('.domain-row').last().locator('input').waitFor({state:'visible'});await options.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));same.push(Date.now()-start);await options.locator('.domain-row').last().getByRole('button').click();}
 assert(Math.max(...same)<500,'same-route input-to-ready must stay under 500ms');performance['same-route transition']={values:same,max:Math.max(...same),criticalPathNetworkRequests:0};
 record('옵션 진입/재진입·같은 화면 목록 반응 각5표본과 외부요청0 관측');
 assert.deepEqual(errors,[]);assert.equal(remoteRequests.length,0);record('페이지 JS 오류0·실제 운영 요청0');
 fs.writeFileSync(path.join(output,'implementation-domains-results.json'),JSON.stringify({runtime:context.browser().version(),cases,errors,remoteRequests,geometry,performance,cleanup:'owned context/servers/profile removed in finally'},null,2));
}finally{await context?.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));fs.rmSync(profile,{recursive:true,force:true});}

async function assertEventually(check){const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)assert.fail('local POST sink did not receive the expected account');await new Promise(r=>setTimeout(r,20));}}
