// Injected in the isolated world. Inspect element structure only; never read values or submit.
export function mapLogin(expectedOrigin) {
  if(location.origin!==expectedOrigin)return {error:'페이지 주소가 변경되었습니다.'};
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.disabled&&!e.readOnly;};
  const unique=s=>{try{return document.querySelectorAll(s).length===1;}catch{return false;}};
  function selector(e){
    if(e.id&&unique('#'+CSS.escape(e.id)))return '#'+CSS.escape(e.id);
    for(const attr of ['name','autocomplete','type']){const v=e.getAttribute(attr);if(v){const s=e.tagName.toLowerCase()+`[${attr}="${CSS.escape(v)}"]`;if(unique(s))return s;}}
    let parts=[];for(let n=e;n&&n!==document.documentElement;n=n.parentElement){const tag=n.tagName.toLowerCase(),peers=[...n.parentElement.children].filter(x=>x.tagName===n.tagName);parts.unshift(tag+(peers.length>1?`:nth-of-type(${peers.indexOf(n)+1})`:''));const s=parts.join(' > ');if(unique(s)&&s.length<=1000)return s;}return '';
  }
  const result={selectors:{username:'',password:'',submit:''},missing:[]};
  const passwords=[...document.querySelectorAll('input[type="password"]')].filter(visible);
  if(passwords.length!==1)return {...result,missing:['username','password','submit']};
  const password=passwords[0],scope=password.form||document;
  result.selectors.password=selector(password);
  const users=[...scope.querySelectorAll('input')].filter(e=>visible(e)&&['text','email','tel'].includes(e.type));
  const rank=e=>(e.autocomplete==='username'?300:0)+(e.type==='email'?80:0)+(/user|login|ldap|email|아이디|이메일/i.test([e.id,e.name,e.getAttribute('aria-label'),e.placeholder].join(' '))?100:0);
  users.sort((a,b)=>rank(b)-rank(a));
  if(users.length===1||(users.length>1&&rank(users[0])>rank(users[1])))result.selectors.username=selector(users[0]);
  const buttons=[...scope.querySelectorAll('button,input[type="submit"],input[type="button"],[role="button"]')].filter(visible);
  const loginButtons=buttons.filter(e=>/로그인|log\s*in|sign\s*in/i.test(e.textContent||e.getAttribute('aria-label')||e.getAttribute('value')||''));
  const submits=buttons.filter(e=>e.type==='submit');
  const candidates=loginButtons.length?loginButtons:submits;
  if(candidates.length===1)result.selectors.submit=selector(candidates[0]);
  result.missing=Object.keys(result.selectors).filter(k=>!result.selectors[k]);return result;
}
