import {beginGoogleConnection,googleMessage} from './google-connect.mjs';
import {beginCanvaConnection,canvaMessage,canvaSetupDiagnostic} from './canva-connect.mjs?v=office-20261101-r1';
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
 const canva=document.createElement('section');canva.id='office-canva-connection';
 const canvaTitle=document.createElement('h3');canvaTitle.textContent='Canva Connect｜社群小編與專案經理';
 const canvaStatus=document.createElement('p');canvaStatus.setAttribute('role','status');canvaStatus.textContent='尚未確認 Canva 服務端授權。';
 const canvaHelp=document.createElement('p');canvaHelp.textContent='使用 Canva Developer 的 Outside Canva 應用程式，將 Client Secret 安全存放至 Supabase 後才能啟用授權。連線成功只代表憑證已安全保存，不代表 Canva 自動匯入、對外發布已開啟。';
 const canvaLink=document.createElement('a');canvaLink.href='https://www.canva.com/developers/apps';canvaLink.textContent='開啟 Canva 開發者後台';canvaLink.target='_blank';canvaLink.rel='noopener noreferrer';
 const canvaSecrets=document.createElement('a');canvaSecrets.href='https://supabase.com/dashboard/project/ihmvziqisputjnjkuhvm/settings/functions';canvaSecrets.textContent='開啟 Supabase Edge Functions Secrets';canvaSecrets.target='_blank';canvaSecrets.rel='noopener noreferrer';
 const canvaVerify=document.createElement('button');canvaVerify.type='button';canvaVerify.textContent='檢查 Canva 服務端設定';
 const canvaConnect=document.createElement('button');canvaConnect.type='button';canvaConnect.textContent='連接 Canva（OAuth）';
 canvaConnect.onclick=async()=>{if(!signedIn||!db)return;canvaConnect.disabled=true;canvaStatus.textContent='準備前往 Canva 官方 OAuth 授權…';try{await beginCanvaConnection({db,storage:sessionStorage,navigate:url=>location.assign(url)});}catch(error){canvaStatus.textContent=canvaMessage(error.code);}finally{canvaConnect.disabled=false;}};
 canvaVerify.onclick=async()=>{if(!signedIn||!db)return;canvaVerify.disabled=true;try{
  const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'canva_oauth_status'}});
  if(error||data?.error)throw Error('unavailable');
  if(data.configured){
   canvaStatus.textContent=data.credentials_saved?'已加密儲存 Canva 授權憑證；每日匯入是否成功請點「查看今日 Canva 自動匯入紀錄」。':'Canva OAuth 服務端設定齊備，但尚未授權；請點「連接 Canva」。';
  }else{
   const checked=await db.functions.invoke('hana-automation',{body:{action:'status'}});
   canvaStatus.textContent=checked.error||checked.data?.error?'Canva 服務端仍缺少必要設定，但目前無法核對具體項目。請確認 Supabase Edge Secrets。':canvaSetupDiagnostic(checked.data?.readiness).message;
  }
 }catch{canvaStatus.textContent='無法確認 Canva 後端是否已部署；尚未建立授權，不要將此狀態視為成功。';}finally{canvaVerify.disabled=false;}};
 const canvaDailyCheck=document.createElement('button');canvaDailyCheck.type='button';canvaDailyCheck.textContent='查看今日 Canva 自動匯入紀錄';
 const canvaDailyStatus=document.createElement('p');canvaDailyStatus.setAttribute('role','status');canvaDailyStatus.textContent='尚未讀取今日匯入結果。';
 const canvaDailyLink=document.createElement('a');canvaDailyLink.hidden=true;canvaDailyLink.target='_blank';canvaDailyLink.rel='noopener noreferrer';canvaDailyLink.textContent='在 Canva 編輯今日六頁微課';
 canvaDailyCheck.onclick=async()=>{
  if(!signedIn||!db)return;
  canvaDailyCheck.disabled=true;
  try{
   const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'canva_import_status'}});
   if(error||data?.error)throw Error('unavailable');
   const messages={
    not_started:'今日尚未建立 Canva 自動匯入工作。',
    source_not_ready:'今日文案或六張原創圖像尚未備齊，不會用佔位圖替代。',
    reserved:'今日匯入已保留，尚未送出。',
    submitting:'已開始送出；為避免重複，系統不會再次提交。',
    in_progress:'Canva 正在匯入今日教材，等待下次排程驗證。',
    failed:'今日匯入失敗，請查看後端紀錄；不會自動重複建立。',
    needs_verification:'需要人工確認設計與六頁完整性，不會自動重新匯入。',
    success:'今日六頁已匯入 Canva，視覺仍待 HANA 審核；尚未發布 IG／FB。'
   };
   canvaDailyStatus.textContent=(data.date||'今日')+'｜'+(data.status==='source_not_ready'&&data.reason==='layout_reference_required'?'原 Canva 版型尚未套用／核對，暫停自動匯入；不會用自訂版面替代。':messages[data.status]||'目前狀態尚未確認。');
   canvaDailyLink.hidden=true;
   if(data.status==='success'&&/^https:\/\/www\.canva\.com\/design\/[A-Za-z0-9_-]+\/edit$/.test(data.edit_url||'')){
    canvaDailyLink.href=data.edit_url;canvaDailyLink.hidden=false;
   }
  }catch{canvaDailyStatus.textContent='尚無法查詢今日 Canva 自動匯入資料；請檢查後端是否已發布。';canvaDailyLink.hidden=true;}
  finally{canvaDailyCheck.disabled=false;}
 };
 const canvaInfo=document.createElement('details');const canvaSummary=document.createElement('summary');canvaSummary.textContent='設定步驟（僅管理員）';canvaInfo.append(canvaSummary);
 const canvaSteps=document.createElement('p');canvaSteps.textContent='Canva Developer → HANA AI OFFICE → Outside Canva：請確認 Scopes 已開啟 design:content:write、design:meta:read、folder:read、folder:write，Redirect URL 為 https://h-s017.github.io/hana-focus/canva-oauth-callback.html。於 Supabase Edge Functions Secrets 設定 CANVA_CLIENT_ID、CANVA_CLIENT_SECRET、CANVA_OWNER_ID，以及既有 HANA_CONNECTOR_ENCRYPTION_KEY（不得覆寫既有加密金鑰）。請勿將 Client Secret 貼入聊天室或公開 GitHub。設定完成且後端與頁面已正式發布後，再返回按連接。';canvaInfo.append(canvaSteps,canvaLink,document.createElement('br'),canvaSecrets);
 canva.append(canvaTitle,canvaStatus,canvaHelp,canvaVerify,canvaConnect,canvaDailyCheck,canvaDailyStatus,canvaDailyLink,canvaInfo);settings.append(canva);
 const legacy=document.createElement('details');legacy.id='office-legacy-tools';
 const legacySummary=document.createElement('summary');legacySummary.textContent='封存與開發工具';legacy.append(legacySummary);
 const automation=document.getElementById('office-automation');if(automation){const group=document.createElement('details');const label=document.createElement('summary');label.textContent='進階：既有背景整理與 OneDrive 連線';group.append(label,automation);settings.append(group);}
 for(const id of ['office-agent-archive','office-calendar-demo']){const node=document.getElementById(id);if(node)legacy.append(node);}
 settings.append(legacy);
 document.getElementById('office-private').append(settings);
 const routes={work:['工作','office-focus'],projects:['品牌專案','office-focus'],agents:['三大 AI Agent','office-focus'],reviews:['需要我決定','office-focus'],activity:['執行紀錄','office-focus'],church:['教會工作','office-focus'],calendar:['月曆','hana-month-calendar'],orders:['預約','office-orders'],materials:['素材','office-materials'],settings:['設定','office-settings']};
 const parse=()=>{if(Object.hasOwn(routes,location.hash.slice(1)))return location.hash.slice(1);try{const saved=sessionStorage.getItem('hana-focus-destination');return Object.hasOwn(routes,saved)?saved:'work';}catch{return 'work';}};
 let active=parse(),signedIn=false;
 const buttons=new Map();
 function select(key,{focus=false}={}){
  active=Object.hasOwn(routes,key)?key:'work';
  if(signedIn&&['work','projects','agents','church','orders','materials'].includes(active)){
   const workspace=active==='church'?'church':'work';
   if(localStorage.getItem('hana-focus-active-workspace')!==workspace){
    localStorage.setItem('hana-focus-active-workspace',workspace);document.documentElement.dataset.focusWorkspace=workspace;
    window.dispatchEvent(new CustomEvent('hana-workspace-request',{detail:workspace}));
    window.dispatchEvent(new CustomEvent('hana-workspace-changed',{detail:workspace}));
   }
  }
  const selectedId=routes[active][1];
  for(const id of new Set(Object.values(routes).map(v=>v[1]))){const panel=document.getElementById(id);if(panel)panel.hidden=signedIn?id!==selectedId:id!=='hana-month-calendar';}
  for(const [value,b] of buttons)b.setAttribute('aria-current',value===({agents:'work',reviews:'work',activity:'projects',materials:'projects'}[active]||active)?'page':'false');
  try{sessionStorage.setItem('hana-focus-destination',active);}catch{}
  const accountHeading=host.querySelector('.office-account h2');if(accountHeading)accountHeading.textContent=signedIn?'帳號':'登入以開啟'+routes[active][0];
  if(!signedIn)googleStatus.textContent='請先登入，再檢查此網站的 Google 連線。';
  host.classList.toggle('is-signed-in',signedIn);host.dataset.destination=active;
  window.dispatchEvent(new CustomEvent('hana-focus-view',{detail:active}));
  if(focus){const panel=signedIn?document.getElementById(selectedId):host.querySelector('.office-account');panel?.setAttribute('tabindex','-1');panel?.focus({preventScroll:true});panel?.scrollIntoView({block:'start',behavior:'smooth'});}
 }
 if(tiles){for(const link of tiles.querySelectorAll('[data-view]'))buttons.set(link.dataset.view,link);}
 else for(const [key,label] of [['work','工作總覽'],['social','社群小編'],['projects','品牌專案'],['calendar','課程月曆'],['orders','預約明細'],['church','教會工作']]){
  if(key==='social'){const a=document.createElement('a');a.href='./social-editor.html';a.textContent=label;nav.append(a);continue;}
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.view=key;b.setAttribute('aria-controls',routes[key][1]);buttons.set(key,b);nav.append(b);
 }
 let utility=document.querySelector('.workspace-settings');
 if(!utility){utility=document.createElement('a');utility.className='workspace-settings';utility.href='#settings';utility.dataset.view='settings';utility.textContent='設定';utility.setAttribute('aria-label','連線與設定');host.querySelector('.office-account').prepend(utility);}
 buttons.set('settings',utility);
 for(const [key,b] of buttons)b.addEventListener('click',e=>{e.preventDefault();if(location.hash==='#'+key)select(key,{focus:true});else location.hash=key;});
 window.addEventListener('hashchange',()=>select(parse(),{focus:true}));
 window.addEventListener('hana-workspace-changed',()=>{if(signedIn&&document.documentElement.dataset.focusWorkspace==='church'&&['orders','materials'].includes(active)){location.hash='church';}});
 return {setSession(value){signedIn=Boolean(value);if(!tiles)nav.hidden=!signedIn;select(parse());}};
}
