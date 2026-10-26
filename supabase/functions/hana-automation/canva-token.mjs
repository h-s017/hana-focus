// Canva Connect single-use refresh-token handling, server-side only.
// A failed/uncertain refresh requires fresh owner authorization; never replay a one-use token.
const fail=code=>Object.assign(Error(code),{code});
export const CANVA_REQUIRED_SCOPE='design:content:write';
const includesScope=value=>String(value||'').split(' ').includes(CANVA_REQUIRED_SCOPE);
const validToken=(value)=>typeof value==='string'&&value.length>0&&value.length<=8192;
export function canvaTokenManager({store,encryption,clientId,clientSecret,ownerId,fetcher=fetch,now=Date.now}){
 async function get(owner){
  if(!encryption||!clientId||!clientSecret||!ownerId)throw fail('canva_oauth_setup_required');
  if(owner!==ownerId||!await store.googleOwnerAllowed(owner))throw fail('canva_oauth_owner_required');
  const row=await store.credential(owner,'canva');
  if(!row?.version||!row.ciphertext)throw fail('canva_reconnect_required');
  let value;try{value=await encryption.open(owner,row.ciphertext);}catch{throw fail('canva_reconnect_required');}
  if(!includesScope(value.scope)||!validToken(value.access_token)||!validToken(value.refresh_token)||!Number.isFinite(value.expires_at))throw fail('canva_reconnect_required');
  return {row,value};
 }
 async function save(owner,value,version){
  return store.saveCredential(owner,'canva',await encryption.seal(owner,value),version);
 }
 async function access(owner){
  const {row,value}=await get(owner);
  // A pending refresh is an unknown-outcome boundary; never retry the single-use token.
  if(value.refresh_state==='claimed')throw fail('canva_reconnect_required');
  if(value.expires_at>now()+120000)return {token:value.access_token,refreshPerformed:false};
  // CAS mark happens BEFORE contacting Canva. Only one worker can consume the token.
  // If the worker exits after consumption, the account must reauthorize rather than replay.
  let lease;
  try{lease=await save(owner,{...value,refresh_state:'claimed',refresh_claimed_at:now()},row.version);}
  catch{throw fail('canva_refresh_in_progress');}
  let raw,response;
  try{
   response=await fetcher('https://api.canva.com/rest/v1/oauth/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Basic '+btoa(clientId+':'+clientSecret),'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'refresh_token',refresh_token:value.refresh_token})
   });
   raw=await response.text();
  }catch{throw fail('canva_reconnect_required');}
  if(!response.ok||raw.length>20000)throw fail('canva_reconnect_required');
  let data;try{data=JSON.parse(raw);}catch{throw fail('canva_reconnect_required');}
  if(!validToken(data.access_token)||!validToken(data.refresh_token)||String(data.token_type).toLowerCase()!=='bearer'
   ||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=60||!includesScope(data.scope||value.scope))throw fail('canva_reconnect_required');
  const next={
   access_token:data.access_token,refresh_token:data.refresh_token,
   expires_at:now()+Math.min(Number(data.expires_in),86400)*1000,
   scope:data.scope||value.scope
  };
  try{await save(owner,next,lease);}catch{throw fail('canva_reconnect_required');}
  return {token:next.access_token,refreshPerformed:true};
 }
 return {access};
}
