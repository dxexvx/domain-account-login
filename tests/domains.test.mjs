// DAL-20 / idea 61570: one account group, explicit child domains and a shared path.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import {sealBackup,openBackup,mergeBackup} from '../backup.js';
const fixture=()=>({id:'source',origin:'https://main.example',loginUrl:'https://main.example/login?next=work#form',additionalDomains:['https://dev.example','http://localhost:3000','localhost:*'],selectors:{username:'#u',password:'#p',submit:'#s'},floating:{x:.3,y:.4,expanded:true},accounts:[{id:'account',alias:'검증 계정',username:'fixture',password:'synthetic-only'}]});

test('several explicit domains use the same accounts and the current origin login path',()=>{
 const s=core.validateSite(fixture());
 for(const origin of ['https://main.example','https://dev.example','http://localhost:3000','http://localhost:5173','https://localhost:8443']){
  const effective=core.siteForPage([s],origin+'/work');assert(effective,'registered child domain must resolve');
  assert.equal(effective.id,s.id);assert.equal(effective.accounts,s.accounts);assert.equal(effective.origin,origin);assert.equal(effective.loginUrl,origin+'/login?next=work#form');
 }
 for(const origin of ['https://child.dev.example','https://dev.example:8443','http://127.0.0.1:3000','https://localhost.example'])assert.equal(core.siteForPage([s],origin),undefined);
 assert.deepEqual(core.sitePatterns(s),['https://main.example/*','https://dev.example/*','http://localhost:3000/*','http://localhost/*','https://localhost/*']);
});
test('login paths accept path/query/hash and reject credentials or a different origin',()=>{
 const s=core.validateSite({...fixture(),loginUrl:'/login?from=local#form'});assert.equal(s.loginUrl,'https://main.example/login?from=local#form');
 assert.equal(core.loginPathOf(s),'/login?from=local#form');
 for(const loginUrl of ['//other.example/login','/\\other.example/login','https://other.example/login','https://user:pass@main.example/login','https://main.example//other.example/login',17])assert.throws(()=>core.validateSite({...fixture(),loginUrl}));
});
test('child domains reject ambiguous, broad, unsafe and duplicate registrations',()=>{
 for(const additionalDomains of [['https://*.example'],['https://dev.example/path'],['http://dev.example'],['https://u:p@dev.example'],['https://main.example'],['https://dev.example','https://dev.example/'],['*.example'],'https://dev.example',Array(101).fill('https://dev.example')])assert.throws(()=>core.validateSite({...fixture(),additionalDomains}));
 const a=core.validateSite(fixture());
 for(const additionalDomains of [['https://dev.example'],['localhost:*'],['http://localhost:*']])assert.throws(()=>core.validateSharing([a,core.validateSite({...fixture(),id:'other',origin:'https://other.example',loginUrl:'/login',additionalDomains})]));
 assert.throws(()=>core.validateSharing([a,core.validateSite({...fixture(),id:'other',origin:'https://dev.example',loginUrl:'/login',additionalDomains:[]})]));
 const exact=core.validateSite({...fixture(),id:'local',origin:'http://localhost:3000',loginUrl:'/own',additionalDomains:[]});
 const wildcard=core.validateSite({...a,additionalDomains:['https://dev.example','localhost:*']});
 core.validateSharing([wildcard,exact]);assert.equal(core.siteForPage([wildcard,exact],'http://localhost:3000/work').id,'local');
});
test('legacy opt-in migrates to an editable entry and removing it cannot resurrect sharing',()=>{
 const legacy={...fixture(),additionalDomains:undefined,shareOnLocalhost:true},s=core.validateSite(legacy);
 assert.deepEqual(s.additionalDomains,['localhost:*']);assert.equal(s.shareOnLocalhost,undefined);
 assert.equal(s.id,legacy.id);assert.deepEqual(s.accounts,legacy.accounts);assert.deepEqual(s.floating,legacy.floating);assert.deepEqual(s.selectors,legacy.selectors);
 const removed=core.validateSite({...s,additionalDomains:[]});assert.equal(core.siteForPage([removed],'http://localhost:3000'),undefined);
 assert.equal(core.siteForPage([core.validateSite(removed)],'http://localhost:3000'),undefined);
 assert.throws(()=>core.validateSite({...legacy,shareOnLocalhost:'true'}));
});
test('backup carries child domains, preserves existing settings and refuses collisions without mutation',async()=>{
 const s=core.validateSite(fixture()),password='synthetic-backup-only';
 const restored=await openBackup(await sealBackup([s],password),password);assert.deepEqual(restored[0].additionalDomains,s.additionalDomains);
 const merged=mergeBackup([],restored);assert.equal(core.siteForPage(merged.sites,'https://dev.example').accounts.length,1);
 const existing=core.validateSite({...s,additionalDomains:['https://kept.example']}),before=structuredClone(existing);
 assert.deepEqual(mergeBackup([existing],restored).sites[0],before);
 assert.throws(()=>mergeBackup([s],[{...s,origin:'https://other.example',loginUrl:'/login'}]));assert.deepEqual(s,core.validateSite(fixture()));
});
