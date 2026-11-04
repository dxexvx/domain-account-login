import {originOf} from './core.js';
import {browserKey} from './vault.js';
import {MAX_BACKUP_BYTES} from './backup.js';
const $=id=>document.getElementById(id);
let sites=[],selected=null,refreshing=false,pickerOutstanding=false,pendingBackup=null,backupBusy=false;
async function ask(message) {const r=await chrome.runtime.sendMessage(message);if(!r?.ok) throw new Error(r?.error||'확장프로그램을 다시 열어주세요.');return r;}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function run(fn){try{await fn();}catch(e){notice(e.message,true);}}
const btn=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>run(fn);return b;};
function editAccount(a={}) {
  $('account-form').reset();$('account-id').value=a.id||'';$('alias').value=a.alias||'';$('username').value=a.username||'';$('password').required=!a.id;$('account-title').textContent=a.id?'계정 수정':'계정 추가';
}
function selectSite(id) {
  selected=id;const s=sites.find(x=>x.id===id);
  $('backup-scope').querySelector('[value="current"]').disabled=!s;
  if(!s)$('backup-scope').value='all';$('export-backup').disabled=!sites.length;
  $('account-import').hidden=!s;$('import-file').value='';
  $('site-form').reset();$('site-id').value=s?.id||'';$('origin').value=s?.origin||'';$('login-url').value=s?.loginUrl||'';
  for(const field of ['username','password','submit','logout']) $('selector-'+field).value=s?.selectors[field]||'';
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
  const r=await ask({type:'STATUS'});
  // Prepare an open legacy vault before extension reload clears session storage.
  if('unlocked' in r){if(!r.unlocked)throw new Error('기존 계정을 변환하려면 기존 보관함을 먼저 열어주세요.');await browserKey();}
  $('workspace').hidden=false;
  const {draft}=await ask({type:'DRAFT'});$('setup-context').hidden=!draft;
  if(draft)$('setup-context').textContent=`${draft.site.origin} · 현재 로그인 화면을 매핑했습니다. 보관함을 열면 이 도메인으로 시작합니다.`;
  const applied=await ask({type:'APPLY_DRAFT'});await load(applied.id);
  if(applied.id){$('setup-context').hidden=true;notice(applied.missing.length?'도메인을 준비했습니다. 찾지 못한 요소는 화면에서 직접 선택하세요.':'현재 로그인 주소와 세 요소를 저장했습니다. 계정을 추가하세요.');}
}
$('new-site').onclick=()=>{selectSite(null);$('origin').focus();};
$('site-form').onsubmit=e=>{
  e.preventDefault();
  // Request host permission directly inside the user gesture, before any awaited IPC.
  let origin;try{origin=originOf($('origin').value.trim());}catch(error){notice(error.message,true);return;}
  const site={id:$('site-id').value,origin,loginUrl:$('login-url').value.trim()||origin,selectors:{}};
  try{if(new URL(site.loginUrl).origin!==origin)throw new Error('로그인 주소와 허용 도메인이 같아야 합니다.');
    for(const f of ['username','password','submit','logout']){site.selectors[f]=$('selector-'+f).value.trim();if(site.selectors[f])document.querySelector(site.selectors[f]);}
  }catch(error){notice(error.message,true);return;}
  const permission=chrome.permissions.request({origins:[`${origin}/*`]});
  run(async()=>{if(!(await permission))throw new Error('사이트 접근 권한을 허용해야 사용할 수 있습니다.');const r=await ask({type:'SAVE_SITE',site});await load(r.id);notice('도메인을 저장했습니다. 로그인 요소와 계정을 등록하세요.');});
};
$('delete-site').onclick=()=>run(async()=>{if(!confirm('이 도메인과 등록된 계정을 모두 삭제할까요?'))return;await ask({type:'DELETE_SITE',id:selected});await load(null);notice('도메인과 계정을 삭제했습니다.');});
$('account-form').onsubmit=e=>{e.preventDefault();run(async()=>{await ask({type:'SAVE_ACCOUNT',siteId:selected,account:{id:$('account-id').value,alias:$('alias').value,username:$('username').value,password:$('password').value}});$('password').value='';await load();notice('계정을 저장했습니다.');});};
$('new-account').onclick=()=>{editAccount();$('alias').focus();};
function resetBackup(){pendingBackup=null;$('backup-preview').hidden=true;$('import-backup').disabled=true;}
function backupTask(fn){return run(async()=>{
 if(backupBusy)return;backupBusy=true;$('backup-tools').setAttribute('aria-busy','true');
 const controls=[...$('backup-tools').querySelectorAll('input,select,button')];const disabled=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
 try{await fn();}finally{backupBusy=false;$('backup-tools').removeAttribute('aria-busy');controls.forEach((c,i)=>c.disabled=disabled[i]);$('import-backup').disabled=!pendingBackup;}
});}
$('backup-export').onsubmit=e=>{
 e.preventDefault();if($('export-password').value!==$('export-confirm').value){notice('백업 암호 확인이 일치하지 않습니다.',true);return;}
 const password=$('export-password').value,siteId=$('backup-scope').value==='current'?selected:null;
 backupTask(async()=>{
  try{
   const {envelope}=await ask({type:'EXPORT_BACKUP',siteId,password});
   const url=URL.createObjectURL(new Blob([JSON.stringify(envelope)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=`domain-accounts-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   notice('암호화 백업 파일을 내보냈습니다. 다른 프로필에서도 같은 백업 암호로 가져올 수 있습니다.');
  }finally{$('export-password').value='';$('export-confirm').value='';}
 });
};
$('backup-file').onchange=resetBackup;$('import-password').oninput=resetBackup;
$('backup-import').onsubmit=e=>{e.preventDefault();backupTask(async()=>{
 resetBackup();const file=$('backup-file').files[0];if(!file)throw new Error('백업 파일을 선택하세요.');
 if(file.size>MAX_BACKUP_BYTES)throw new Error('백업 파일은 5MB 이하로 선택하세요.');
 let envelope;try{envelope=JSON.parse(await file.text());}catch{throw new Error('JSON 형식의 계정 백업 파일을 선택하세요.');}
 const password=$('import-password').value;
 try{
  const r=await ask({type:'PREVIEW_BACKUP',envelope,password});
  $('backup-summary').textContent=`도메인 ${r.domains.length}개 · 새 도메인 ${r.domainsAdded}개 · 추가할 계정 ${r.accountsAdded}개 · 중복 ${r.accountsSkipped}개`;
  $('backup-domains').replaceChildren(...r.domains.map(s=>{const li=document.createElement('li');li.textContent=`${s.origin} · 계정 ${s.accounts}개`;return li;}));
  pendingBackup={envelope,password,requiredOrigins:r.requiredOrigins};$('backup-preview').hidden=false;notice('가져올 내용을 확인한 뒤 가져오기를 누르세요.');
 }finally{$('import-password').value='';}
});};
$('cancel-backup').onclick=()=>{resetBackup();$('backup-import').reset();notice('가져오기를 취소했습니다.');};
$('import-backup').onclick=()=>{
 if(!pendingBackup||backupBusy)return;const pending=pendingBackup;
 // Optional host permissions must be requested synchronously from this click.
 const permission=pending.requiredOrigins.length?chrome.permissions.request({origins:pending.requiredOrigins}):Promise.resolve(true);
 backupTask(async()=>{
  try{
   if(!(await permission))throw new Error('도메인 접근을 허용하지 않아 가져오기를 취소했습니다. 기존 계정은 변경하지 않았습니다.');
   const r=await ask({type:'IMPORT_BACKUP',envelope:pending.envelope,password:pending.password});
   await load();$('backup-import').reset();notice(`계정 ${r.accountsAdded}개와 새 도메인 ${r.domainsAdded}개를 가져왔습니다. 중복 ${r.accountsSkipped}개는 건너뛰었습니다.`);
  }finally{resetBackup();}
 });
};
$('begin-import').onclick=()=>run(async()=>{
  const {request}=await ask({type:'BEGIN_IMPORT',siteId:selected});
  const url=URL.createObjectURL(new Blob([JSON.stringify(request)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='account-import-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notice('공개키 요청을 저장했습니다. 전용 도구가 만든 암호화 파일을 선택하세요.');
});
$('import-file').onchange=()=>run(async()=>{
  const file=$('import-file').files[0];$('import-file').value='';if(!file)return;
  if(file.size>260000)throw new Error('가져오기 파일이 너무 큽니다.');
  let envelope;try{envelope=JSON.parse(await file.text());}catch{throw new Error('JSON 형식의 암호화 파일을 선택하세요.');}
  const {count}=await ask({type:'IMPORT_ACCOUNTS',siteId:selected,envelope});await load();notice(`${count}개 계정을 가져왔습니다.`);
});
for(const b of document.querySelectorAll('[data-pick]')) b.onclick=()=>run(async()=>{pickerOutstanding=true;await ask({type:'PICK',siteId:selected,field:b.dataset.pick});notice('로그인 페이지에서 해당 요소를 클릭하세요. 돌아오면 선택 결과를 불러옵니다.');});
window.addEventListener('focus',()=>{if(refreshing)return;refreshing=true;run(async()=>{try{const {draft}=await ask({type:'DRAFT'});if(draft)await status();else if(pickerOutstanding&&!$('workspace').hidden){pickerOutstanding=false;await load();}}finally{refreshing=false;}});});
run(status);
