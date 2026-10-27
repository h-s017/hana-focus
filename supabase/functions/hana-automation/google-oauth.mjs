// Google authorization codes pass through the browser; access/refresh tokens never do.
export const GOOGLE_SCOPE='https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_CALLBACK='https://h-s017.github.io/hana-focus/google-calendar-callback.html';
const fail=code=>Object.assign(Error(code),{code});
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=n=>encode(crypto.getRandomValues(new Uint8Array(n)));
const hash=async text=>encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
export function googleOAuth({clientId,clientSecret,ownerId,store,encryption,fetcher=fetch,now=Date.now,sync=false}){
 const kind=sync?'google_sync':'google',scope=sync?GOOGLE_SCOPE+' https://www.googleapis.com/auth/calendar.events':GOOGLE_SCOPE;
 async function json(url,options){let r,text;try{r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});text=await r.text();}catch{throw fail('google_oauth_upstream_failed');}if(!r.ok||text.length>65536)throw fail('google_oauth_upstream_failed');try{return JSON.parse(text);}catch{throw fail('google_oauth_upstream_failed');}}
 async function allowed(owner){if(!clientId||!clientSecret||!ownerId||!encryption)throw fail('google_oauth_setup_required');if(owner!==ownerId||!await store.googleOwnerAllowed(owner))throw fail('google_oauth_owner_required');}
 return async(owner,body)=>{
  await allowed(owner);
  if(!/^[A-Za-z0-9_-]{43}$/.test(body.browser_proof||''))throw fail('google_oauth_browser_required');
  if(body.action==='google_oauth_start'){
   if(await store.oauthRecentCount(owner,new Date(now()-600000).toISOString())>=5)throw fail('google_oauth_rate_limited');
   const id=crypto.randomUUID(),state=id+'.'+random(32),verifier=random(64),expires_at=now()+600000,old=await store.credential(owner,kind);
   const payload=await encryption.seal(owner,{verifier,browser_hash:await hash(body.browser_proof),credential_version:old?.version||null,kind});
   await store.oauthCreate(owner,id,{state_hash:await hash(state),expires_at,payload});
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:clientId,redirect_uri:GOOGLE_CALLBACK,response_type:'code',scope,state,code_challenge:await hash(verifier),code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false'}).toString();
   return {authorization_url:url.href,state,expires_at,scope};
  }
  if(body.action!=='google_oauth_finish'||!/^([0-9a-f-]{36})\.[A-Za-z0-9_-]{43}$/.test(body.state||'')||typeof body.code!=='string'||!body.code||body.code.length>2048)throw fail('google_oauth_invalid');
  const id=body.state.split('.')[0],row=await store.oauthGet(owner,id),details=row?.details;
  if(!details||!Number.isFinite(details.expires_at)||details.expires_at<=now()||!same(details.state_hash,await hash(body.state)))throw fail('google_oauth_expired');
  let pending;try{pending=await encryption.open(owner,details.payload);}catch{throw fail('google_oauth_invalid');}
  if(pending.kind!==kind)throw fail('google_oauth_invalid');
  if(!same(pending.browser_hash,await hash(body.browser_proof)))throw fail('google_oauth_browser_required');
  // Atomically replace pending code before any token exchange. A repeated callback loses the CAS.
  if(!await store.oauthClaim(owner,id,details.state_hash,details.expires_at))throw fail('google_oauth_expired');
  const token=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:body.code,code_verifier:pending.verifier,redirect_uri:GOOGLE_CALLBACK,grant_type:'authorization_code'})});
  const scopes=String(token.scope||'').split(' ').filter(Boolean);
  const expected=scope.split(' ');if(scopes.length!==expected.length||!expected.every(s=>scopes.includes(s)))throw fail('google_oauth_scope_required');
  if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>16000||typeof token.refresh_token!=='string'||!token.refresh_token||token.refresh_token.length>16000||String(token.token_type).toLowerCase()!=='bearer'||!Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=60)throw fail('google_oauth_refresh_required');
  const calendar=await json('https://www.googleapis.com/calendar/v3/calendars/primary?fields=timeZone',{method:'GET',headers:{Authorization:'Bearer '+token.access_token}});
  if(calendar.timeZone!=='Asia/Taipei')throw fail('calendar_timezone_required');
  // Reconnect never silently overwrites a credential changed since this flow started.
  await store.saveCredential(owner,kind,await encryption.seal(owner,{access_token:token.access_token,refresh_token:token.refresh_token,expires_at:now()+Math.min(Number(token.expires_in),86400)*1000,scope}),pending.credential_version);
  let audit_recorded=true;try{await store.event(owner,'課程預約',null,null,sync?'google_sync_oauth_connected':'google_oauth_connected',{scope,monthly_verified:false,external_writes:false});}catch{audit_recorded=false;}
  return {status:'connected',google_read_verified:true,sync_authorized:sync,monthly_verified:false,audit_recorded,external_writes:false};
 };
}
