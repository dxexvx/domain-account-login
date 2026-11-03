import {originOf,validateSite,metadata,derive,salt,exportKey,importKey,encrypt,decrypt} from './core.js';
import {fillAndSubmit} from './login.js';
import {mapLogin} from './mapping.js';
import {createTransfer,openTransfer} from './transfer.js';
const SESSION_MS=30*60*1000;
let queue=Promise.resolve();
const serialized = fn => {const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;};
async function initialize() {
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
}
const ready=initialize();
async function key() {
  const {unlock}=await chrome.storage.session.get('unlock');
  if(!unlock || unlock.expires<Date.now()) {await chrome.storage.session.remove(['unlock','accountImport']);throw new Error('보관함이 잠겨 있습니다. 확장프로그램 설정에서 잠금을 해제하세요.');}
  return importKey(unlock.key);
}
async function data() {const {vault}=await chrome.storage.local.get('vault');if(!vault) throw new Error('먼저 설정에서 보관함을 만드세요.');return decrypt(vault,await key());}
async function save(dataValue) {
  const {vault}=await chrome.storage.local.get('vault');
  await chrome.storage.local.set({vault:await encrypt(dataValue,await key(),vault.salt)});
}
async function synchronize(sites) {
  const registered=await chrome.scripting.getRegisteredContentScripts();
  if(registered.length) await chrome.scripting.unregisterContentScripts({ids:registered.map(x=>x.id)});
  for(const site of sites) {
    if(await chrome.permissions.contains({origins:[`${site.origin}/*`]})) {
      await chrome.scripting.registerContentScripts([{id:`site-${site.id}`,matches:[`${site.origin}/*`],js:['content.js'],runAt:'document_idle',persistAcrossSessions:true}]);
      // Activate already-open tabs after registration without requiring a refresh.
      const tabs=await chrome.tabs.query({url:`${site.origin}/*`});
      for(const tab of tabs) try {await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});} catch {}
    }
  }
}
function admin(sender) {if(sender.id!==chrome.runtime.id || sender.url!==chrome.runtime.getURL('options.html')) throw new Error('설정 화면에서만 가능한 작업입니다.');}
function pageOrigin(sender) {
  if(!sender.tab || sender.frameId!==0 || sender.id!==chrome.runtime.id) throw new Error('허용된 최상위 화면이 아닙니다.');
  return originOf(sender.url);
}
async function pageSite(sender) {const origin=pageOrigin(sender);const d=await data();const site=d.sites.find(x=>x.origin===origin);if(!site || !(await chrome.permissions.contains({origins:[`${origin}/*`]}))) throw new Error('허용되지 않은 사이트입니다.');return site;}
async function submit(tabId,site,accountId) {
  const account=site.accounts.find(x=>x.id===accountId);
  if(!account) throw new Error('계정을 찾을 수 없습니다.');
  const tab=await chrome.tabs.get(tabId);
  if(originOf(tab.url)!==site.origin) throw new Error('대상 주소가 변경되어 로그인을 중단했습니다.');
  const result=await chrome.scripting.executeScript({target:{tabId},func:fillAndSubmit,args:[site.origin,site.selectors,account.username,account.password]});
  const outcome=result[0]?.result;
  if(!outcome?.submitted) throw new Error(outcome?.error || '로그인 실행 결과를 확인할 수 없습니다.');
  return outcome;
}
async function handle(message,sender) {
  await ready;
  const {accountImport:expiredImport}=await chrome.storage.session.get('accountImport');
  if(expiredImport&&expiredImport.request.expires<=Date.now())await chrome.storage.session.remove('accountImport');
  if(message.type==='MAP_LOGIN') {
    if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('popup.html'))throw new Error('확장 팝업에서 자동 매핑을 시작하세요.');
    if(!Number.isSafeInteger(message.tabId))throw new Error('대상 탭을 찾을 수 없습니다.');
    const url=new URL(message.url),origin=originOf(url.href);
    if(url.username||url.password)throw new Error('인증정보가 포함된 주소는 사용할 수 없습니다.');
    const before=await chrome.tabs.get(message.tabId);
    if(before.url!==url.href)throw new Error('페이지가 이동했습니다. 로그인 화면에서 팝업을 다시 여세요.');
    if(!(await chrome.permissions.contains({origins:[origin+'/*']})))throw new Error('사이트 접근 권한을 허용하세요.');
    const results=await chrome.scripting.executeScript({target:{tabId:message.tabId},func:mapLogin,args:[origin]});
    const mapped=results[0]?.result;
    if(!mapped?.selectors?.password)throw new Error('로그인 비밀번호 입력란을 하나로 찾을 수 없습니다. 로그인 화면을 확인하세요.');
    if((await chrome.tabs.get(message.tabId)).url!==url.href)throw new Error('매핑 도중 페이지가 이동했습니다. 다시 시작하세요.');
    const site=validateSite({origin,loginUrl:url.href,selectors:mapped.selectors});
    await chrome.storage.session.set({mappingDraft:{site,missing:mapped.missing,expires:Date.now()+10*60*1000}});
    return {site,missing:mapped.missing};
  }
  if(message.type==='PAGE') {
    const origin=pageOrigin(sender);
    try {const site=await pageSite(sender);return {site:metadata(site)};} catch {return {locked:true,origin};}
  }
  if(message.type==='LOGIN') {
    const site=await pageSite(sender);
    if(!site.accounts.some(x=>x.id===message.accountId)) throw new Error('계정을 찾을 수 없습니다.');
    if(message.mode==='current') return submit(sender.tab.id,site,message.accountId);
    if(message.mode!=='private') throw new Error('로그인 방식을 선택하세요.');
    if(!(await chrome.extension.isAllowedIncognitoAccess())) return {fallback:'시크릿 모드 사용 권한이 없습니다. 확장 관리에서 허용하거나 현재 창을 선택하세요.'};
    if((await chrome.windows.getAll()).some(x=>x.incognito)) return {fallback:'이미 열린 시크릿 창과 세션을 공유합니다. 모든 시크릿 창을 닫은 뒤 다시 시도하거나 현재 창을 선택하세요.'};
    // Create blank first so the one-use tab-bound intent exists before navigation.
    let win;
    try {win=await chrome.windows.create({url:'about:blank',incognito:true});}
    catch {return {fallback:'이 브라우저에서 시크릿 창을 열 수 없습니다. 현재 창을 선택해 로그인할 수 있습니다.'};}
    const tabId=win.tabs[0].id;
    await chrome.storage.session.set({[`pending-${tabId}`]:{siteId:site.id,accountId:message.accountId,expires:Date.now()+60000}});
    await chrome.tabs.update(tabId,{url:site.loginUrl});
    return {opened:true};
  }
  if(message.type==='CLAIM') {
    const site=await pageSite(sender), storageKey=`pending-${sender.tab.id}`;
    const pending=(await chrome.storage.session.get(storageKey))[storageKey];
    if(!pending) return {};
    if(pending.expires<Date.now() || pending.siteId!==site.id) {await chrome.storage.session.remove(storageKey);return {};}
    await chrome.storage.session.remove(storageKey);
    return submit(sender.tab.id,site,pending.accountId);
  }
  if(message.type==='PICKED') {
    const site=await pageSite(sender), pickKey=`pick-${sender.tab.id}`;
    const pick=(await chrome.storage.session.get(pickKey))[pickKey];
    if(!pick || pick.siteId!==site.id || pick.expires<Date.now() || pick.field!==message.field) throw new Error('요소 선택 시간이 만료되었습니다. 설정에서 다시 시작하세요.');
    if(typeof message.selector!=='string' || message.selector.length>1000) throw new Error('요소 선택자가 올바르지 않습니다.');
    const d=await data(), target=d.sites.find(x=>x.id===site.id);
    target.selectors[message.field]=message.selector;
    await save(d);await chrome.storage.session.remove(pickKey);return {saved:true};
  }
  if(message.type==='OPEN') return chrome.runtime.openOptionsPage();
  admin(sender);
  if(message.type==='BEGIN_IMPORT') {
    const d=await data(),site=d.sites.find(x=>x.id===message.siteId);
    if(!site)throw new Error('도메인을 먼저 저장하세요.');
    const pending=await createTransfer(site.origin,site.id);
    await chrome.storage.session.set({accountImport:pending});return {request:pending.request};
  }
  if(message.type==='IMPORT_ACCOUNTS') {
    const d=await data(),{accountImport:pending}=await chrome.storage.session.get('accountImport');
    // Consume before decrypting: a request accepts exactly one attempt.
    await chrome.storage.session.remove('accountImport');
    const site=d.sites.find(x=>x.id===pending?.siteId&&x.id===message.siteId&&x.origin===pending.request.origin);
    if(!site)throw new Error('가져오기 요청을 새로 만드세요.');
    const accounts=await openTransfer(message.envelope,pending,site.accounts);
    site.accounts.push(...accounts.map(a=>({...a,id:crypto.randomUUID()})));
    await save(d);return {count:accounts.length};
  }
  if(message.type==='DRAFT') {
    const {mappingDraft:draft}=await chrome.storage.session.get('mappingDraft');
    return {draft:draft?.expires>Date.now()?draft:null};
  }
  if(message.type==='APPLY_DRAFT') {
    const {mappingDraft:draft}=await chrome.storage.session.get('mappingDraft');
    if(!draft||draft.expires<Date.now())return {};
    const d=await data(),site=validateSite(draft.site),old=d.sites.find(x=>x.origin===site.origin);
    if(!(await chrome.permissions.contains({origins:[site.origin+'/*']})))throw new Error('사이트 접근 권한을 다시 허용하세요.');
    site.id=old?.id||site.id;site.accounts=old?.accounts||[];
    // Keep an existing explicit selection when automatic detection is ambiguous.
    for(const field of draft.missing)site.selectors[field]=old?.selectors[field]||'';
    d.sites=d.sites.filter(x=>x.origin!==site.origin);d.sites.push(site);await save(d);await synchronize(d.sites);
    await chrome.storage.session.remove('mappingDraft');return {id:site.id,missing:draft.missing};
  }
  if(message.type==='STATUS') {
    const {vault}=await chrome.storage.local.get('vault');
    try {await key();return {exists:!!vault,unlocked:true};} catch {return {exists:!!vault,unlocked:false};}
  }
  if(message.type==='UNLOCK') {
    const {vault}=await chrome.storage.local.get('vault'), saltValue=vault?.salt||salt();
    const k=await derive(message.password,saltValue);
    if(vault) await decrypt(vault,k);
    else await chrome.storage.local.set({vault:await encrypt({sites:[]},k,saltValue)});
    await chrome.storage.session.set({unlock:{key:await exportKey(k),expires:Date.now()+SESSION_MS}});
    await synchronize((await data()).sites);return {unlocked:true};
  }
  if(message.type==='LOCK') {await chrome.storage.session.clear();return {};}
  if(message.type==='LIST') return {sites:(await data()).sites.map(s=>({...s,accounts:s.accounts.map(({password,...a})=>a)}))};
  if(message.type==='SAVE_SITE') {
    const d=await data(), site=validateSite(message.site);
    if(d.sites.some(x=>x.origin===site.origin && x.id!==site.id)) throw new Error('이미 등록한 도메인입니다.');
    const old=d.sites.find(x=>x.id===site.id);site.accounts=old?.accounts||[];
    if(!(await chrome.permissions.contains({origins:[`${site.origin}/*`]}))) throw new Error('사이트 접근 권한을 허용하세요.');
    d.sites=d.sites.filter(x=>x.id!==site.id);d.sites.push(site);await save(d);await synchronize(d.sites);return {id:site.id};
  }
  if(message.type==='DELETE_SITE') {
    const d=await data(),site=d.sites.find(x=>x.id===message.id);d.sites=d.sites.filter(x=>x.id!==message.id);await save(d);await synchronize(d.sites);
    if(site) await chrome.permissions.remove({origins:[`${site.origin}/*`]});return {};
  }
  if(message.type==='SAVE_ACCOUNT' || message.type==='DELETE_ACCOUNT') {
    const d=await data(),site=d.sites.find(x=>x.id===message.siteId);if(!site) throw new Error('도메인을 먼저 저장하세요.');
    if(message.type==='DELETE_ACCOUNT') site.accounts=site.accounts.filter(x=>x.id!==message.id);
    else {
      const a=message.account,old=site.accounts.find(x=>x.id===a.id);
      if(!a.alias?.trim() || !a.username?.trim() || !(a.password||old?.password)) throw new Error('별칭, 아이디, 비밀번호를 모두 입력하세요.');
      if(a.alias.length>80 || a.username.length>500 || a.password.length>1000) throw new Error('계정 정보가 너무 깁니다.');
      site.accounts=site.accounts.filter(x=>x.id!==a.id);
      site.accounts.push({id:old?.id||crypto.randomUUID(),alias:a.alias.trim(),username:a.username,password:a.password||old.password});
    }
    await save(d);return {};
  }
  if(message.type==='PICK') {
    if(!['username','password','submit'].includes(message.field)) throw new Error('선택할 요소가 올바르지 않습니다.');
    const d=await data(),site=d.sites.find(x=>x.id===message.siteId);if(!site) throw new Error('도메인을 저장하세요.');
    const tabs=await chrome.tabs.query({url:`${site.origin}/*`});
    let tab=tabs.find(x=>!x.incognito);
    if(!tab) tab=await chrome.tabs.create({url:site.loginUrl});
    await chrome.windows.update(tab.windowId,{focused:true});await chrome.tabs.update(tab.id,{active:true});
    await chrome.storage.session.set({[`pick-${tab.id}`]:{siteId:site.id,field:message.field,expires:Date.now()+300000}});
    try {await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});await chrome.tabs.sendMessage(tab.id,{type:'PICK',field:message.field});}
    catch {throw new Error('로그인 페이지를 불러온 뒤 요소 선택을 다시 누르세요.');}
    return {};
  }
  throw new Error('지원하지 않는 요청입니다.');
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{serialized(()=>handle(message,sender)).then(value=>respond({ok:true,...value}),error=>respond({ok:false,error:error.message}));return true;});
chrome.tabs.onRemoved.addListener(tabId=>chrome.storage.session.remove([`pending-${tabId}`,`pick-${tabId}`]));
