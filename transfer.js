// An options-only, short-lived transport. Passwords never appear in the request or result.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const fail=()=>{throw new Error('가져오기 파일이 유효하지 않거나 요청이 만료됐습니다. 새 요청으로 다시 시작하세요.');};
const b64=buffer=>{const value=new Uint8Array(buffer);let binary='';for(let i=0;i<value.length;i+=8192)binary+=String.fromCharCode(...value.subarray(i,i+8192));return btoa(binary);};
function bytes(text,max){if(typeof text!=='string'||text.length>max||!(/^[A-Za-z0-9+/]*={0,2}$/.test(text)))fail();try{return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}catch{fail();}}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===keys.slice().sort().join();}
function origin(value){try{const u=new URL(value);if(u.origin!==value||!['https:','http:'].includes(u.protocol))fail();return value;}catch{fail();}}
export function validateRequest(r,now=Date.now()) {
  if(!exact(r,['version','id','origin','expires','publicKey'])||r.version!==1||!(/^[a-f0-9-]{36}$/.test(r.id))||!Number.isSafeInteger(r.expires)||r.expires<=now||r.expires>now+10*60*1000+5000)fail();
  origin(r.origin);if(r.publicKey?.kty!=='RSA'||r.publicKey.e!=='AQAB'||typeof r.publicKey.n!=='string'||r.publicKey.d)fail();
  return r;
}
const aad=r=>encoder.encode(JSON.stringify({version:1,id:r.id,origin:r.origin,expires:r.expires}));
export async function createTransfer(originValue,siteId,now=Date.now()) {
  origin(originValue);
  const keys=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
  const request={version:1,id:crypto.randomUUID(),origin:originValue,expires:now+10*60*1000,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};
  return {request,siteId,privateKey:await crypto.subtle.exportKey('jwk',keys.privateKey)};
}
export function validateAccounts(accounts,existing=[]) {
  if(!Array.isArray(accounts)||accounts.length<1||accounts.length>20)fail();
  const aliases=new Set(existing.map(a=>a.alias)),users=new Set(existing.map(a=>a.username));
  return accounts.map(a=>{
    if(!exact(a,['alias','username','password'])||!['alias','username','password'].every(k=>typeof a[k]==='string'&&a[k].trim()&&!/[\x00-\x1f\x7f]/.test(a[k]))||a.alias!==a.alias.trim()||a.username!==a.username.trim()||a.alias.length>80||a.username.length>500||a.password.length>1000)fail();
    if(aliases.has(a.alias)||users.has(a.username))throw new Error('별칭 또는 로그인 아이디가 중복됩니다. 기존 계정은 변경하지 않았습니다.');
    aliases.add(a.alias);users.add(a.username);return {...a};
  });
}
export async function sealTransfer(request,accounts,now=Date.now()) {
  validateRequest(request,now);validateAccounts(accounts);
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const raw=new Uint8Array(await crypto.subtle.exportKey('raw',key)),plain=encoder.encode(JSON.stringify({accounts}));
  try{
    const pub=await crypto.subtle.importKey('jwk',request.publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
    return {version:1,id:request.id,origin:request.origin,expires:request.expires,iv:b64(iv),wrappedKey:b64(await crypto.subtle.encrypt({name:'RSA-OAEP',label:aad(request)},pub,raw)),ciphertext:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(request)},key,plain))};
  }finally{raw.fill(0);plain.fill(0);}
}
export async function openTransfer(envelope,pending,existing=[],now=Date.now()) {
  if(!pending?.request)fail();const request=validateRequest(pending.request,now);
  if(!exact(envelope,['version','id','origin','expires','iv','wrappedKey','ciphertext'])||['version','id','origin','expires'].some(k=>envelope[k]!==request[k]))fail();
  const iv=bytes(envelope.iv,20),wrapped=bytes(envelope.wrappedKey,600),ciphertext=bytes(envelope.ciphertext,250000);
  if(iv.length!==12||wrapped.length!==384||ciphertext.length<16)fail();
  let raw,plain;
  try{
    const priv=await crypto.subtle.importKey('jwk',pending.privateKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
    raw=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP',label:aad(request)},priv,wrapped));
    const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
    plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(request)},key,ciphertext));
    const payload=JSON.parse(decoder.decode(plain));if(!exact(payload,['accounts']))fail();return validateAccounts(payload.accounts,existing);
  }catch{fail();}finally{raw?.fill(0);plain?.fill(0);}
}
