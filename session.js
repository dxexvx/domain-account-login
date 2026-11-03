// Injected in the isolated world: use the site's normal logout control, never read session data.
export function sessionAction(expectedOrigin,selectors,action='inspect') {
  if(location.origin!==expectedOrigin)return {error:'대상 주소가 변경되어 계정 전환을 중단했습니다.'};
  try {
    const visible=e=>e&&!e.disabled&&!e.readOnly&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
    const loginReady=['username','password','submit'].every(f=>selectors[f]&&[...document.querySelectorAll(selectors[f])].some(visible));
    let logout;
    if(selectors.logout)logout=[...document.querySelectorAll(selectors.logout)];
    else {
      const exact=/^(로그아웃|log\s*out|sign\s*out)$/i;
      logout=[...document.querySelectorAll('button,a,[role="button"],li')].filter(e=>exact.test((e.getAttribute('aria-label')||e.textContent||'').trim()));
      // Nested labels represent one control; choose the innermost actionable element.
      logout=logout.filter(e=>!logout.some(child=>child!==e&&e.contains(child)));
    }
    if(action==='inspect')return {loginReady,signedIn:!loginReady&&logout.length===1};
    if(action!=='logout')return {error:'지원하지 않는 세션 동작입니다.'};
    if(logout.length>1)return {error:'로그아웃 요소가 여러 개입니다. 설정에서 로그아웃 요소를 지정하세요.'};
    if(!logout.length)return {absent:true};
    if(!(logout[0] instanceof HTMLElement)||logout[0].matches(':disabled,[aria-disabled="true"]'))return {error:'로그아웃 버튼을 사용할 수 없습니다.'};
    // Hidden account menus still carry the site's own logout handler.
    logout[0].click();return {clicked:true};
  } catch {return {error:'로그아웃 요소 설정을 확인하세요.'};}
}
