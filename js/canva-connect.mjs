// Only the one-time browser binding proof and state are stored locally.
// No Canva client secret, code verifier, access token, or refresh token is exposed.
export const CANVA_CALLBACK='https://h-s017.github.io/hana-focus/canva-oauth-callback.html';
export const CANVA_PENDING='hana-canva-oauth-pending-v1';
export const CANVA_SCOPES='design:content:write design:meta:read folder:read folder:write';
export const canvaMessage=code=>({
 canva_oauth_setup_required:'尚未在 Supabase 安全設定中完成 Canva Client ID／Secret、授權帳號及加密金鑰設定。',
 canva_oauth_owner_required:'此工作台帳號未被核准連接 Canva。',
 canva_oauth_browser_required:'請在開始 Canva 連線的同一個瀏覽器完成授權。',
 canva_oauth_expired:'Canva 授權已過期或使用過；請重新開始。',
 canva_oauth_rate_limited:'連線次數過多，請稍後再試。',
 canva_oauth_invalid:'授權資料不完整，請重新開始。',
 canva_oauth_upstream_failed:'Canva 未完成驗證，請檢查 Client Secret 和 Redirect URL。',
 canva_oauth_scope_required:'Canva 尚未授予建立設計及管理檔案的必要權限，請檢查 Scopes。',
 canva_oauth_refresh_required:'Canva 沒有提供持續授權所需的更新權杖，請重新授權。',
 login_required:'請先登入 HANA FOCUS，再連接 Canva。'
})[code]||'未確認 Canva 連線成功。請先檢查設定，不要重複提交同一筆授權。';
const invalid=code=>Object.assign(Error(code),{code});
async function invoke(db,body){
 const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error){
  let code=data?.error;try{if(!code)code=(await error.context?.json())?.error;}catch{}
  throw invalid(code||'canva_oauth_upstream_failed');
 }return data;
}
const proof=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function beginCanvaConnection({db,storage,navigate,now=Date.now}){
 const browserProof=proof();
 storage.setItem(CANVA_PENDING,JSON.stringify({proof:browserProof,created_at:now()}));
 try{
  const data=await invoke(db,{action:'canva_oauth_start',browser_proof:browserProof});
  const url=new URL(data.authorization_url),expiry=Number(data.expires_at);
  if(url.origin!=='https://www.canva.com'||url.pathname!=='/api/oauth/authorize'
   ||url.searchParams.get('state')!==data.state
   ||url.searchParams.get('redirect_uri')!==CANVA_CALLBACK
   ||url.searchParams.get('scope')!==CANVA_SCOPES
   ||url.searchParams.get('code_challenge_method')!=='S256'
   ||url.searchParams.get('response_type')!=='code'
   ||!Number.isFinite(expiry)||expiry<=now())throw invalid('canva_oauth_invalid');
  storage.setItem(CANVA_PENDING,JSON.stringify({proof:browserProof,state:data.state,expires_at:expiry}));
  navigate(url.href);return {status:'redirecting'};
 }catch(error){storage.removeItem(CANVA_PENDING);throw error;}
}
export async function finishCanvaConnection({db,storage,href,now=Date.now}){
 const url=new URL(href);let pending;try{pending=JSON.parse(storage.getItem(CANVA_PENDING)||'null');}catch{}
 const callback=new URL(CANVA_CALLBACK);
 if(url.origin!==callback.origin||url.pathname!==callback.pathname)throw invalid('canva_oauth_invalid');
 if(!pending?.proof||!pending.state||pending.state!==url.searchParams.get('state')
  ||!Number.isFinite(pending.expires_at)||pending.expires_at<=now())throw invalid('canva_oauth_browser_required');
 try{
  if(url.searchParams.has('error'))throw invalid('canva_oauth_invalid');
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session)throw invalid('login_required');
  const code=url.searchParams.get('code');
  if(!code)throw invalid('canva_oauth_invalid');
  return await invoke(db,{action:'canva_oauth_finish',state:pending.state,code,browser_proof:pending.proof});
 }finally{storage.removeItem(CANVA_PENDING);}
}
