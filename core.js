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
// Child domains are exact origins. Only localhost may explicitly cover all ports.
export function additionalDomainOf(value) {
  if(typeof value!=='string'||!value.trim()||value.length>2000)throw new Error('추가 도메인을 입력하세요.');
  value=value.trim();
  if(/^(?:(?:http|https):\/\/)?localhost:\*\/?$/.test(value))return value.replace(/\/$/,'');
  const origin=originOf(value),url=new URL(value.includes('://')?value:`https://${value}`);
  if(url.pathname!=='/'||url.search||url.hash)throw new Error('추가 도메인은 경로 없이 입력하세요. 로그인 경로는 아래에서 따로 지정합니다.');
  return origin;
}
export function additionalDomainsOf(site) {
  if(site.shareOnLocalhost!==undefined&&typeof site.shareOnLocalhost!=='boolean')throw new Error('localhost 공유 설정이 올바르지 않습니다.');
  const values=site.additionalDomains===undefined?(site.shareOnLocalhost?['localhost:*']:[]):site.additionalDomains;
  if(!Array.isArray(values)||values.length>100)throw new Error('추가 도메인은 100개 이하로 입력하세요.');
  const domains=values.map(additionalDomainOf);
  if(new Set(domains).size!==domains.length)throw new Error('같은 추가 도메인을 두 번 입력할 수 없습니다.');
  if(domains.includes(originOf(site.origin)))throw new Error('기준 도메인은 추가 도메인에 다시 입력하지 마세요.');
  return domains;
}
export function loginPathOf(site) {
  if(site.loginUrl!==undefined&&(typeof site.loginUrl!=='string'||site.loginUrl.length>8000))throw new Error('로그인 페이지 경로가 올바르지 않습니다.');
  const origin=originOf(site.origin),url=new URL(site.loginUrl||'/',origin);
  if(url.origin!==origin||url.username||url.password||url.pathname.startsWith('//'))throw new Error('로그인 경로는 현재 도메인 안의 주소여야 합니다.');
  return url.pathname+url.search+url.hash;
}
export function validateSite(site) {
  const origin = originOf(site.origin);
  const loginUrl = new URL(loginPathOf(site),origin).href,additionalDomains=additionalDomainsOf(site);
  for (const field of ['username', 'password', 'submit']) {
    if (typeof site.selectors?.[field] !== 'string' || site.selectors[field].length > 1000) throw new Error('로그인 요소 설정이 올바르지 않습니다.');
  }
  if(site.selectors.logout!==undefined && (typeof site.selectors.logout!=='string' || site.selectors.logout.length>1000))throw new Error('로그아웃 요소 설정이 올바르지 않습니다.');
  return {id: site.id || crypto.randomUUID(), origin, loginUrl, selectors: site.selectors, accounts: site.accounts || [], ...(additionalDomains.length?{additionalDomains}:{}), ...(site.floating?{floating:floatingLayout(site.floating)}:{})};
}
// Chrome match patterns without a port cover all ports on this exact hostname.
export const LOCALHOST_PATTERNS=['http://localhost/*','https://localhost/*'];
function domainPatterns(domain) {
  if(domain==='localhost:*')return LOCALHOST_PATTERNS;
  if(domain.endsWith('localhost:*'))return [domain.replace(':*','')+'/*'];
  return [domain+'/*'];
}
export function sitePatterns(site) {return [...new Set([site.origin+'/*',...additionalDomainsOf(site).flatMap(domainPatterns)])];}
export function validateSharing(sites) {
  const exact=new Map(sites.map(s=>[s.origin,s])),wildcards=new Map();
  for(const site of sites)for(const domain of additionalDomainsOf(site)){
    if(domain.endsWith('localhost:*')){
      for(const pattern of domainPatterns(domain)){
        if(wildcards.has(pattern)&&wildcards.get(pattern)!==site)throw new Error('이 localhost 범위는 다른 기준 도메인에서 사용 중입니다. 기존 목록에서 먼저 제거하세요.');
        wildcards.set(pattern,site);
      }
    }else{
      if(exact.has(domain)&&exact.get(domain)!==site)throw new Error('이 도메인은 다른 기준 도메인이나 추가 도메인에 이미 등록되어 있습니다.');
      exact.set(domain,site);
    }
  }
}
export function siteForPage(sites,value) {
  const origin=originOf(value),exact=sites.find(s=>s.origin===origin);
  if(exact)return {...exact,loginUrl:new URL(loginPathOf(exact),origin).href};
  const aliases=sites.filter(s=>additionalDomainsOf(s).includes(origin));
  let site;if(aliases.length===1)site=aliases[0];else if(aliases.length)return;
  else{
    const page=new URL(origin);if(page.hostname!=='localhost')return;
    const shared=sites.filter(s=>additionalDomainsOf(s).some(d=>d==='localhost:*'||d===page.protocol+'//localhost:*'));
    if(shared.length!==1)return;site=shared[0];
  }
  return {...site,origin,loginUrl:new URL(loginPathOf(site),origin).href};
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
