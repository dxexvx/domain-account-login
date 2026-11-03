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
  $('site-title').textContent=s?'도메인 설정':'도메인 추가';$('delete-site').hidden=!s;$('account-section').hidden=!s;
  document.querySelectorAll('[data-pick]').forEach(b=>b.disabled=!s);
  $('accounts').replaceChildren();
  for(const a of s?.accounts||[]) {
    const row=document.createElement('div');row.className='account';const label=document.createElement('p');const alias=document.createElement('span');alias.textContent=a.alias;label.append(alias);const small=document.createElement('small');small.textContent=a.username;label.append(small);
    const actions=document.createElement('div');actions.className='actions';actions.append(btn('수정',()=>editAccount(a)),btn('삭제',async()=>{
      if(!confirm(`‘${a.alias}’ 계정을 삭제할까요?`))return;await ask({type:'DELETE_ACCOUNT',siteId:id,id:a.id});await load(id);notice('계정을 삭제했습니다.');
    }));row.append(label,actions);$('accounts').append(row);
  }
  if(s && !s.accounts.length){const p=document.createElement('p');p.className='help';p.textContent='아직 계정이 없습니다. 아래에서 첫 계정을 등록하세요.';$('accounts').append(p);}
  document.querySelectorAll('#sites button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));editAccount();
}
async function load(id=selected) {
  sites=(await ask({type:'LIST'})).sites;$('sites').replaceChildren();
  for(const s of sites){const b=btn(s.origin,()=>selectSite(s.id));b.dataset.id=s.id;$('sites').append(b);}
  selectSite(id && sites.some(x=>x.id===id)?id:sites[0]?.id||null);
}
async function status() {
  const r=await ask({type:'STATUS'});$('vault').hidden=r.unlocked;$('workspace').hidden=!r.unlocked;$('lock').hidden=!r.unlocked;
  $('vault-title').textContent=r.exists?'계정보관함 열기':'계정보관함 만들기';$('unlock').textContent=r.exists?'잠금 해제':'보관함 만들기';$('master').autocomplete=r.exists?'current-password':'new-password';
  if(r.unlocked)await load();
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
window.addEventListener('focus',()=>{if(refreshing || !pickerOutstanding || $('workspace').hidden)return;refreshing=true;pickerOutstanding=false;run(async()=>{try{await load();}finally{refreshing=false;}});});
run(status);
