(() => {
  if(window!==window.top || window.__domainAccountLogin) return;
  window.__domainAccountLogin=true;
  let host,root,site,signature='',timer,claiming=false,picking=null,highlight,dragging=false;
  const ask=message=>chrome.runtime.sendMessage(message);
  function shell() {
    if(host?.isConnected) return;
    host=document.createElement('div');host.id='domain-account-login';
    host.style.cssText=picking
      ?'all:initial!important;position:fixed!important;bottom:0!important;left:0!important;width:100%!important;z-index:2147483647!important;'
      :'all:initial!important;position:fixed!important;width:62px!important;z-index:2147483647!important;';
    root=host.attachShadow({mode:'open'});
    const style=document.createElement('style');style.textContent=`
      :host{color-scheme:light}*{box-sizing:border-box}button{font:12px/1.3 system-ui,sans-serif;word-break:keep-all;color:#303943;cursor:pointer;border:0;background:transparent;border-radius:6px;min-height:44px;width:52px;padding:4px}button:hover{background:#edf1f6}button:focus-visible{outline:2px solid #2466bb;outline-offset:-2px}button:disabled{opacity:.5;cursor:wait}
      .panel{font:13px/1.5 system-ui,sans-serif;color:#303943;padding:4px;width:62px;border:1px solid #d5dae1;border-radius:10px;background:#fff;box-shadow:0 3px 14px #172b4426;animation:arrive .18s ease-out;user-select:none}
      .grip{cursor:grab;touch-action:none;min-height:44px;display:block;color:#7a8591;font-size:19px;letter-spacing:3px;line-height:1}.grip:active{cursor:grabbing;background:#edf1f6}.toggle{background:#edf3fc;color:#235b9f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.toggle::after{content:'⌃';font:12px/8px system-ui}.toggle[aria-expanded=false]::after{content:'⌄'}
      .body{max-height:calc(100dvh - 126px);opacity:1;transform:translateY(0);transition:max-height .18s ease,opacity .16s ease,transform .18s ease;overflow:hidden}.body.closed{max-height:0;opacity:0;transform:translateY(-6px)}
      .accounts{display:flex;flex-direction:column;gap:2px;max-height:calc(100dvh - 174px);overflow-y:auto;scrollbar-width:thin;margin-top:4px}.account{flex:none;font-weight:500}.settings{color:#66717e;border-top:1px solid #e7eaf0;border-radius:0;margin-top:4px;font-size:11px}
      .tooltip,.status{position:fixed;font:13px/1.5 system-ui,sans-serif;word-break:keep-all;overflow-wrap:anywhere;pointer-events:none;max-width:min(260px,calc(100vw - 92px));border-radius:6px;padding:8px 11px;box-shadow:0 2px 8px #172b4426;z-index:1}.tooltip{background:#293441;color:white;animation:arrive .12s ease-out}.tooltip[hidden],.status:empty{display:none}.status{background:#fff;color:#303943;border:1px solid #d5dae1;pointer-events:auto;margin:0}
      .pick{font:16px/1.5 system-ui;padding:16px 20px;background:#185abc;color:white}.pick button{margin-left:16px;background:#fff;width:auto;padding:8px 12px}
      @keyframes arrive{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.panel,.tooltip{animation:none}.body{transition:none}}
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
  const abbreviation=alias=>{
    const inner=alias.match(/\(([^()]*)\)\s*$/)?.[1]||alias;
    const text=inner.replace(/\s+/g,'');
    return [...text].slice(0,/^[\x00-\x7f]+$/.test(text)?4:3).join('');
  };
  function bounds() {return {x:Math.max(0,innerWidth-24-host.offsetWidth),y:Math.max(0,innerHeight-24-host.offsetHeight)};}
  function place() {
    if(!host?.isConnected || picking || dragging)return;
    const b=bounds(),f=site.floating;
    host.style.setProperty('left',`${Math.min(12,Math.max(0,innerWidth-host.offsetWidth))+b.x*f.x}px`,'important');
    host.style.setProperty('top',`${Math.min(12,Math.max(0,innerHeight-host.offsetHeight))+b.y*f.y}px`,'important');
    root.querySelector('.tooltip').hidden=true;positionNote(root.querySelector('.status'));
  }
  function positionNote(note,anchor=host) {
    const r=anchor.getBoundingClientRect(),h=host.getBoundingClientRect();
    const right=h.x>innerWidth/2;
    note.style.left=right?'auto':`${h.right+8}px`;note.style.right=right?`${innerWidth-h.left+8}px`:'auto';
    note.style.top=`${Math.max(8,Math.min(r.top,innerHeight-note.offsetHeight-8))}px`;
  }
  function status(text) {const note=root?.querySelector('.status');if(note){note.textContent=text;positionNote(note);}}
  async function persist() {
    signature=JSON.stringify(site);
    try {const r=await ask({type:'SAVE_FLOATING',floating:{...site.floating}});if(!r.ok)throw Error(r.error);}
    catch(e){status(e.message);}
  }
  function moveTo(x,y) {
    const b=bounds(),left=Math.min(12,Math.max(0,innerWidth-host.offsetWidth)),top=Math.min(12,Math.max(0,innerHeight-host.offsetHeight));
    site.floating.x=b.x?Math.max(0,Math.min(1,(x-left)/b.x)):0;
    site.floating.y=b.y?Math.max(0,Math.min(1,(y-top)/b.y)):0;
    const active=dragging;dragging=false;place();dragging=active;
  }
  async function claim() {
    if(claiming)return;
    claiming=true;
    try {const r=await ask({type:'CLAIM',pageUrl:location.href});if(!r.ok)status(r.error);} finally {claiming=false;}
  }
  async function refresh() {
    if(picking || dragging) return;
    try {
      const response=await ask({type:'PAGE'});
      if(!response.site) {host?.remove();signature='';return;}
      const next=JSON.stringify(response.site);
      if(signature===next && host?.isConnected) {await claim();return;}
      site=response.site;signature=next;shell();root.querySelector('.panel')?.remove();root.querySelector('.tooltip')?.remove();root.querySelector('.status')?.remove();
      const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','저장한 계정으로 로그인');
      const tooltip=document.createElement('div');tooltip.className='tooltip';tooltip.id='account-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
      const note=document.createElement('p');note.className='status';note.setAttribute('role','status');
      const body=document.createElement('div');body.className='body';body.id='account-list';
      const grip=button('⠿',()=>{},'grip');grip.setAttribute('aria-label','계정 버튼 이동');grip.title='드래그로 이동 · 방향키로 이동';
      let drag;
      grip.addEventListener('pointerdown',e=>{if(!e.isTrusted || e.button!==0)return;const r=host.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.x,dy:e.clientY-r.y};dragging=true;grip.setPointerCapture(e.pointerId);e.preventDefault();tooltip.hidden=true;});
      grip.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)moveTo(e.clientX-drag.dx,e.clientY-drag.dy);});
      const finish=e=>{if(drag?.id!==e.pointerId)return;drag=null;dragging=false;place();persist();};
      grip.addEventListener('pointerup',finish);grip.addEventListener('pointercancel',finish);grip.addEventListener('lostpointercapture',finish);
      grip.addEventListener('keydown',e=>{if(!e.isTrusted)return;const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];if(!delta)return;e.preventDefault();const r=host.getBoundingClientRect();moveTo(r.x+delta[0],r.y+delta[1]);persist();});
      const toggle=button('계정',()=>{site.floating.expanded=!site.floating.expanded;expand();persist();},'toggle');toggle.setAttribute('aria-controls',body.id);
      const expand=()=>{const open=site.floating.expanded;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'계정 목록 접기':'계정 목록 펼치기');body.classList.toggle('closed',!open);body.inert=!open;tooltip.hidden=true;place();};
      const list=document.createElement('div');list.className='accounts';
      for(const a of site.accounts) {
        const b=button(abbreviation(a.alias),async()=>{
          tooltip.hidden=true;const buttons=[...panel.querySelectorAll('button')];buttons.forEach(x=>x.disabled=true);
          try {status('로그인을 준비하고 있습니다…');const r=await ask({type:'LOGIN',accountId:a.id,navigate:!loginVisible(),pageUrl:location.href});if(!r.ok)throw Error(r.error);status(r.loggingOut?'기존 계정을 로그아웃하고 있습니다…':r.navigating?'로그인 화면으로 이동합니다…':'로그인 버튼을 눌렀습니다. 사이트의 결과를 확인하세요.');}
          catch(e){status(e.message);}finally{buttons.forEach(x=>x.disabled=false);}
        },'account');
        b.setAttribute('aria-label',a.alias);b.setAttribute('aria-describedby',tooltip.id);
        const show=()=>{tooltip.textContent=a.alias;tooltip.hidden=false;positionNote(tooltip,b);};
        b.addEventListener('mouseenter',show);b.addEventListener('focus',show);b.addEventListener('mouseleave',()=>{if(root.activeElement!==b)tooltip.hidden=true;});b.addEventListener('blur',()=>tooltip.hidden=true);list.append(b);
      }
      body.append(list,button('설정',()=>ask({type:'OPEN'}),'settings'));panel.append(grip,toggle,body);root.append(panel,tooltip,note);expand();
      new ResizeObserver(()=>{if(host?.isConnected && root.contains(panel))place();}).observe(panel);
      await claim();
    } catch {host?.remove();signature='';}
  }
  addEventListener('resize',()=>place());
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
    text.textContent=`${{username:'아이디 입력란',password:'비밀번호 입력란',submit:'로그인 버튼',logout:'로그아웃 버튼'}[picking]}을 클릭하세요. 선택 클릭은 로그인하지 않습니다.`;
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
