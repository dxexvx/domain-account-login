import {originOf,validateSite} from './core.js';

export const MAX_BACKUP_BYTES=5*1024*1024;
const FORMAT='domain-account-login-backup',ITERATIONS=310000;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const aad=encoder.encode(JSON.stringify({format:FORMAT,version:1,iterations:ITERATIONS}));
const invalid=()=>{throw new Error('지원하는 계정 백업 파일이 아닙니다.');};
const b64=value=>{const bytes=new Uint8Array(value);let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
function bytes(value,length){
 if(typeof value!=='string'||value.length>MAX_BACKUP_BYTES||!(/^[A-Za-z0-9+/]*={0,2}$/.test(value)))invalid();
 let result;try{result=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{invalid();}
 if((length&&result.length!==length)||b64(result)!==value)invalid();return result;
}
async function derive(password,salt){
 if(typeof password!=='string'||password.length<10||password.length>1024)throw new Error('백업 암호는 10자 이상 1,024자 이하로 입력하세요.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function normalizeBackup(sites){
 if(!Array.isArray(sites)||!sites.length||sites.length>100)invalid();
 const origins=new Set();let total=0;
 return sites.map(source=>{
  if(!source||typeof source.origin!=='string'||originOf(source.origin)!==source.origin||origins.has(source.origin))invalid();
  origins.add(source.origin);
  if(!Array.isArray(source.accounts)||(total+=source.accounts.length)>5000)invalid();
  const selectors={};for(const field of ['username','password','submit','logout']){
   const value=source.selectors?.[field];if(field==='logout'&&value===undefined)continue;
   if(typeof value!=='string'||value.length>1000)invalid();selectors[field]=value;
  }
  const accounts=source.accounts.map(a=>{
   if(!a||!['alias','username'].every(f=>typeof a[f]==='string'&&a[f].trim())||typeof a.password!=='string'||!a.password.length||a.alias.length>80||a.username.length>500||a.password.length>1000)invalid();
   return {alias:a.alias.trim(),username:a.username,password:a.password};
  });
  const site=validateSite({origin:source.origin,loginUrl:source.loginUrl,selectors,accounts,...(source.floating?{floating:source.floating}:{})});
  const {id,...portable}=site;return portable;
 });
}
export async function sealBackup(sites,password){
 const plain=encoder.encode(JSON.stringify({sites:normalizeBackup(sites)}));
 if(plain.length>3*1024*1024)throw new Error('백업이 너무 큽니다. 도메인을 나눠 내보내세요.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plain);
 return {format:FORMAT,version:1,iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};
}
export async function openBackup(envelope,password){
 if(!envelope||envelope.format!==FORMAT||envelope.version!==1||envelope.iterations!==ITERATIONS||JSON.stringify(envelope).length>MAX_BACKUP_BYTES)invalid();
 const salt=bytes(envelope.salt,16),iv=bytes(envelope.iv,12),ciphertext=bytes(envelope.ciphertext);
 if(ciphertext.length<16)invalid();const key=await derive(password,salt);
 let plain;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,ciphertext);}
 catch{throw new Error('백업 암호가 다르거나 파일이 손상됐습니다. 기존 계정은 변경하지 않았습니다.');}
 let value;try{value=JSON.parse(decoder.decode(plain));}catch{invalid();}
 return normalizeBackup(value?.sites);
}
export function mergeBackup(existing,imported){
 const sites=structuredClone(existing);let domainsAdded=0,accountsAdded=0,accountsSkipped=0;
 for(const source of normalizeBackup(imported)){
  let site=sites.find(s=>s.origin===source.origin);
  if(!site){site={...source,id:crypto.randomUUID(),accounts:[]};sites.push(site);domainsAdded++;}
  const users=new Set(site.accounts.map(a=>a.username));
  for(const account of source.accounts){
   if(users.has(account.username)){accountsSkipped++;continue;}
   users.add(account.username);site.accounts.push({...account,id:crypto.randomUUID()});accountsAdded++;
  }
 }
 return {sites,domainsAdded,accountsAdded,accountsSkipped};
}
