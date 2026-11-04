import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTransfer,sealTransfer,openTransfer,validateAccounts,validateRequest} from '../transfer.js';
const fixture=[{alias:'관리자',username:'synthetic-admin',password:'synthetic-only-fixture'}];
test('domain-bound round trip returns accounts only after authenticated decryption',async()=>{
 const pending=await createTransfer('https://example.com','site');
 const encrypted=await sealTransfer(pending.request,fixture);
 assert.deepEqual(await openTransfer(encrypted,pending),fixture);
 for(const value of Object.values(fixture[0]))assert(!JSON.stringify(encrypted).includes(value));
 assert(!JSON.stringify(pending.request).includes('privateKey'));assert(!pending.request.publicKey.d);
});
test('origin, request, expiry and ciphertext tampering fail closed',async()=>{
 const pending=await createTransfer('https://example.com','site'),encrypted=await sealTransfer(pending.request,fixture);
 for(const change of [{origin:'https://other.example'},{id:crypto.randomUUID()},{expires:encrypted.expires+1},{ciphertext:encrypted.ciphertext.slice(0,-4)+'AAAA'}])await assert.rejects(()=>openTransfer({...encrypted,...change},pending));
 await assert.rejects(()=>openTransfer(encrypted,pending,[],pending.request.expires));
 await assert.rejects(()=>openTransfer(encrypted,undefined));
});
test('a second private key cannot decrypt a valid envelope',async()=>{
 const pending=await createTransfer('https://example.com','site'),other=await createTransfer('https://example.com','site');
 const encrypted=await sealTransfer(pending.request,fixture);
 await assert.rejects(()=>openTransfer(encrypted,{...pending,privateKey:other.privateKey}));
});
test('batch rejects duplicate aliases, users, existing accounts and unexpected fields',()=>{
 for(const data of [[...fixture,...fixture],[...fixture,{...fixture[0],alias:'다른 별칭'}],[{...fixture[0],id:'overwrite'}],[],Array(21).fill(fixture[0])])assert.throws(()=>validateAccounts(data));
 assert.throws(()=>validateAccounts(fixture,fixture));assert.throws(()=>validateAccounts([{...fixture[0],password:'bad\nvalue'}]));
});
test('request validation rejects wrong origin shape, expired and excessive lifetime',async()=>{
 const {request}=await createTransfer('https://example.com','site');
 for(const change of [{origin:'https://example.com/path'},{expires:Date.now()-1},{expires:Date.now()+3600000},{publicKey:{...request.publicKey,d:'secret'}}])assert.throws(()=>validateRequest({...request,...change}));
});
