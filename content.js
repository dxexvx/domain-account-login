(() => {
  if(window!==window.top || window.__domainAccountLogin) return;
  window.__domainAccountLogin=true;
  let host,root,site,signature='',timer,claiming=false,picking=null,highlight;
  const ask=message=>chrome.runtime.sendMessage(message);
  function shell() {
    if(host?.isConnected) return;
    host=document.createElement('div');host.id='domain-account-login';
    host.style.cssText='all:initial!important;position:fixed!important;bottom:0!important;left:0!important;width:100%!important;z-index:2147483647!important;';
    root=host.attachShadow({mode:'open'});
    const style=document.createElement('style');style.textContent=`
      :host{color-scheme:light} *{box-sizing:border-box} .bar{font:14px/1.5 system-ui,sans-serif;color:#202124;background:#fff;border-top:1px solid #dadce0;padding:12px 20px max(12px,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-height:38vh;overflow:auto}
      button,select{font:inherit;height:44px;padding:8px 12px;border:1px solid #dadce0;border-radius:4px;background:#fff;color:#202124;cursor:pointer}button.account{background:#185abc;color:#fff;border-color:#185abc}button:hover{filter:brightness(.94)}button:focus-visible,select:focus-visible{outline:3px solid #3573bc;outline-offset:2px}button:disabled{opacity:.55;cursor:wait}.status{flex-basis:100%;margin:0;color:#5f6368}.label{margin-right:6px}.pick{font:16px/1.5 system-ui;padding:16px 20px;background:#185abc;color:white}.pick button{margin-left:16px}@media(max-width:600px){.bar{padding:10px;gap:6px} .label{flex-basis:100%}}
    `;root.append(style);document.documentElement.append(host);
  }
  const button=(text,fn,className='')=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.className=className;b.addEventListener('click',event=>{if(event.isTrusted)fn(event);});return b;};
  const visible=el=>el && el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
  function loginVisible() {
    try {
      if(!site || !['username','password','submit'].every(f=>site.selectors[f]))return false;
      const inputs=selector=>[...document.querySelectorAll(selector)].filter(el=>el instanceof HTMLInputElement && visible(el));
      const username=inputs(site.selectors.username).some(el=>!['password','hidden','file','checkbox','radio'].includes(el.type));
      const password=inputs(site.selectors.password).some(el=>el.type==='password');
      return username && password && [...document.querySelectorAll(site.selectors.submit)].some(visible);
    } catch {return false;}
  }
  async function refresh() {
    if(picking) return;
    try {
      const response=await ask({type:'PAGE'});
      site=response.site;
      if(!site || !loginVisible()) {host?.remove();signature='';return;}
      const next=JSON.stringify(site);if(signature===next && host?.isConnected) return;
      signature=next;shell();root.querySelector('.bar')?.remove();
      const bar=document.createElement('section');bar.className='bar';bar.setAttribute('aria-label','저장한 계정으로 로그인');
      const label=document.createElement('span');label.className='label';label.textContent='계정 선택';bar.append(label);
      const mode=document.createElement('select');mode.setAttribute('aria-label','로그인 세션');
      for(const [value,text] of [['private','새 시크릿 세션 우선'],['current','현재 창 · 세션 공유']]) {const o=new Option(text,value);mode.append(o);}
      bar.append(mode);
      const status=document.createElement('p');status.className='status';status.setAttribute('role','status');
      status.textContent='시크릿 창끼리는 세션을 공유합니다. 계정별 완전 분리는 별도 Chrome 프로필을 사용하세요.';
      for(const a of site.accounts) bar.append(button(a.alias,async()=>{
        const buttons=[...bar.querySelectorAll('button')];buttons.forEach(x=>x.disabled=true);
        try {
          status.textContent='로그인을 준비하고 있습니다…';
          const r=await ask({type:'LOGIN',accountId:a.id,mode:mode.value});
          if(!r.ok) throw new Error(r.error);
          status.textContent=r.fallback || (r.opened?'시크릿 창에서 로그인을 진행합니다.':'로그인 버튼을 눌렀습니다. 사이트의 결과를 확인하세요.');
          if(r.fallback) {mode.value='current';status.textContent+=' 현재 창에서 계속하려면 계정 버튼을 다시 누르세요.';}
        } catch(e) {status.textContent=e.message;}
        finally {buttons.forEach(x=>x.disabled=false);}
      },'account'));
      bar.append(button('설정',()=>ask({type:'OPEN'})),status);root.append(bar);
      if(!claiming) {
        claiming=true;
        try {const r=await ask({type:'CLAIM'});if(!r.ok) status.textContent=r.error;} finally {claiming=false;}
      }
    } catch {host?.remove();signature='';}
  }
  function selectorFor(el) {
    if(el.id) {const s=`#${CSS.escape(el.id)}`;if(document.querySelectorAll(s).length===1)return s;}
    const parts=[];let current=el;
    while(current && current!==document.documentElement) {
      const tag=current.tagName.toLowerCase();const siblings=[...current.parentElement.children].filter(x=>x.tagName===current.tagName);
      parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current)+1})`);
      const s=parts.join(' > ');if(document.querySelectorAll(s).length===1)return s;current=current.parentElement;
    }
    throw new Error('요소를 고유하게 지정할 수 없습니다. CSS 선택자를 직접 입력하세요.');
  }
  function stopPick() {picking=null;highlight?.remove();host?.remove();signature='';document.removeEventListener('click',capture,true);for(const type of ['pointerdown','pointerup','mousedown','mouseup'])document.removeEventListener(type,blockPick,true);document.removeEventListener('pointermove',point,true);document.removeEventListener('keydown',escape,true);refresh();}
  function blockPick(event) {if(!event.composedPath().includes(host)){event.preventDefault();event.stopImmediatePropagation();}}
  function escape(event) {if(event.key==='Escape'){event.preventDefault();stopPick();}}
  function target(event) {return event.target?.closest?.('input,button,[role="button"],a') || event.target;}
  function point(event) {
    const el=target(event);if(!el || el===host || el===highlight) return;
    const r=el.getBoundingClientRect();highlight.style.cssText=`position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;border:3px solid #1a73e8;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
  }
  async function capture(event) {
    if(event.composedPath().includes(host)) return;
    event.preventDefault();event.stopImmediatePropagation();
    const el=target(event),field=picking;
    const note=root.querySelector('.pick span');
    try {
      if(field==='username' && (!(el instanceof HTMLInputElement) || ['password','hidden','file','checkbox','radio'].includes(el.type))) throw new Error('아이디 입력란을 선택하세요.');
      if(field==='password' && (!(el instanceof HTMLInputElement) || el.type!=='password')) throw new Error('비밀번호 입력란을 선택하세요.');
      const selector=selectorFor(el),r=await ask({type:'PICKED',field,selector});if(!r.ok)throw new Error(r.error);stopPick();
    } catch(e) {note.textContent=e.message;}
  }
  chrome.runtime.onMessage.addListener(message=>{
    if(message.type!=='PICK')return;
    picking=message.field;host?.remove();shell();
    const bar=document.createElement('div');bar.className='pick';const text=document.createElement('span');
    text.textContent=`${{username:'아이디 입력란',password:'비밀번호 입력란',submit:'로그인 버튼'}[picking]}을 클릭하세요. 선택 클릭은 로그인하지 않습니다.`;
    bar.append(text,button('취소 · Esc',stopPick));root.append(bar);
    highlight=document.createElement('div');highlight.style.pointerEvents='none';document.documentElement.append(highlight);
    document.addEventListener('click',capture,true);for(const type of ['pointerdown','pointerup','mousedown','mouseup'])document.addEventListener(type,blockPick,true);document.addEventListener('pointermove',point,true);document.addEventListener('keydown',escape,true);
  });
  // Ignore our own subtree so updates cannot form a MutationObserver feedback loop.
  new MutationObserver(records=>{
    if(records.every(r=>r.target===host || r.target===highlight || (r.type==='childList' && [...r.addedNodes,...r.removedNodes].every(n=>n===host || n===highlight))))return;
    clearTimeout(timer);timer=setTimeout(refresh,150);
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','disabled']});
  setInterval(refresh,5000);refresh();
})();
