import {salt,exportKey,importKey,encrypt,decrypt} from './core.js';
// The browser profile owns the key. No master password or timed/session lock.
export async function browserKey() {
  const {vault,deviceKey}=await chrome.storage.local.get(['vault','deviceKey']);
  if(deviceKey)return importKey(deviceKey);
  if(vault){
    // One-time upgrade of an already-open legacy vault; credentials never leave trusted contexts.
    const {unlock}=await chrome.storage.session.get('unlock');
    if(!unlock?.key)throw new Error('기존 계정의 변환 키가 없습니다. 기존 확장에서 보관함을 연 상태로 설정 화면을 새로고침하세요.');
    const key=await importKey(unlock.key);await decrypt(vault,key);
    await chrome.storage.local.set({deviceKey:await exportKey(key)});return key;
  }
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  await chrome.storage.local.set({deviceKey:await exportKey(key),vault:await encrypt({sites:[]},key,salt())});return key;
}
