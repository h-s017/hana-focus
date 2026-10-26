// Canva Connect REST: OAuth 2.0 Authorization Code + server-owned PKCE (S256).
// No Canva secret, verifier, access or refresh token is ever sent to the browser.
export const CANVA_CALLBACK='https://h-s017.github.io/hana-focus/canva-oauth-callback.html';
export const CANVA_SCOPES='design:content:write design:meta:read folder:read folder:write';
const fail=code=>Object.assign(Error(code),{code});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const rand=n=>b64(crypto.getRandomValues(new Uint8Array(n)));
const hash=async value=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
const requireScope=value=>{const granted=new Set(String(value||'').split(' ').filter(Boolean)),needed=CANVA_SCOPES.split(' ');return needed.every(s=>granted.has(s));};
const STATE_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;
export function canvaOAuth({clientId,clientSecret,ownerId,store,encryption,fetcher=fetch,now=Date.now}){
 const setup=Boolean(clientId&&clientSecret&&ownerId&&encryption);
 async function allowed(owner){
  if(!setup)throw fail('canva_oauth_setup_required');
  if(owner!==ownerId||!await store.googleOwnerAllowed(owner))throw fail('canva_oauth_owner_required');
 }
 async function token(params){
  let response,raw;
  try{
   response=await fetcher('https://api.canva.com/rest/v1/oauth/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Basic '+btoa(clientId+':'+clientSecret),'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(params)
   });
   raw=await response.text();
  }catch{throw fail('canva_oauth_upstream_failed');}
  if(!response.ok||raw.length>20000)throw fail('canva_oauth_upstream_failed');
  try{return JSON.parse(raw);}catch{throw fail('canva_oauth_upstream_failed');}
 }
 return async(owner,body)=>{
  if(body.action==='canva_oauth_status'){
   if(!setup||owner!==ownerId)return {configured:setup,credentials_saved:false,scopes:CANVA_SCOPES,external_writes:false};
   await allowed(owner);const existing=await store.credential(owner,'canva');
   return {configured:true,credentials_saved:!!existing,scopes:CANVA_SCOPES,external_writes:false};
  }
  await allowed(owner);
  if(!/^[A-Za-z0-9_-]{43}$/.test(body.browser_proof||''))throw fail('canva_oauth_browser_required');
  if(body.action==='canva_oauth_start'){
   if(await store.canvaOauthRecentCount(owner,new Date(now()-600000).toISOString())>=5)throw fail('canva_oauth_rate_limited');
   const id=crypto.randomUUID(),state=id+'.'+rand(32),verifier=rand(64),expires_at=now()+600000;
   const previous=await store.credential(owner,'canva');
   const payload=await encryption.seal(owner,{verifier,browser_hash:await hash(body.browser_proof),credential_version:previous?.version||null});
   await store.canvaOauthCreate(owner,id,{state_hash:await hash(state),expires_at,payload});
   const url=new URL('https://www.canva.com/api/oauth/authorize');
   url.search=new URLSearchParams({
    code_challenge:await hash(verifier),code_challenge_method:'S256',scope:CANVA_SCOPES,
    response_type:'code',client_id:clientId,state,redirect_uri:CANVA_CALLBACK
   }).toString();
   return {authorization_url:url.href,state,expires_at,scope:CANVA_SCOPES};
  }
  if(body.action!=='canva_oauth_finish'||!STATE_RE.test(body.state||'')||typeof body.code!=='string'||!body.code||body.code.length>4096)throw fail('canva_oauth_invalid');
  const id=body.state.split('.')[0],row=await store.canvaOauthGet(owner,id),details=row?.details;
  if(!details||!Number.isFinite(details.expires_at)||details.expires_at<=now()||!same(details.state_hash,await hash(body.state)))throw fail('canva_oauth_expired');
  let pending;try{pending=await encryption.open(owner,details.payload);}catch{throw fail('canva_oauth_invalid');}
  if(!same(pending.browser_hash,await hash(body.browser_proof)))throw fail('canva_oauth_browser_required');
  if(!await store.canvaOauthClaim(owner,id,details.state_hash,details.expires_at))throw fail('canva_oauth_expired');
  const result=await token({grant_type:'authorization_code',code:body.code,code_verifier:pending.verifier,redirect_uri:CANVA_CALLBACK});
  if(!requireScope(result.scope))throw fail('canva_oauth_scope_required');
  if(typeof result.access_token!=='string'||!result.access_token||result.access_token.length>8192
   ||typeof result.refresh_token!=='string'||!result.refresh_token||result.refresh_token.length>8192
   ||String(result.token_type).toLowerCase()!=='bearer'
   ||!Number.isFinite(Number(result.expires_in))||Number(result.expires_in)<=60)throw fail('canva_oauth_refresh_required');
  // CAS prevents a concurrent reconnect from overwriting the account's newer credentials.
  await store.saveCredential(owner,'canva',await encryption.seal(owner,{
   access_token:result.access_token,refresh_token:result.refresh_token,
   expires_at:now()+Math.min(Number(result.expires_in),86400)*1000,scope:CANVA_SCOPES
  }),pending.credential_version);
  let audit_recorded=true;
  try{await store.event(owner,'社群微課',null,null,'canva_oauth_connected',{scope:CANVA_SCOPES,canva_import_enabled:false,external_writes:false});}catch{audit_recorded=false;}
  return {status:'connected',credentials_saved:true,canva_import_enabled:false,external_writes:false,audit_recorded};
 };
}
