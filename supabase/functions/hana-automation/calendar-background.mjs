// Scheduled path: no browser session and no caller-selected owner or month.
export function calendarMonth(now,offset=0){
 if(![0,1].includes(offset))throw Error('calendar_worker_invalid');
 const d=new Date(now+8*3600000);
 return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1)).toISOString().slice(0,7);
}
export function calendarBackgroundWorker({store,run,ownerId,configured,now=Date.now}){
 const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 return async req=>{
  if(req.method!=='POST')return response({error:'method_not_allowed'},405);
  const token=req.headers.get('x-hana-calendar-worker')||'';
  if(!/^[0-9a-f]{64}$/.test(token))return response({error:'unauthorized'},401);
  try{if(!await store.calendarWorkerAuthorized(token))return response({error:'unauthorized'},401);}
  catch{return response({error:'calendar_worker_unavailable'},503);}
  const mode=new URL(req.url).pathname.endsWith('/calendar-worker-next')?'next':'current';
  let month;
  try{
   const status=await store.calendarBackgroundStatus();
   if(!status?.[mode])return response({status:'disabled'});
   if(!ownerId||!configured()||!await store.googleOwnerAllowed(ownerId)||!await store.credential(ownerId,'google_sync'))throw Object.assign(Error('calendar_sync_authorization_required'),{code:'calendar_sync_authorization_required'});
   month=calendarMonth(now(),mode==='next'?1:0);
   const result=await run(ownerId,{action:'calendar_sync_run',month});
   const state=result.status==='more_pending'?'partial':result.skipped>0?'partial':'complete';
   const receipt={month,mode,status:state,changed:result.changed,pending:result.pending,skipped:result.skipped,booking_writes:false};
   await store.event(ownerId,'日曆同步',null,null,'calendar_background_run',receipt);
   return response(receipt);
  }catch(e){
   const code=['calendar_sync_authorization_required','calendar_sync_owner_required','calendar_sync_busy','reservation_sync_setup_required','calendar_sync_incomplete'].includes(e?.code)?e.code:'calendar_background_failed';
   if(ownerId)try{await store.event(ownerId,'日曆同步',null,null,'calendar_background_failed',{mode,month,error_code:code,booking_writes:false});}catch{}
   return response({status:'blocked',error:code},503);
  }
 };
}
