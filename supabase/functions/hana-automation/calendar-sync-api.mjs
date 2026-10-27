export const SYNC_SCOPES=['https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events'];
const fail=code=>Object.assign(Error(code),{code});
export function googleSyncApi({clientId,clientSecret,ownerId,store,encryption,fetcher=fetch,now=Date.now}){
 const root='https://www.googleapis.com/calendar/v3/calendars/primary/events';
 async function access(owner){
  if(owner!==ownerId||!clientId||!clientSecret||!encryption)throw fail('calendar_sync_authorization_required');
  const old=await store.credential(owner,'google_sync');if(!old)throw fail('calendar_sync_authorization_required');
  const value=await encryption.open(owner,old.ciphertext);
  if(!SYNC_SCOPES.every(s=>String(value.scope||'').split(' ').includes(s)))throw fail('calendar_sync_authorization_required');
  if(value.expires_at>now()+60000)return value.access_token;
  let r;try{r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:value.refresh_token,grant_type:'refresh_token'})});}catch{throw fail('calendar_sync_authorization_required');}
  const token=await r.json();if(!r.ok||!token.access_token||!SYNC_SCOPES.every(s=>String(token.scope||'').split(' ').includes(s)))throw fail('calendar_sync_authorization_required');
  await store.saveCredential(owner,'google_sync',await encryption.seal(owner,{...value,access_token:token.access_token,refresh_token:token.refresh_token||value.refresh_token,expires_at:now()+Math.min(Number(token.expires_in)||3600,86400)*1000}),old.version);
  return token.access_token;
 }
 async function request(owner,url,method='GET',body,etag){
  const token=await access(owner);let r;try{r=await fetcher(url,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(etag?{'If-Match':etag}:{})},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw fail('calendar_sync_unknown');}
  if((r.status===404||r.status===410)&&['GET','DELETE'].includes(method))return null;
  if(r.status===404||r.status===410)throw fail('calendar_sync_conflict');
  if(r.status===412)throw fail('calendar_sync_conflict');
  if(!r.ok)throw fail(r.status>=500?'calendar_sync_unknown':'calendar_sync_failed');
  if(r.status===204)return null;const text=await r.text();if(text.length>4000000)throw fail('calendar_sync_incomplete');return JSON.parse(text);
 }
 return {
  async list(owner){const events=[];let pageToken;const seen=new Set();for(let i=0;i<20;i++){
   const q=new URLSearchParams({privateExtendedProperty:'hana_owner='+owner,showDeleted:'true',maxResults:'250'});if(pageToken)q.set('pageToken',pageToken);
   const d=await request(owner,root+'?'+q);if(!Array.isArray(d?.items))throw fail('calendar_sync_incomplete');events.push(...d.items);pageToken=d.nextPageToken;if(!pageToken)return events;if(seen.has(pageToken))throw fail('calendar_sync_incomplete');seen.add(pageToken);
  }throw fail('calendar_sync_incomplete');},
  get:(owner,id)=>request(owner,root+'/'+encodeURIComponent(id)),
  async put(owner,id,payload,current){
   // Only the server's deterministic managed ID is used. Never invite attendees or send email.
   const body={...payload,extendedProperties:{private:{hana_owner:owner}},reminders:{useDefault:false,overrides:[]},transparency:'opaque'};
   if(current?.status==='cancelled')throw fail('calendar_sync_conflict');
   if(current){if(current.extendedProperties?.private?.hana_owner!==owner||!current.etag)throw fail('calendar_sync_conflict');return request(owner,root+'/'+encodeURIComponent(id)+'?sendUpdates=none','PATCH',body,current.etag);}
   return request(owner,root+'?sendUpdates=none','POST',{...body,id});
  },
  async remove(owner,id,current){if(!current||current.status==='cancelled')return;if(current.extendedProperties?.private?.hana_owner!==owner||!current.etag)throw fail('calendar_sync_conflict');await request(owner,root+'/'+encodeURIComponent(id)+'?sendUpdates=none','DELETE',undefined,current.etag);}
 };
}
export function reservationSyncApi({token,fetcher=fetch}){
 return async body=>{
  if(!token||token.length<32)throw fail('reservation_sync_setup_required');
  let r;try{r=await fetcher('https://hana-course-production.hana-reservation-payment.workers.dev/api/focus/calendar-sync',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{throw fail('calendar_sync_unknown');}
  const d=await r.json();if(!r.ok||d.ok!==true)throw fail(['SYNC_SOURCE_CHANGED','ENROLLED_REVIEW_REQUIRED','SYNC_DATE_BLOCKED','SYNC_TOO_SOON'].includes(d.error)?'calendar_sync_conflict':'reservation_sync_setup_required');return d;
 };
}
