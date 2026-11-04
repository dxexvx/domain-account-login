import test from 'node:test';
import assert from 'node:assert/strict';
import {fillAndSubmit} from '../login.js';
import {originOf,validateSite,floatingLayout,metadata,salt,encrypt,decrypt} from '../core.js';
// DAL-01: credentials must remain bound to the explicitly allowed origin.
test('exact origins, safe schemes and login URL boundary',()=>{
  assert.equal(originOf('example.com/login'),'https://example.com');
  assert.equal(originOf('http://localhost:8765'),'http://localhost:8765');
  for(const url of ['javascript:alert(1)','https://user:pass@example.com','https://*.example.com','http://example.com']) assert.throws(()=>originOf(url));
  assert.throws(()=>validateSite({origin:'https://a.example',loginUrl:'https://b.example/login',selectors:{}}));
});
// DAL-02: password ciphertext rejects wrong keys and tampering.
test('encrypted vault roundtrip and wrong-key/tamper rejection',async()=>{
  const s=salt(),k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']),value={sites:[{password:'synthetic-only-password'}]};
  const vault=await encrypt(value,k,s);assert(!JSON.stringify(vault).includes(value.sites[0].password));assert.deepEqual(await decrypt(vault,k),value);
  const wrong=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);await assert.rejects(()=>decrypt(vault,wrong));
  vault.ciphertext='A'+vault.ciphertext.slice(1);await assert.rejects(()=>decrypt(vault,k));
});
test('page metadata contains aliases and IDs only',()=>{
  const m=metadata({id:'s',origin:'https://example.com',selectors:{submit:'#submit'},accounts:[{id:'a',alias:'테스트',username:'private-id',password:'private-pass'}]});
  assert.deepEqual(m.accounts,[{id:'a',alias:'테스트'}]);assert(!JSON.stringify(m).includes('private-'));
});

// DAL-05: a navigation between tab validation and injection must not fill credentials.
test('injected login rejects an origin change before touching DOM',async()=>{
 globalThis.location={origin:'https://unexpected.example'};
 try {const result=await fillAndSubmit('https://allowed.example',{},'fixture','synthetic-only');assert.match(result.error,/대상 주소가 변경/);assert.equal(result.submitted,undefined);}
 finally {delete globalThis.location;}
});

// DAL-10: page layout accepts only bounded coordinates and a boolean state.
test('floating layout validates bounds and drops unrelated fields',()=>{
 assert.deepEqual(floatingLayout({x:0,y:1,expanded:false,extra:'discard'}),{x:0,y:1,expanded:false});
 for(const v of [null,{}, {x:NaN,y:0,expanded:true},{x:Infinity,y:0,expanded:true},{x:-.1,y:0,expanded:true},{x:0,y:1.1,expanded:true},{x:0,y:0,expanded:1}])assert.throws(()=>floatingLayout(v));
 const s=validateSite({origin:'https://example.com',selectors:{username:'#u',password:'#p',submit:'#s'},floating:{x:.2,y:.3,expanded:true}});assert.deepEqual(metadata(s).floating,s.floating);
});

// DAL-12: preserve an already-open legacy ciphertext across the browser-key migration.
test('legacy open vault migrates without exposing or replacing its encrypted accounts',async()=>{
 const {browserKey}=await import('../vault.js');
 const {exportKey}=await import('../core.js');
 const original=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
 const value={sites:[{accounts:[{alias:'기존 계정',password:'synthetic-legacy-only'}]}]},vault=await encrypt(value,original,salt());
 const local={vault},session={unlock:{key:await exportKey(original),expires:1}};
 const area=state=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,state[k]])),set:async values=>Object.assign(state,values)});
 globalThis.chrome={storage:{local:area(local),session:area(session)}};
 try{await browserKey();assert.deepEqual(local.vault,vault);assert(!JSON.stringify(local.vault).includes('synthetic-legacy-only'));delete session.unlock;assert.deepEqual(await decrypt(local.vault,await browserKey()),value);}
 finally{delete globalThis.chrome;}
});
test('a missing legacy key never overwrites existing encrypted accounts',async()=>{
 const {browserKey}=await import('../vault.js');const existing={version:1,ciphertext:'preserve'};
 let wrote=false;globalThis.chrome={storage:{local:{get:async()=>({vault:existing}),set:async()=>{wrote=true;}},session:{get:async()=>({})}}};
 try{await assert.rejects(()=>browserKey());assert.equal(wrote,false);assert.equal(existing.ciphertext,'preserve');}finally{delete globalThis.chrome;}
});
