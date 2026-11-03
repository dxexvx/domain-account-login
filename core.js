export function originOf(value) {
  const url = new URL(value.includes('://') ? value : `https://${value}`);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hostname.includes('*')) throw new Error('http 또는 https의 정확한 도메인을 입력하세요.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('외부 사이트는 https 주소를 사용하세요. http는 로컬 테스트에서만 허용합니다.');
  return url.origin;
}
export function floatingLayout(value) {
  if(!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x<0 || value.x>1 || value.y<0 || value.y>1 || typeof value.expanded!=='boolean') throw new Error('버튼 위치가 올바르지 않습니다.');
  return {x:value.x,y:value.y,expanded:value.expanded};
}
export function validateSite(site) {
  const origin = originOf(site.origin);
  const url = new URL(site.loginUrl || origin);
  if (url.origin !== origin || url.username || url.password) throw new Error('로그인 주소와 허용 도메인이 같아야 합니다.');
  for (const field of ['username', 'password', 'submit']) {
    if (typeof site.selectors?.[field] !== 'string' || site.selectors[field].length > 1000) throw new Error('로그인 요소 설정이 올바르지 않습니다.');
  }
  if(site.selectors.logout!==undefined && (typeof site.selectors.logout!=='string' || site.selectors.logout.length>1000))throw new Error('로그아웃 요소 설정이 올바르지 않습니다.');
  return {id: site.id || crypto.randomUUID(), origin, loginUrl: url.href, selectors: site.selectors, accounts: site.accounts || [], ...(site.floating?{floating:floatingLayout(site.floating)}:{})};
}
export function metadata(site) {
  return {id:site.id, origin:site.origin, selectors:site.selectors, floating:site.floating?floatingLayout(site.floating):{x:1,y:.35,expanded:true}, accounts:site.accounts.map(({id,alias})=>({id,alias}))};
}
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes = text => Uint8Array.from(atob(text), ch=>ch.charCodeAt(0));
export const salt = () => b64(crypto.getRandomValues(new Uint8Array(16)));
export const exportKey = async key => b64(await crypto.subtle.exportKey('raw', key));
export const importKey = raw => crypto.subtle.importKey('raw', bytes(raw), 'AES-GCM', true, ['encrypt','decrypt']);
export async function encrypt(data,key,saltValue) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(data)));
  return {version:1,salt:saltValue,iv:b64(iv),ciphertext:b64(ciphertext)};
}
export async function decrypt(vault,key) {
  if(vault.version!==1) throw new Error('지원하지 않는 보관함 버전입니다.');
  try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(vault.iv)},key,bytes(vault.ciphertext)))); }
  catch { throw new Error('보관함을 열 수 없습니다. 비밀번호를 확인하세요.'); }
}
