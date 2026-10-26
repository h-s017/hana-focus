// Server-side Canva Connect access token management.
// The rotating refresh token is never exposed to GitHub Actions or the browser.
export function canvaApiClient({store,encryption,clientId,clientSecret,fetcher=fetch,now=Date.now}){
 const fail=code=>Object.assign(Error(code),{code});
 async function access(owner){
  const row=await store.credential(owner,'canva');
  if(!row||!encryption||!clientId||!clientSecret)throw fail('canva_import_connection_required');
  let saved;
  try{saved=await encryption.open(owner,row.ciphertext);}catch{throw fail('canva_import_connection_required');}
  if(!saved.scope?.split(' ').includes('design:content:write'))throw fail('canva_import_scope_required');
  if(typeof saved.access_token==='string' && Number(saved.expires_at)>now()+120000)return saved.access_token;
  let result;
  try{
   const auth=btoa(clientId+':'+clientSecret);
   const response=await fetcher('https://api.canva.com/rest/v1/oauth/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refresh_token})
   });
   if(!response.ok)throw Error('refresh');
   result=await response.json();
  }catch{throw fail('canva_import_refresh_failed');}
  if(typeof result?.access_token!=='string'||typeof result?.refresh_token!=='string'
    ||!Number.isFinite(Number(result.expires_in))||Number(result.expires_in)<=60)
   throw fail('canva_import_refresh_failed');
  const scope=typeof result.scope==='string'?result.scope:saved.scope;
  if(!scope.split(' ').includes('design:content:write'))throw fail('canva_import_scope_required');
  try{
   await store.saveCredential(owner,'canva',await encryption.seal(owner,{
    access_token:result.access_token,refresh_token:result.refresh_token,
    expires_at:now()+Number(result.expires_in)*1000,scope
   }),row.version);
  }catch{throw fail('canva_import_refresh_conflict');}
  return result.access_token;
 }
 return async function api(owner,path,method='GET',body){
  const token=await access(owner);
  let response,result;
  try{
   response=await fetcher('https://api.canva.com/rest/v1/'+path,{
    method,redirect:'error',signal:AbortSignal.timeout(18000),
    headers:{Authorization:'Bearer '+token,'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
   });
   if(!response.ok)throw Error('provider');
   result=await response.json();
  }catch{throw fail('canva_import_provider_unavailable');}
  return result;
 };
}
