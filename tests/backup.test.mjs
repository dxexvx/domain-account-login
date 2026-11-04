import test from 'node:test';
import assert from 'node:assert/strict';
import {sealBackup,openBackup,mergeBackup,normalizeBackup} from '../backup.js';
const fixture=()=>[{origin:'https://example.com',loginUrl:'https://example.com/login',selectors:{username:'#u',password:'#p',submit:'button',logout:'.logout'},floating:{x:.2,y:.6,expanded:false},accounts:[{alias:'관리자',username:'synthetic-id',password:'synthetic-secret'}]}];
const password='synthetic-backup-only';
// DAL-13: a portable file must recover all fields without the source profile key.
test('backup roundtrip, randomized encryption and no plaintext credentials',async()=>{
 const sites=fixture(),a=await sealBackup(sites,password),b=await sealBackup(sites,password);
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext);
 assert(!JSON.stringify(a).includes('synthetic-'));assert(!JSON.stringify(a).includes('example.com'));
 assert.deepEqual(await openBackup(a,password),sites);
 await assert.rejects(()=>openBackup(a,'wrong-backup-password'));
 await assert.rejects(()=>openBackup({...a,ciphertext:(a.ciphertext[0]==='A'?'B':'A')+a.ciphertext.slice(1)},password));
 await assert.rejects(()=>openBackup({...a,iterations:1},password));
 await assert.rejects(()=>sealBackup(sites,'short'));
});
test('backup validation rejects unsafe or partial data before a merge',()=>{
 for(const change of [s=>s[0].origin='http://unsafe.example',s=>s[0].loginUrl='https://other.example',s=>s[0].accounts[0].password='',s=>s[0].floating.x=2,s=>s.push(structuredClone(s[0]))]){
  const sites=fixture();change(sites);assert.throws(()=>normalizeBackup(sites));
 }
 assert.throws(()=>normalizeBackup([]));assert.throws(()=>normalizeBackup(Array(101).fill(fixture()[0])));
 const malicious=fixture();malicious[0].deviceKey='discard';malicious[0].accounts[0].id='discard';
 const clean=normalizeBackup(malicious);assert.equal(clean[0].deviceKey,undefined);assert.equal(clean[0].accounts[0].id,undefined);
 const spaced=fixture();spaced[0].accounts[0].password='  ';assert.equal(normalizeBackup(spaced)[0].accounts[0].password,'  ','saved password bytes are preserved');
});
test('merge preserves existing settings/passwords/IDs and skips repeated usernames',()=>{
 const existing=fixture();existing[0].id='site-kept';existing[0].accounts[0].id='account-kept';
 const imported=fixture();imported[0].loginUrl='https://example.com/changed';imported[0].accounts[0].password='different-synthetic-secret';
 imported[0].accounts.push({alias:'새 계정',username:'synthetic-new',password:'synthetic-new-secret'});
 const other=fixture()[0];other.origin='https://other.example';other.loginUrl=other.origin+'/login';imported.push(other);
 const before=structuredClone(existing),r=mergeBackup(existing,imported);
 assert.deepEqual(existing,before);assert.equal(r.accountsAdded,2);assert.equal(r.accountsSkipped,1);assert.equal(r.domainsAdded,1);
 assert.equal(r.sites[0].id,'site-kept');assert.equal(r.sites[0].loginUrl,before[0].loginUrl);assert.deepEqual(r.sites[0].accounts[0],before[0].accounts[0]);
 assert.notEqual(r.sites[1].id,'site-kept');assert(r.sites[1].accounts[0].id);
 const repeat=mergeBackup(r.sites,imported);assert.equal(repeat.accountsAdded,0);assert.equal(repeat.accountsSkipped,3);
});
