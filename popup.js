import {originOf} from './core.js';
const $=id=>document.getElementById(id);let target;
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
async function init(){try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const url=new URL(tab.url);originOf(url.href);if(url.username||url.password)throw Error();target={tabId:tab.id,url:url.href,origin:url.origin};$('target').textContent=url.origin;$('auto-map').disabled=false;}catch{$('target').textContent='설정할 사이트의 로그인 화면을 먼저 열어주세요.';}}
$('manage').onclick=()=>chrome.runtime.openOptionsPage();
$('auto-map').onclick=()=>{
 if(!target)return;$('auto-map').disabled=true;notice('로그인 요소를 찾고 있습니다.');
 // Keep permission request directly in the click gesture; scope it to this exact origin.
 const permission=chrome.permissions.request({origins:[target.origin+'/*']});
 (async()=>{try{if(!(await permission))throw Error('해당 사이트 접근을 허용해야 매핑할 수 있습니다.');const r=await chrome.runtime.sendMessage({type:'MAP_LOGIN',tabId:target.tabId,url:target.url});if(!r?.ok)throw Error(r?.error||'매핑하지 못했습니다.');await chrome.runtime.openOptionsPage();window.close();}catch(e){notice(e.message,true);$('auto-map').disabled=false;}})();
};
init();
