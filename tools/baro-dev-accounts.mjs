// Fixed DEV-only operation for the user's three dedicated test accounts.
// No secret getter, arbitrary host/command, existing-account update or impersonation.
import https from 'node:https';
import fs from 'node:fs/promises';
import {constants as FS} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash,randomBytes,createPublicKey,publicEncrypt,constants} from 'node:crypto';
import {chromium} from '@playwright/test';
import {sealTransfer,validateRequest} from '../transfer.js';
const DEV='https://baropro.vrixon.com',BAO='https://secrets.devislife.com';
const ROOT='/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence';
const IDENTITY_ROOT='/Users/devis/.config/devis/openbao';
const DESTINATION=IDENTITY_ROOT+'/baro-dal-extension-destination.json';
const EXTENSION_ID='jmglmbmgkfnkgbcajdicmfhhdpaigbjc';
const CLI='/Users/devis/.local/libexec/openbao-cli/bao-2.6.2',CLI_SHA='d476d17e81a35e6d70dd7e86a8ab2a3664313525118f1f1cfe0130e7a2b95f3a';
const STORE='/Users/devis/Yeo/Workspaces/Platbread/Codes/openbaro_tickets/BARO-2185/baroad.pro.vue/modules/baroad.common.vue/stores/useConfigStore.js';
const STORE_SHA='65f10115d755db1403628bd6570d07da766e7fe71c8e5eb32e00786126b6b654';
const targets=[
 {key:'growth',id:'dal261103growth',name:'그로스텔라 로그인 검증',alias:'매체사(그로스텔라)',company:'(주)그로스스텔라',search:'그로스',role:'10005',group:'마스터(매체사)',phone:'010-1000-1101'},
 {key:'kimg',id:'dal261103kimg',name:'KIMG 로그인 검증',alias:'매체사(KIMG)',company:'(주)KIMG',search:'KIMG',role:'10005',group:'마스터(매체사)',phone:'010-1000-1102'},
 {key:'lab',id:'dal261103lab',name:'플랫브레드 로그인 검증',alias:'랩사(플랫브레드)',company:'플랫브레드',search:'플랫브레드',role:'10003',group:'플랩 테스트',phone:'010-1000-1103'},
];
const admin={service:'baro-pro-e2e-dev',id:'ychis1'};
for(const t of targets)t.service='baro-pro-dal-dev-'+t.key;
const services=new Set([admin.service,...targets.map(t=>t.service)]);
const readPaths=new Set(['/api/account/corp/exclude/rolecd/jsonList.do','/api/account/corp/rolecd/jsonList.do','/api/account/usergroup/rolecd/jsonList.do','/api/account/authgroup/jsonList.do','/api/account/user/jsonList.do','/api/account/user/jsonDetail.do','/api/account/user/allowed/ip/list','/api/md/auth/grp/jsonList.do','/api/md/auth/grp/jsonDetail.do']);
const bootstrap=new Set(['/api/login/jsonLoginPrc.do','/api/login/jsonKey.do','/api/log/jsonAccess.do','/api/system/env/jsonBaseConfig.do','/api/system/menu/jsonGnb.do','/api/bcode/jsonTree.do','/api/system/env/jsonOpenDspBidPolicy.do']);
const rows=x=>Array.isArray(x)?x:x?.list??[];
const ensure=(value,message)=>{if(!value)throw new Error(message);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===keys.slice().sort().join();
let stage='arguments',browser,ctx,adminSecret,operatorToken;
const result={origin:DEV,status:'failed',existingAccountsModified:0,impersonation:false,accounts:[],startedAt:new Date().toISOString()};
async function protectedRead(filename){const fd=await fs.open(filename,FS.O_RDONLY|FS.O_NOFOLLOW);try{const s=await fd.stat();ensure(s.isFile()&&s.nlink===1&&s.uid===process.getuid()&&(s.mode&0o777)===0o600&&s.size<16384,'identity file boundary rejected');return await fd.readFile();}finally{await fd.close();}}
async function baoHTTP(method,endpoint,payload,token){
 const enrollmentPaths=targets.flatMap(t=>['credential/data/services/'+t.service,'sys/policies/acl/'+t.service+'-read','auth/approle/role/'+t.service,'auth/approle/role/'+t.service+'/role-id','auth/approle/role/'+t.service+'/secret-id']).map(p=>'/v1/'+p);
 ensure(endpoint==='/v1/auth/approle/login'||endpoint==='/v1/auth/token/revoke-self'||endpoint==='/v1/auth/userpass/login/whychible'||[...services].some(s=>endpoint==='/v1/credential/data/services/'+s)||(operatorToken&&enrollmentPaths.includes(endpoint)),'OpenBao path refused');
 const body=payload?Buffer.from(JSON.stringify(payload)):null;
 try{return await new Promise((resolve,reject)=>{const req=https.request(BAO+endpoint,{method,timeout:20000,headers:{'Content-Type':'application/json',...(token?{'X-Vault-Token':token}:{})}},res=>{let chunks=[],size=0;res.on('data',c=>{size+=c.length;if(size>1048576)req.destroy();else chunks.push(c);});res.on('end',()=>{const raw=Buffer.concat(chunks);try{resolve({status:res.statusCode,data:JSON.parse(raw.length?raw:'{}')});}catch{reject(Error('OpenBao response rejected'));}finally{raw.fill(0);chunks.forEach(c=>c.fill(0));}});});req.on('error',()=>reject(Error('OpenBao TLS request failed')));req.on('timeout',()=>req.destroy());req.end(body);});}finally{body?.fill(0);}
}
async function scoped(t){
 const raw=await protectedRead(path.join(IDENTITY_ROOT,t.service+'-approle.json'));let identity;try{identity=JSON.parse(raw);}finally{raw.fill(0);}
 ensure(exact(identity,['version','origin','role','role_id','secret_id'])&&identity.version===1&&identity.origin===BAO&&identity.role===t.service,'scoped identity schema rejected');
 const auth=await baoHTTP('POST','/v1/auth/approle/login',{role_id:identity.role_id,secret_id:identity.secret_id});
 ensure(auth.status===200&&auth.data.auth?.policies?.includes(t.service+'-read'),'scoped AppRole authentication denied');
 const token=auth.data.auth.client_token;
 try{const r=await baoHTTP('GET','/v1/credential/data/services/'+t.service,undefined,token),a=r.data?.data?.data;ensure(r.status===200&&exact(a,['account','password'])&&a.account===t.id&&typeof a.password==='string'&&a.password.length>=8&&a.password.length<=512,'scoped native account rejected');return a;}
 finally{await baoHTTP('POST','/v1/auth/token/revoke-self',{},token).catch(()=>{});}
}
async function cli(method,endpoint,payload){
 const allowed=new Set(targets.flatMap(t=>['credential/data/services/'+t.service,'sys/policies/acl/'+t.service+'-read','auth/approle/role/'+t.service,'auth/approle/role/'+t.service+'/role-id','auth/approle/role/'+t.service+'/secret-id']));
 ensure(allowed.has(endpoint)&&['read','write','capabilities'].includes(method),'native enrollment path refused');
 if(operatorToken){ensure(method!=='capabilities','operator capability query is not needed');const r=await baoHTTP(method==='read'?'GET':'POST','/v1/'+endpoint,payload,operatorToken);return {ok:[200,204].includes(r.status),missing:r.status===404,denied:r.status===403,value:r.data};}
 ensure(createHash('sha256').update(await fs.readFile(CLI)).digest('hex')===CLI_SHA,'native CLI identity rejected');
 const args=method==='capabilities'?['token','capabilities']: [method];args.push('-format=json','-address='+BAO,'-disable-redirects',endpoint);if(method==='write')args.push('-');
 const input=payload?Buffer.from(JSON.stringify(payload)):undefined;
 const child=spawnSync(CLI,args,{input,env:{HOME:'/Users/devis',PATH:'/usr/bin:/bin',LC_ALL:'C'},encoding:null,timeout:25000,maxBuffer:1048576});input?.fill(0);
 try{if(child.status!==0)return {ok:false,missing:/no value found/i.test(child.stderr?.toString()??''),denied:/permission denied|missing.*token/i.test(child.stderr?.toString()??'')};return {ok:true,value:child.stdout.length?JSON.parse(child.stdout):{}};}finally{child.stdout?.fill(0);child.stderr?.fill(0);}
}
async function enrollmentReady(){for(const t of targets){for(const endpoint of ['credential/data/services/'+t.service,'sys/policies/acl/'+t.service+'-read','auth/approle/role/'+t.service,'auth/approle/role/'+t.service+'/role-id','auth/approle/role/'+t.service+'/secret-id']){const r=await cli('capabilities',endpoint);const caps=Array.isArray(r.value)?r.value:r.value?.[endpoint]??[];ensure(r.ok&&caps.includes('read')&&(endpoint.endsWith('/role-id')||caps.includes('create')||caps.includes('update')),'OpenBao initial-enrollment authentication/capability unavailable; no BARO save performed');}}}
async function hiddenOperatorPassword(){
 ensure(process.stdin.isTTY&&process.stdout.isTTY,'OpenBao authentication needs a local interactive terminal; never pass the password in chat/argv/env');
 process.stdout.write('OpenBao whychible 관리자 비밀번호 (숨김 입력): ');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let password='';const finish=()=>{process.stdin.off('data',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const input=chunk=>{for(const c of chunk){if(c==='\u0003'){finish();reject(Error('operator authentication cancelled'));return;}if(c==='\r'||c==='\n'){finish();resolve(password);return;}if(c==='\u007f')password=password.slice(0,-1);else if(c>=' '&&password.length<512)password+=c;}};process.stdin.on('data',input);});
}
async function interactiveEnrollment(){
 let password=await hiddenOperatorPassword();
 try{const r=await baoHTTP('POST','/v1/auth/userpass/login/whychible',{password});password='';ensure(r.status===200&&r.data.auth?.policies?.includes('admin')&&typeof r.data.auth.client_token==='string','OpenBao administrator normal authentication denied; no retry/rotation');operatorToken=r.data.auth.client_token;
  for(const t of targets){const a=await enroll(t);a.password='';console.log(t.alias+': native CAS0/readback and separate read-only AppRole verified');}
 }finally{password='';if(operatorToken)await baoHTTP('POST','/v1/auth/token/revoke-self',{},operatorToken).catch(()=>{});operatorToken=undefined;}
}
function passwordFor(id){for(;;){const p=randomBytes(18).toString('base64url').replace(/[-_]/g,'A')+'!6q';if(/(.)\1\1/.test(p)||[...id].some((_,i)=>id.slice(i,i+4).length===4&&p.toLowerCase().includes(id.slice(i,i+4).toLowerCase()))||/abcd|1234|zxcv|qwer/i.test(p))continue;if([...p].some((_,i)=>i+2<p.length&&Math.abs(p.charCodeAt(i)-p.charCodeAt(i+1))===1&&p.charCodeAt(i)-p.charCodeAt(i+1)===p.charCodeAt(i+1)-p.charCodeAt(i+2)))continue;return p;}}
async function enroll(t){
 const endpoint='credential/data/services/'+t.service;let r=await cli('read',endpoint),account;
 if(r.ok){account=r.value?.data?.data;ensure(exact(account,['account','password'])&&account.account===t.id&&typeof account.password==='string','existing native record mismatch; preserved');}
 else{ensure(r.missing,'native record status unavailable');account={account:t.id,password:passwordFor(t.id)};ensure((await cli('write',endpoint,{options:{cas:0},data:account})).ok,'native CAS0 enrollment failed');}
 r=await cli('read',endpoint);ensure(r.ok&&r.value?.data?.data?.account===account.account&&r.value.data.data.password===account.password,'native account readback failed');
 const policy='path "credential/data/services/'+t.service+'" {\n  capabilities = ["read"]\n}';
 r=await cli('read','sys/policies/acl/'+t.service+'-read');if(r.ok)ensure(r.value?.data?.policy===policy,'existing policy differs; preserved');else{ensure(r.missing,'policy status unavailable');ensure((await cli('write','sys/policies/acl/'+t.service+'-read',{policy})).ok,'exact policy enrollment failed');}
 const rolePath='auth/approle/role/'+t.service;
 r=await cli('read',rolePath);if(r.ok){const d=r.value?.data;ensure(d?.bind_secret_id===true&&d.token_policies?.length===1&&d.token_policies[0]===t.service+'-read'&&d.token_max_ttl===300&&d.token_num_uses===8,'existing AppRole differs; preserved');}else{ensure(r.missing,'role status unavailable');ensure((await cli('write',rolePath,{bind_secret_id:true,secret_id_num_uses:0,secret_id_ttl:'0s',token_policies:[t.service+'-read'],token_num_uses:8,token_ttl:'5m',token_max_ttl:'5m',token_type:'service'})).ok,'exact AppRole enrollment failed');}
 const filename=path.join(IDENTITY_ROOT,t.service+'-approle.json');
 try{await fs.lstat(filename);}catch(e){if(e.code!=='ENOENT')throw e;const role=await cli('read',rolePath+'/role-id'),secret=await cli('write',rolePath+'/secret-id',{});ensure(role.ok&&secret.ok&&[role.value?.data?.role_id,secret.value?.data?.secret_id].every(x=>typeof x==='string'&&x.length>=8&&x.length<=512),'read-only identity enrollment failed');const raw=Buffer.from(JSON.stringify({version:1,origin:BAO,role:t.service,role_id:role.value.data.role_id,secret_id:secret.value.data.secret_id}));try{await fs.writeFile(filename,raw,{flag:'wx',mode:0o600});}finally{raw.fill(0);}}
 const readback=await scoped(t);ensure(readback.account===account.account&&readback.password===account.password,'scoped native readback mismatch');account.password='';return readback;
}
async function login(account,expected){
 const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block'});let attempts=0,loginUser;
 const diagnostic={loginId:account.account,step:'navigation',attempts:0,blockedHosts:[],blockedApiPaths:[]};
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==DEV||u.username||u.password){if(!diagnostic.blockedHosts.includes(u.host))diagnostic.blockedHosts.push(u.host);return route.abort();}if(u.pathname.startsWith('/api/')){if(req.method()!=='POST'||!bootstrap.has(u.pathname)){if(!diagnostic.blockedApiPaths.includes(u.pathname))diagnostic.blockedApiPaths.push(u.pathname);return route.abort();}if(u.pathname==='/api/login/jsonLoginPrc.do'&&++attempts>1)return route.abort();if(u.pathname==='/api/login/jsonLoginPrc.do'){diagnostic.attempts=attempts;try{const r=await route.fetch({maxRedirects:0,timeout:45000}),b=await r.json();diagnostic.httpStatus=r.status();diagnostic.code=Number.isInteger(b.code)?b.code:null;if(r.ok()&&b.code===0)loginUser=b.data;await route.fulfill({response:r});}catch{diagnostic.transportFailed=true;await route.abort();}return;}}else if(req.method()!=='GET')return route.abort();await route.continue();});
 try{const page=await context.newPage();await page.goto(DEV+'/login',{timeout:45000});diagnostic.step='fill';await page.locator('#uId').fill(account.account);await page.locator('#uPwd').fill(account.password);diagnostic.step='submit';await page.getByRole('button',{name:'로그인',exact:true}).click();diagnostic.step='navigation-after-login';await page.waitForURL(u=>u.origin===DEV&&u.pathname!=='/login',{timeout:45000});diagnostic.step='role';ensure(loginUser&&String(loginUser.roleCd)===expected.role,'normal login role verification failed');if(expected.cId)ensure(loginUser.cId===expected.cId,'normal login company mismatch');return {context,page,user:loginUser,attempts};}catch(e){diagnostic.errorType=e.name;result.authenticationFailure=diagnostic;await context.close();throw Error('normal login failed; no retry/reset/impersonation');}
}
async function post(endpoint,data,write=false){
 ensure(readPaths.has(endpoint)||(write&&['/api/account/user/jsonSave.do','/api/account/user/allowed/ip/save'].includes(endpoint)),'BARO operation refused');
 if(write){ensure(data.uIdx===undefined||endpoint.endsWith('/allowed/ip/save'),'existing account update refused');ensure(targets.some(t=>endpoint.endsWith('/allowed/ip/save')?result.accounts.some(a=>a.uIdx===data.uIdx):t.id===data.uId),'unowned account mutation refused');}
 const response=await ctx.request.post(DEV+endpoint,{data,headers:{JsonRequest:'true'},maxRedirects:0,timeout:45000});let body;try{body=await response.json();}catch{throw Error('BARO response format rejected: '+endpoint);}ensure(response.ok()&&body.code===0,`BARO ${endpoint} HTTP ${response.status()} code ${Number.isInteger(body.code)?body.code:'invalid'}`);return body.data;
}
async function inspect(){
 adminSecret=await scoped(admin);browser=await chromium.launch({headless:true});const auth=await login(adminSecret,{role:'10001'});ctx=auth.context;
 for(const p of ['PG000019','PG004003'])ensure(auth.user.programIdList?.includes(p),'administrator registration permission missing');
 result.admin={loginId:'ychis1',normalLogin:true,attempts:auth.attempts,roleCode:'10001',createAndAllowedIpPermission:true};
 const prepared=[];
 for(const t of targets){
  const companies=rows(await post('/api/account/corp/exclude/rolecd/jsonList.do',{cName:t.search,pagination:{page:1,lineSize:100}})).filter(c=>c.cName===t.company&&Number(c.cStatus)===1);ensure(companies.length===1,'exact active company lookup ambiguous: '+t.key);const cId=companies[0].cId;
  ensure(rows(await post('/api/account/corp/rolecd/jsonList.do',{cId})).some(r=>String(r.roleCd)===t.role),'company role missing: '+t.key);
  const groups=rows(await post('/api/account/usergroup/rolecd/jsonList.do',{cId,roleCd:t.role})).filter(g=>Number(g.ugStatus)===1&&g.cId===cId&&String(g.roleCd)===t.role);
  const matches=groups.filter(g=>g.ugName===t.group);ensure(matches.length===1,'exact active group lookup ambiguous: '+t.key+'; active names: '+groups.map(g=>g.ugName).join(', '));
  const ugCode=matches[0].ugCode;const auth=rows(await post('/api/account/authgroup/jsonList.do',{ugCode})).flatMap(m=>m.programVo?.list??[]).map(p=>p.pgId);ensure(auth.length>0,'target account group has no programs');
  const existing=rows(await post('/api/account/user/jsonList.do',{uId:t.id,pagination:{page:1,lineSize:100}}));ensure(existing.length<=1,'existing login lookup ambiguous');if(existing.length)ensure(existing[0].cId===cId&&String(existing[0].roleCd)===t.role&&existing[0].ugCode===ugCode&&Number(existing[0].uStatus)===1&&!existing[0].isLocked&&(!existing[0].uPwdExpiredAt||Date.parse(existing[0].uPwdExpiredAt)>Date.now()),'existing test ID differs/unavailable; no modification');
  let media=[];
  if(t.role==='10005'){const list=rows(await post('/api/md/auth/grp/jsonList.do',{cId,pagination:{page:1,lineSize:100}}));for(const g of list){const d=await post('/api/md/auth/grp/jsonDetail.do',{magIdx:g.magIdx});if(Number(d.useSt)===1&&(d.srvcMdList??[]).some(m=>Number(m.useSt)===1&&Number(m.mngAuthSt)===1))media.push({id:g.magIdx,name:g.magNm??d.magNm});}ensure(media.length>0,'active existing media authorization group missing');}
  prepared.push({...t,cId,ugCode,existing:existing[0],media});
 }
 result.preflight=prepared.map(t=>({loginId:t.id,alias:t.alias,company:t.company,cId:t.cId,roleCode:t.role,group:t.group,ugCode:t.ugCode,existing:!!t.existing,mediaGroups:t.media}));
 return prepared;
}
async function main(){
 if(process.argv.slice(2).join()==='--enroll-interactive'){await interactiveEnrollment();return;}
 if(process.argv.slice(2).join()==='--check-enrollment'){await enrollmentReady();console.log('Exact new-role enrollment capabilities verified; no writes performed.');return;}
 const args=process.argv.slice(2);ensure(args.length>=3&&['--inspect','--register','--register-extension-only'].includes(args[0])&&args[1]==='--run','usage: --inspect --run <registered-run> | --register[-extension-only] --run <registered-run> --request <public-json> --confirm-external-write');
 ensure(args[0]==='--inspect'?args.length===3:args.length===6&&args[3]==='--request'&&args[5]==='--confirm-external-write','explicit registration guard required before authentication');
 const run=path.resolve(args[2]);ensure(path.dirname(run)===ROOT+'/runs'&&/^EV-\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(path.basename(run)),'external registered run required');const reg=JSON.parse(await fs.readFile(ROOT+'/registry/'+path.basename(run)+'.json'));ensure(reg.state==='active','active evidence run required');
 const output=path.join(run,'baro-accounts');await fs.mkdir(output,{mode:0o700,recursive:true});const save=()=>fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2),{mode:0o600});
 try{
  stage='normal-administrator-login-and-preflight';const prepared=await inspect();await save();
  if(args[0]==='--inspect'){result.status='preflight-passed';return;}
  ensure(args.length===6&&args[3]==='--request'&&args[5]==='--confirm-external-write','explicit registration guard required');
  const request=validateRequest(JSON.parse(await fs.readFile(args[4],'utf8')));ensure(request.origin===DEV,'import request origin differs');
  // Enrollment is performed only after observing this exact request download in the
  // installed Chrome extension. An arbitrary caller-chosen key is not an export API.
  const destinationRaw=await protectedRead(DESTINATION);let destination;try{destination=JSON.parse(destinationRaw);}finally{destinationRaw.fill(0);}
  ensure(exact(destination,['version','extensionId','origin','requestId','requestSha256','expires','run'])&&destination.version===1&&destination.extensionId===EXTENSION_ID&&destination.origin===DEV&&destination.requestId===request.id&&destination.expires===request.expires&&destination.run===run&&destination.requestSha256===createHash('sha256').update(await fs.readFile(args[4])).digest('hex'),'actual Chrome recipient request has not been reviewed/pinned');
  const extensionOnly=args[0]==='--register-extension-only';
  stage='credential-destination';
  // Once enrolled, ordinary runs use only their existing scoped read identities.
  let enrolled=true;for(const t of targets){try{await fs.lstat(path.join(IDENTITY_ROOT,t.service+'-approle.json'));}catch(e){if(e.code!=='ENOENT')throw e;enrolled=false;}}
  if(!extensionOnly&&!enrolled)await enrollmentReady();
  // All credential destinations must work before any BARO account is created.
  ensure(!extensionOnly||prepared.every(t=>!t.existing),'extension-only generation requires all three IDs to be new; existing accounts preserved');
  const credentials=[];for(const t of prepared)credentials.push(extensionOnly?{account:t.id,password:passwordFor(t.id)}:enrolled?await scoped(t):await enroll(t));
  const source=await fs.readFile(STORE);ensure(createHash('sha256').update(source).digest('hex')===STORE_SHA,'reviewed web-key source changed');const modulus=source.toString().match(/alpha:\s*\{\s*PUBLICKEYMODULUS:\s*"([a-f0-9]+)"/)[1];
  // Confirm the actual login-page JS contains this reviewed development public key.
  const page=ctx.pages()[0],scripts=await page.locator('script[src],link[rel="modulepreload"][href]').evaluateAll(nodes=>nodes.map(n=>n.src||n.href));let deployed=false;for(const url of scripts){if(new URL(url).origin!==DEV)continue;const r=await ctx.request.get(url,{maxRedirects:0,timeout:15000});if(r.ok()&&(await r.text()).includes(modulus))deployed=true;}ensure(deployed,'deployed fixed web RSA key not proven; no account save');
  const key=createPublicKey({key:{kty:'RSA',n:Buffer.from(modulus,'hex').toString('base64url'),e:'AQAB'},format:'jwk'});
  const ipResponse=await fetch('https://api.ipify.org',{redirect:'error',signal:AbortSignal.timeout(15000)}),ip=(await ipResponse.text()).trim();ensure(ipResponse.ok&&/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)&&ip.split('.').every(n=>+n<=255),'public IPv4 unavailable');
  if(extensionOnly){
   // The user explicitly selected this Chrome vault as the destination for these
   // disposable DEV credentials. Persist there BEFORE the first BARO account save.
   stage='awaiting-actual-extension-storage';
   const envelope=await sealTransfer(request,prepared.map((t,i)=>({alias:t.alias,username:credentials[i].account,password:credentials[i].password})));
   const filename=path.join(output,'account-import.encrypted.json');await fs.writeFile(filename,JSON.stringify(envelope),{mode:0o600,flag:'wx'});
   result.credentialDestination='user-authorized-chrome-extension-vault';result.encryptedImport=filename;result.status='awaiting-extension-storage';await save();
   console.log(JSON.stringify({status:result.status,encryptedImport:filename,requestId:request.id}));
   await new Promise((resolve,reject)=>{const input=createInterface({input:process.stdin});const timer=setTimeout(()=>{input.close();reject(Error('extension storage confirmation timed out; no BARO save performed'));},600000);input.once('line',line=>{clearTimeout(timer);if(line.trim()==='EXTENSION_STORED '+request.id)resolve();else reject(Error('actual Chrome storage confirmation rejected; no BARO save performed'));input.close();});input.once('close',()=>{clearTimeout(timer);reject(Error('extension storage confirmation missing; no BARO save performed'));});});
   result.extensionStorageConfirmed=true;await save();
  }
  for(let i=0;i<prepared.length;i++){
   const t=prepared[i],a=credentials[i];let uIdx=t.existing?.uIdx;
   stage='register-'+t.key;
   if(!uIdx){const raw=Buffer.from(a.password);let uPwd;try{uPwd=publicEncrypt({key,padding:constants.RSA_PKCS1_PADDING},raw).toString('hex');}finally{raw.fill(0);}const reply=await post('/api/account/user/jsonSave.do',{uId:t.id,uPwd,uName:t.name,uMail:t.id+'@example.invalid',uPhone:t.phone,uLdapFlag:0,cId:t.cId,roleCd:t.role,ugCode:t.ugCode,uStatus:1,magIdxList:t.media.map(m=>m.id)},true);uIdx=Number(reply?.uIdx??reply);if(!Number.isSafeInteger(uIdx)||uIdx<1){const found=rows(await post('/api/account/user/jsonList.do',{uId:t.id,pagination:{page:1,lineSize:100}}));ensure(found.length===1,'save may have committed; do not repeat');uIdx=Number(found[0].uIdx);}}
   ensure(Number.isSafeInteger(Number(uIdx))&&Number(uIdx)>0,'saved account identifier invalid; do not repeat save');uIdx=Number(uIdx);
   const record={loginId:t.id,alias:t.alias,uIdx,cId:t.cId,roleCode:t.role,ugCode:t.ugCode,status:'account-saved',reused:!!t.existing};result.accounts.push(record);await save();
   const detail=await post('/api/account/user/jsonDetail.do',{uIdx});ensure(detail.userData.cId===t.cId&&String(detail.userData.roleCd)===t.role&&detail.userData.ugCode===t.ugCode,'account detail readback mismatch');
   let ips=rows(await post('/api/account/user/allowed/ip/list',{uIdx}));if(!ips.length){ensure(!t.existing,'existing account IP is not modified');await post('/api/account/user/allowed/ip/save',{uIdx,allowedIp:ip},true);ips=rows(await post('/api/account/user/allowed/ip/list',{uIdx}));}ensure(ips.some(x=>Number(x.useSt??1)===1),'active allowed IP missing');
   record.status='registered-and-readback';record.allowedIpCount=ips.length;await save();
   const session=await login(a,{role:t.role,cId:t.cId});record.normalLogin=true;record.attempts=session.attempts;record.programCount=session.user.programIdList?.length??0;// Login response role/company is the API proof; actual rendered UI is checked separately in Chrome.
   await session.context.close();record.status='normal-login-verified';await save();
  }
  if(!extensionOnly){stage='encrypted-extension-transfer';const envelope=await sealTransfer(request,[{alias:'관리자',username:adminSecret.account,password:adminSecret.password},...prepared.map((t,i)=>({alias:t.alias,username:credentials[i].account,password:credentials[i].password}))]);await fs.writeFile(path.join(output,'account-import.encrypted.json'),JSON.stringify(envelope),{mode:0o600,flag:'wx'});result.encryptedImport=path.join(output,'account-import.encrypted.json');}credentials.forEach(a=>a.password='');result.status='registered-and-normal-login-verified';
 }catch(e){result.failureStage=stage;result.reason=e.message;throw e;}finally{adminSecret&&(adminSecret.password='');await browser?.close();result.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(result));}
}
main().catch(e=>{if(process.argv.includes('--enroll-interactive')||process.argv.includes('--check-enrollment'))console.error(e.message);process.exitCode=1;});
