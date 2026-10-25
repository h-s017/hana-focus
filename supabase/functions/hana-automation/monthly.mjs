import {createMonthlyDraft,applyMonthlyOverrides,monthlyDiff,monthBounds,validatePolicy,monthEndPlan} from '../../../js/monthly-calendar.mjs';
const fail=code=>Object.assign(Error(code),{code});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function monthlyService({store,readSources,now=Date.now}){
 return async(owner,body)=>{
  let bounds;try{bounds=monthBounds(body.month);}catch{throw fail('invalid_monthly');}
  if(body.action==='monthly_load')return {record:await store.monthlyGet(owner,body.month),scheduleEnabled:false,externalWrites:false};
  if(!uuid.test(body.request_id||'')||!Number.isInteger(body.revision)||body.revision<0)throw fail('invalid_monthly');
  const prior=await store.monthlyGet(owner,body.month);
  // A committed replay is acknowledged, without fetching upstream again.
  const replay=await store.monthlyReceipt(owner,body.request_id);
  if(replay){if(replay.month!==body.month||replay.action!==body.action)throw fail('monthly_conflict');return {record:prior,duplicate:true,externalWrites:false};}
  if((prior?.revision||0)!==body.revision)throw fail('monthly_conflict');
  if(body.action==='monthly_review'){
   if(!['approved','rejected'].includes(body.decision)||!prior)throw fail('invalid_monthly');
   return {record:await store.monthlyReview(owner,body.month,body.revision,body.decision,body.request_id),externalWrites:false};
  }
  let policy=body.policy??prior?.policy??{},overrides=body.overrides??prior?.overrides??{};
  try{if(Object.keys(policy).length&&!validatePolicy(policy))throw Error();if(!policy||Array.isArray(policy))throw Error();}catch{throw fail('invalid_monthly');}
  // Validate an override even when a source is disconnected. Only blocking a day is supported.
  try{applyMonthlyOverrides(createMonthlyDraft({month:body.month}),overrides);}catch{throw fail('invalid_monthly');}
  let source,sourceStatus={calendar:'needs_connection',reservation:'not_checked'};
  if(readSources){try{const start=new Date(Date.parse(bounds.start)-(policy.bufferAfterMinutes||0)*60000).toISOString(),end=new Date(Date.parse(bounds.end)+(policy.bufferBeforeMinutes||0)*60000).toISOString();source=await readSources(owner,start,end);sourceStatus={calendar:'verified',reservation:'verified'};}catch(error){sourceStatus={calendar:error.code==='calendar_authorization_required'?'needs_connection':'unverified',reservation:'unverified'};}}
  let generated;try{generated=applyMonthlyOverrides(createMonthlyDraft({month:body.month,policy,overrides,events:source?.events||[],slots:source?.slots||[],sources:{calendar:!!source,reservation:!!source}}),overrides);}catch{sourceStatus={calendar:'unverified',reservation:'unverified'};generated=applyMonthlyOverrides(createMonthlyDraft({month:body.month,policy,sources:{}}),overrides);}
  generated={...generated,sourceStatus,checkedAt:new Date(now()).toISOString(),sourceCheckedAt:source?.checked_at||null,policyConfigured:!!Object.keys(policy).length};
  // Store only availability aggregates, never raw Google events or Reservation customer records.
  const changed=monthlyDiff(prior?.generated,generated);
  generated.changedDates=changed;
  const record=await store.monthlySave(owner,{month:body.month,revision:body.revision,request:body.request_id,policy,overrides,generated,changed});
  return {record,changedDates:changed,scheduleEnabled:false,externalWrites:false};
 };
}
export function monthlyWorker({store,run,enabled,verify,now=Date.now}){
 return async req=>{
  if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405});
  const token=req.headers.get('x-hana-monthly-token')||'';
  if(!await verify(token))return Response.json({error:'unauthorized'},{status:401});
  if(!enabled())return Response.json({status:'disabled',externalWrites:false});
  const clock=new Date(now()),local=new Date(now()+8*3600000),day=local.toISOString().slice(0,10),plan=monthEndPlan(day);
  if(!plan.shouldRun||local.getUTCHours()!==8)return Response.json({status:'outside_window',externalWrites:false});
  const results=[];
  for(const setting of (await store.monthlyScheduled()).slice(0,10)){
   if(!await store.monthlyClaim(setting.owner_id,clock.toISOString()))continue;
   try{const prior=await store.monthlyGet(setting.owner_id,plan.targetMonth);
    const value=await run(setting.owner_id,{action:'monthly_generate',month:plan.targetMonth,revision:prior?.revision||0,request_id:crypto.randomUUID(),policy:setting.policy});results.push({status:value.record?.state||'unverified'});
   }catch{await store.event(setting.owner_id,'課程預約',null,null,'monthly_job_failed',{run_day:day,requires_human:true,external_writes:false});results.push({status:'failed'});}
  }
  return Response.json({status:'processed',results,externalWrites:false,paid_api_calls:0});
 };
}
