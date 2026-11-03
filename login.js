// Runs only in the isolated world of the authorized top-level frame.
export async function fillAndSubmit(selectors, username, password) {
 try {
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.disabled;
  const find = selector => {
    const list = [...document.querySelectorAll(selector)].filter(visible);
    if(list.length!==1) throw new Error('로그인 요소가 없거나 여러 개입니다. 요소를 다시 지정하세요.');
    return list[0];
  };
  const id=find(selectors.username), pass=find(selectors.password), button=find(selectors.submit);
  if(!(id instanceof HTMLInputElement) || !(pass instanceof HTMLInputElement) || pass.type!=='password' || ['password','hidden','file','checkbox','radio'].includes(id.type)) throw new Error('아이디와 비밀번호 입력란을 다시 지정하세요.');
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  for(const [el,value] of [[id,username],[pass,password]]) {
    el.focus(); setter.call(el,value);
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  await new Promise(resolve=>setTimeout(resolve,120));
  // A rerender must not redirect the action to a different element.
  if(find(selectors.username)!==id || find(selectors.password)!==pass || find(selectors.submit)!==button || id.value!==username || pass.value!==password) throw new Error('입력 후 화면이 변경되었습니다. 다시 시도하세요.');
  button.click();
  return {submitted:true};
 } catch(error) {return {error:error.message};}
}
