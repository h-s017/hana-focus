import {beginGoogleConnection,googleMessage} from './google-connect.mjs';
// Existing icon destinations and compact navigation share one route, including refresh/back.
export function mountWorkspaceNavigation(host,{db}={}){
 const tiles=document.querySelector('nav.tiles');
 const nav=tiles||document.createElement('nav');nav.setAttribute('aria-label','工作台主要功能');
 if(!tiles){nav.className='workspace-nav';host.querySelector('#office-private').before(nav);}
 const settings=document.createElement('section');settings.id='office-settings';settings.hidden=true;
 const heading=document.createElement('h2');heading.textContent='連線與設定';settings.append(heading);
 const google=document.createElement('section');google.id='office-google-connection';
 const googleHead=document.createElement('h3');googleHead.textContent='Google Calendar 唯讀連線';
 const googleStatus=document.createElement('p');googleStatus.setAttribute('role','status');googleStatus.textContent='尚未檢查網站連線。';
 const googleHelp=document.createElement('p');googleHelp.textContent='按「連接 Google Calendar」前往 Google 官方頁面，同意日曆唯讀權限後返回工作台。ChatGPT 的連線不會自動授權給網站；此操作不修改行程、預約或寄送通知。';const connect=document.createElement('button');connect.type='button';connect.textContent='連接 Google Calendar';connect.onclick=async()=>{if(!signedIn||!db)return;connect.disabled=true;googleStatus.textContent='準備前往 Google 官方授權頁…';try{await beginGoogleConnection({db,storage:sessionStorage,navigate:url=>location.assign(url)});}catch(error){googleStatus.textContent=googleMessage(error.code);}finally{connect.disabled=false;}};
 const check=document.createElement('button');check.type='button';check.textContent='檢查網站設定';
 const verify=document.createElement('button');verify.type='button';verify.textContent='實際測試 Google 唯讀連線';
 const instructions=document.createElement('details'),summary=document.createElement('summary');summary.textContent='管理員設定步驟與目前限制';instructions.append(summary);
 const steps=document.createElement('p');steps.textContent='管理員需啟用 Google Calendar API、設定 OAuth 同意畫面與 Web 應用程式。核准的重新導向網址精確填入 https://h-s017.github.io/hana-focus/google-calendar-callback.html 。在 Supabase Edge Functions Secrets 安全設定 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_CALENDAR_OWNER_ID、HANA_CONNECTOR_ENCRYPTION_KEY。離線憑證會在本人同意後自動加密保存，不需手動產生或貼進聊天。既有加密金鑰不得覆寫；本機連線設定完成不代表月曆已驗證。';instructions.append(steps);
 for(const [text,url] of [['Google Cloud OAuth 設定','https://console.cloud.google.com/apis/credentials'],['Supabase 服務端安全設定','https://supabase.com/dashboard/project/ihmvziqisputjnjkuhvm/functions']]){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener noreferrer';instructions.append(a,document.createElement('br'));}
 async function probe(live){if(!signedIn||!db)return;check.disabled=verify.disabled=true;googleStatus.textContent=live?'正在測試 Google 來源…':'正在檢查網站設定…';try{const {data,error}=await db.functions.invoke('hana-automation',{body:{action:live?'focus_week':'status'}});if(error||data?.error)throw Error('unconfirmed');googleStatus.textContent=live?(data.status==='verified'?'Google 唯讀來源測試成功。回到月曆重新讀取，才能核對該月份行程。':'Google 來源尚未驗證；請先完成服務端授權。'):(data.readiness?.calendar?'服務端必要欄位已設定，仍需實際測試；不代表 Google 已驗證。':'服務端尚未具備必要欄位；請依管理員步驟完成授權設定。');if(!live&&data.readiness?.google_setup){const labels={client_id:'Google OAuth 用戶端',client_secret:'用戶端密鑰',owner:'授權工作台帳號',encryption:'安全加密金鑰'};const missing=Object.entries(data.readiness.google_setup).filter(([,v])=>v!==true).map(([k])=>labels[k]||'設定項目');if(missing.length)googleStatus.textContent+=' 尚待設定：'+missing.join('、')+'。';}}catch{googleStatus.textContent='連線未確認成功；請確認登入及服務端 OAuth 設定。未更動預約或行程。';}finally{check.disabled=verify.disabled=false;}}
 check.onclick=()=>probe(false);verify.onclick=()=>probe(true);google.append(googleHead,googleStatus,googleHelp,connect,check,verify,instructions);settings.append(google);
 for(const id of ['office-automation','office-agent-archive']){const node=document.getElementById(id);if(node)settings.append(node);}
 document.getElementById('office-private').append(settings);
 const routes={work:['工作','office-focus'],projects:['品牌專案','office-focus'],agents:['AI Studio','office-focus'],reviews:['審核中心','office-focus'],activity:['執行紀錄','office-focus'],church:['教會工作','office-focus'],calendar:['月曆','hana-month-calendar'],orders:['預約','office-orders'],materials:['素材','office-materials'],settings:['設定','office-settings']};
 const parse=()=>{if(Object.hasOwn(routes,location.hash.slice(1)))return location.hash.slice(1);try{const saved=sessionStorage.getItem('hana-focus-destination');return Object.hasOwn(routes,saved)?saved:'work';}catch{return 'work';}};
 let active=parse(),signedIn=false;
 const buttons=new Map();
 function select(key,{focus=false}={}){
  active=Object.hasOwn(routes,key)?key:'work';
  if(signedIn&&['work','projects','agents','church'].includes(active)){
   const workspace=active==='church'?'church':'work';
   if(localStorage.getItem('hana-focus-active-workspace')!==workspace){
    localStorage.setItem('hana-focus-active-workspace',workspace);document.documentElement.dataset.focusWorkspace=workspace;
    window.dispatchEvent(new CustomEvent('hana-workspace-request',{detail:workspace}));
    window.dispatchEvent(new CustomEvent('hana-workspace-changed',{detail:workspace}));
   }
  }
  const selectedId=routes[active][1];
  for(const id of new Set(Object.values(routes).map(v=>v[1]))){const panel=document.getElementById(id);if(panel)panel.hidden=signedIn?id!==selectedId:id!=='hana-month-calendar';}
  for(const [value,b] of buttons)b.setAttribute('aria-current',value===active?'page':'false');
  try{sessionStorage.setItem('hana-focus-destination',active);}catch{}
  const accountHeading=host.querySelector('.office-account h2');if(accountHeading)accountHeading.textContent=signedIn?'帳號':'登入以開啟'+routes[active][0];
  if(!signedIn)googleStatus.textContent='請先登入，再檢查此網站的 Google 連線。';
  host.classList.toggle('is-signed-in',signedIn);host.dataset.destination=active;
  window.dispatchEvent(new CustomEvent('hana-focus-view',{detail:active}));
  if(focus){const panel=signedIn?document.getElementById(selectedId):host.querySelector('.office-account');panel?.setAttribute('tabindex','-1');panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'start',behavior:'smooth'});}
 }
 if(tiles){for(const link of tiles.querySelectorAll('[data-view]'))buttons.set(link.dataset.view,link);}
 else for(const [key,label] of [['work','工作'],['calendar','月曆'],['orders','預約'],['materials','素材'],['settings','設定']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.view=key;b.setAttribute('aria-controls',routes[key][1]);buttons.set(key,b);nav.append(b);}
 for(const [key,b] of buttons)b.addEventListener('click',e=>{e.preventDefault();if(location.hash==='#'+key)select(key,{focus:true});else location.hash=key;});
 window.addEventListener('hashchange',()=>select(parse(),{focus:true}));
 window.addEventListener('hana-workspace-changed',()=>{if(signedIn&&document.documentElement.dataset.focusWorkspace==='church'&&['orders','materials'].includes(active)){location.hash='church';}});
 return {setSession(value){signedIn=Boolean(value);if(!tiles)nav.hidden=!signedIn;select(parse());}};
}
