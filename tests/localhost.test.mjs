// DAL-19 / idea 61567: a single source vault may serve localhost at every port.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import {sealBackup,openBackup,mergeBackup} from '../backup.js';
import {fillAndSubmit} from '../login.js';
const source=()=>core.validateSite({id:'baro',origin:'https://baropro.vrixon.com',loginUrl:'https://baropro.vrixon.com/login?next=work#form',selectors:{username:'#user',password:'#pass',submit:'#submit'},shareOnLocalhost:true,accounts:[{id:'a',alias:'검증 계정',username:'fixture',password:'synthetic-only'}]});
test('localhost shares source accounts while login and return stay on the current port',()=>{
 const s=source();assert.deepEqual(s.additionalDomains,['localhost:*']);assert.equal(s.shareOnLocalhost,undefined);
 for(const origin of ['http://localhost:3000','http://localhost:5173','https://localhost:8443']){
  const effective=core.siteForPage([s],origin+'/work');
  assert.equal(effective.id,s.id);assert.equal(effective.accounts,s.accounts);
  assert.equal(effective.origin,origin);assert.equal(effective.loginUrl,origin+'/login?next=work#form');
 }
 assert.deepEqual(core.sitePatterns(s),['https://baropro.vrixon.com/*','http://localhost/*','https://localhost/*']);
});
test('sharing is opt-in, localhost-only, unambiguous and below an exact site',()=>{
 const s=source(),off={...s,additionalDomains:[]};
 for(const value of ['http://127.0.0.1:3000','https://localhost.example','https://other.example'])assert.equal(core.siteForPage([s],value),undefined);
 assert.equal(core.siteForPage([off],'http://localhost:3000'),undefined);
 const local=core.validateSite({...off,id:'local',origin:'http://localhost:3000',loginUrl:'http://localhost:3000/own'});
 assert.equal(core.siteForPage([s,local],'http://localhost:3000').id,'local');
 assert.throws(()=>core.validateSharing([s,{...s,id:'other',origin:'https://other.example'}]));
 assert.throws(()=>core.validateSite({...s,shareOnLocalhost:'true'}));
 assert.equal(core.siteForPage([s],'https://baropro.vrixon.com').origin,s.origin);
});
test('backup preserves sharing and refuses conflicting source domains before merging',async()=>{
 const s=source(),password='synthetic-backup-only';
 const restored=await openBackup(await sealBackup([s],password),password);
 assert.deepEqual(restored[0].additionalDomains,['localhost:*']);
 assert.equal(core.siteForPage(mergeBackup([],restored).sites,'http://localhost:9876').accounts.length,1);
 assert.throws(()=>mergeBackup([s],[{...s,id:'other',origin:'https://other.example',loginUrl:'https://other.example/login'}]));
 const existing={...s,additionalDomains:[]};assert.deepEqual(mergeBackup([existing],restored).sites[0].additionalDomains,[]);
});
test('a localhost port change before injection cannot fill the shared credentials',async()=>{
 globalThis.location={origin:'http://localhost:5173',href:'http://localhost:5173/login'};
 try{const result=await fillAndSubmit('http://localhost:3000',{},'fixture','synthetic-only');assert.match(result.error,/대상 주소가 변경/);assert.equal(result.submitted,undefined);}
 finally{delete globalThis.location;}
});
