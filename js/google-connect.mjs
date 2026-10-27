export const GOOGLE_RETURN='https://h-s017.github.io/hana-focus/workspace.html#settings';
export const GOOGLE_CALLBACK='https://h-s017.github.io/hana-focus/google-calendar-callback.html';
export const GOOGLE_PENDING='hana-google-oauth-pending-v1';
export const googleMessage=code=>({google_oauth_setup_required:'管理員尚需完成 Google OAuth 設定，請查看下方設定步驟。',google_oauth_owner_required:'此帳號未獲准連接這個網站的日曆。',google_oauth_browser_required:'授權必須在發起連線的同一個瀏覽器分頁完成，請重新開始。',google_oauth_expired:'授權已過期或已使用，請回工作台重新連接。',google_oauth_rate_limited:'短時間內連線次數過多，請十分鐘後再試。',google_oauth_scope_required:'未取得指定的日曆唯讀權限，請重新核對 Google 同意畫面。',google_oauth_refresh_required:'Google 未提供必要的離線授權，請回工作台重新連接。',calendar_timezone_required:'目前日曆時區不是 Asia/Taipei，需先由本人確認日曆設定。',google_oauth_upstream_failed:'Google 驗證未完成，請確認 Calendar API 已啟用，再重新連接。',login_required:'請先登入 HANA 工作台，再重新連接 Google。'})[code]||'連線結果未確認，請回工作台檢查連線，不要重複提交同一個授權連結。';
async function invoke(db,body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error){let code=data?.error;try{if(!code)code=(await error.context?.json())?.error;}catch{}throw Object.assign(Error('google_connection_failed'),{code});}return data;}
export async function beginGoogleConnection({db,storage,navigate,now=Date.now,sync=false}){
 const scope='https://www.googleapis.com/auth/calendar.readonly'+(sync?' https://www.googleapis.com/auth/calendar.events':'');
 const proof=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 // Verify browser storage before creating a server-side attempt.
 storage.setItem(GOOGLE_PENDING,JSON.stringify({proof,created_at:now()}));
 try{const data=await invoke(db,{action:sync?'google_sync_oauth_start':'google_oauth_start',browser_proof:proof});const url=new URL(data.authorization_url);
  if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth'||url.searchParams.get('state')!==data.state||url.searchParams.get('redirect_uri')!==GOOGLE_CALLBACK||url.searchParams.get('scope')!==scope||url.searchParams.get('code_challenge_method')!=='S256'||!Number.isFinite(data.expires_at)||data.expires_at<=now())throw Error('invalid_authorization_url');
  storage.setItem(GOOGLE_PENDING,JSON.stringify({proof,state:data.state,expires_at:data.expires_at,sync}));navigate(url.href);
 }catch(error){storage.removeItem(GOOGLE_PENDING);throw error;}
}
export async function finishGoogleConnection({db,storage,href,now=Date.now}){
 const url=new URL(href);let pending;try{pending=JSON.parse(storage.getItem(GOOGLE_PENDING)||'null');}catch{}
 if(!pending?.proof||pending.state!==url.searchParams.get('state')||pending.expires_at<=now())throw Object.assign(Error('invalid_browser'),{code:'google_oauth_browser_required'});
 try{
  if(url.searchParams.has('error'))throw Object.assign(Error('denied'),{code:'google_oauth_scope_required'});
  const {data:{session},error}=await db.auth.getSession();if(error||!session)throw Object.assign(Error('login'),{code:'login_required'});
  if(!url.searchParams.get('code'))throw Object.assign(Error('invalid_callback'),{code:'google_oauth_expired'});
  return await invoke(db,{action:pending.sync?'google_sync_oauth_finish':'google_oauth_finish',state:pending.state,code:url.searchParams.get('code'),browser_proof:pending.proof});
 }finally{storage.removeItem(GOOGLE_PENDING);}
}
