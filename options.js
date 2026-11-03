import {originOf} from './core.js';
const $=id=>document.getElementById(id);
let sites=[],selected=null,refreshing=false,pickerOutstanding=false;
async function ask(message) {const r=await chrome.runtime.sendMessage(message);if(!r?.ok) throw new Error(r?.error||'확장프로그램을 다시 열어주세요.');return r;}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function run(fn){try{await fn();}catch(e){notice(e.message,true);}}
const btn=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>run(fn);return b;};
function editAccount(a={}) {
  $('account-form').reset();$('account-id').value=a.id||'';$('alias').value=a.alias||'';$('username').value=a.username||'';$('password').required=!a.id;$('account-title').textContent=a.id?'계정 수정':'계정 추가';
}
function selectSite(id) {
  selected=id;const s=sites.find(x=>x.id===id);
  $('site-form').reset();$('site-id').value=s?.id||'';$('origin').value=s?.origin||'';$('login-url').value=s?.loginUrl||'';
  for(const field of ['username','password','submit']) $('selector-'+field).value=s?.selectors[field]||'';
  $('site-title').textContent='로그인 화면 설정';$('domain-heading').textContent=s?new URL(s.origin).host:'도메인 추가';$('domain-description').textContent=s?'이 도메인의 계정을 관리합니다.':'로그인 화면에서 확장 아이콘 → 자동 매핑으로 시작할 수 있습니다.';$('account-count').textContent=s?String(s.accounts.length):'';const mapped=s&&['username','password','submit'].every(f=>s.selectors[f]);$('mapping-status').textContent=mapped?'로그인 요소 3개 지정됨':s?'로그인 요소를 지정하세요':'주소와 로그인 요소를 지정하세요';$('login-settings').open=!s||!mapped;$('delete-site').hidden=!s;$('account-section').hidden=!s;
  document.querySelectorAll('[data-pick]').forEach(b=>b.disabled=!s);
  $('accounts').replaceChildren();
  for(const a of s?.accounts||[]) {
    const row=document.createElement('div');row.className='account';const label=document.createElement('p');const alias=document.createElement('span');alias.textContent=a.alias;label.append(alias);const small=document.createElement('small');small.textContent=a.username;label.append(small);
    const actions=document.createElement('div');actions.className='actions';actions.append(btn('수정',()=>{editAccount(a);$('alias').focus();}),btn('삭제',async()=>{
      if(!confirm(`‘${a.alias}’ 계정을 삭제할까요?`))return;await ask({type:'DELETE_ACCOUNT',siteId:id,id:a.id});await load(id);notice('계정을 삭제했습니다.');
    }));const paths=['<path d="m12 3 3 3-9 9-4 1 1-4zM10 5l3 3"/>','<path d="M3 5h12M7 5V3h4v2M5 5l1 11h6l1-11M8 8v5M10 8v5"/>'];[...actions.children].forEach((b,i)=>{const name=b.textContent;b.setAttribute('aria-label',name);b.title=name;b.innerHTML='<svg viewBox="0 0 18 18" aria-hidden="true">'+paths[i]+'</svg>';});row.append(label,actions);$('accounts').append(row);
  }
  if(s && !s.accounts.length){const p=document.createElement('p');p.className='empty';p.textContent='저장한 계정이 없습니다. 별칭과 로그인 정보를 등록하세요.';$('accounts').append(p);}
  document.querySelectorAll('#sites button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));editAccount();
}
async function load(id=selected) {
  sites=(await ask({type:'LIST'})).sites;$('sites').replaceChildren();
  for(const s of sites){const b=btn(s.origin,()=>selectSite(s.id));b.dataset.id=s.id;$('sites').append(b);}
  selectSite(id && sites.some(x=>x.id===id)?id:sites[0]?.id||null);
}
async function status() {
  const r=await ask({type:'STATUS'});$('vault').hidden=r.unlocked;$('workspace').hidden=!r.unlocked;$('lock').hidden=!r.unlocked;
  const {draft}=await ask({type:'DRAFT'});$('setup-context').hidden=!draft;
  if(draft)$('setup-context').textContent=`${draft.site.origin} · 현재 로그인 화면을 매핑했습니다. 보관함을 열면 이 도메인으로 시작합니다.`;
  $('vault-title').textContent=r.exists?'계정보관함 열기':'계정보관함 만들기';document.querySelector('#vault .intro').textContent=r.exists?'저장한 계정을 사용하려면 보관함을 열어주세요.':'계정을 안전하게 보관할 마스터 비밀번호를 정해주세요.';$('unlock').textContent=r.exists?'잠금 해제':'보관함 만들기';$('master').autocomplete=r.exists?'current-password':'new-password';
  if(r.unlocked){const applied=await ask({type:'APPLY_DRAFT'});await load(applied.id);if(applied.id){$('setup-context').hidden=true;notice(applied.missing.length?'도메인을 준비했습니다. 찾지 못한 요소는 화면에서 직접 선택하세요.':'현재 로그인 주소와 세 요소를 저장했습니다. 계정을 추가하세요.');}}
}
$('unlock-form').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('master').value;$('master').value='';$('unlock').disabled=true;try{await ask({type:'UNLOCK',password});await status();notice('보관함을 열었습니다. 30분 동안 사용할 수 있습니다.');}finally{$('unlock').disabled=false;}});};
$('lock').onclick=()=>run(async()=>{await ask({type:'LOCK'});sites=[];selected=null;$('accounts').replaceChildren();$('sites').replaceChildren();$('account-form').reset();await status();notice('보관함을 잠갔습니다.');});
$('new-site').onclick=()=>{selectSite(null);$('origin').focus();};
$('site-form').onsubmit=e=>{
  e.preventDefault();
  // Request host permission directly inside the user gesture, before any awaited IPC.
  let origin;try{origin=originOf($('origin').value.trim());}catch(error){notice(error.message,true);return;}
  const site={id:$('site-id').value,origin,loginUrl:$('login-url').value.trim()||origin,selectors:{}};
  try{if(new URL(site.loginUrl).origin!==origin)throw new Error('로그인 주소와 허용 도메인이 같아야 합니다.');
    for(const f of ['username','password','submit']){site.selectors[f]=$('selector-'+f).value.trim();if(site.selectors[f])document.querySelector(site.selectors[f]);}
  }catch(error){notice(error.message,true);return;}
  const permission=chrome.permissions.request({origins:[`${origin}/*`]});
  run(async()=>{if(!(await permission))throw new Error('사이트 접근 권한을 허용해야 사용할 수 있습니다.');const r=await ask({type:'SAVE_SITE',site});await load(r.id);notice('도메인을 저장했습니다. 로그인 요소와 계정을 등록하세요.');});
};
$('delete-site').onclick=()=>run(async()=>{if(!confirm('이 도메인과 등록된 계정을 모두 삭제할까요?'))return;await ask({type:'DELETE_SITE',id:selected});await load(null);notice('도메인과 계정을 삭제했습니다.');});
$('account-form').onsubmit=e=>{e.preventDefault();run(async()=>{await ask({type:'SAVE_ACCOUNT',siteId:selected,account:{id:$('account-id').value,alias:$('alias').value,username:$('username').value,password:$('password').value}});$('password').value='';await load();notice('계정을 저장했습니다.');});};
$('new-account').onclick=()=>{editAccount();$('alias').focus();};
for(const b of document.querySelectorAll('[data-pick]')) b.onclick=()=>run(async()=>{pickerOutstanding=true;await ask({type:'PICK',siteId:selected,field:b.dataset.pick});notice('로그인 페이지에서 해당 요소를 클릭하세요. 돌아오면 선택 결과를 불러옵니다.');});
window.addEventListener('focus',()=>{if(refreshing)return;refreshing=true;run(async()=>{try{const {draft}=await ask({type:'DRAFT'});if(draft)await status();else if(pickerOutstanding&&!$('workspace').hidden){pickerOutstanding=false;await load();}}finally{refreshing=false;}});});
run(status);
