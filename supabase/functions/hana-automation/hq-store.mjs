import {hqError} from './hq-registry.mjs';
export function hqStore({url,service,fetcher=fetch}){
 const rpc=async(name,args)=>{
  let response;try{response=await fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args)});}catch{throw hqError('hq_persistence_uncertain');}
  const data=await response.json();
  if(!response.ok){const allowed=['hq_owner_required','hq_request_conflict','hq_state_conflict','hq_stale_attempt','hq_manual_record_required','hq_invalid_stage','hq_invalid_input','hq_strategy_invalid','hq_strategy_conflict'];throw hqError(allowed.includes(data.message)?data.message:data.code==='PGRST202'?'hq_setup_required':'hq_database_unavailable');}
  return data;
 };
 return {
  hqProfile:(o,p)=>rpc('hana_hq_profile',{p_owner:o,p_profile:p}),
  hqStrategyGet:(o,asOf=null)=>rpc('hana_hq_strategy_get',{p_owner:o,p_as_of:asOf}),
  hqStrategyRunDay:(o,id)=>rpc('hana_hq_strategy_run_day',{p_owner:o,p_run:id}),
  hqStrategySave:(o,expected,payload)=>rpc('hana_hq_strategy_save',{p_owner:o,p_expected:expected,p_payload:payload}),
  hqStrategyFact:(o,fact)=>rpc('hana_hq_strategy_fact',{p_owner:o,p_fact:fact}),
  hqStrategyReport:(o,date,period)=>rpc('hana_hq_strategy_report',{p_owner:o,p_through:date,p_period:period}),
  hqDailyClaim:o=>rpc('hana_hq_daily_claim',{p_owner:o}),
  hqDailyFinish:(o,id,status,report,candidates,skill)=>rpc('hana_hq_daily_finish',{p_owner:o,p_id:id,p_status:status,p_report:report,p_candidates:candidates,p_skill:skill}),
  hqStart:(o,r,input,skill,retry)=>rpc('hana_hq_start',{p_owner:o,p_request:r,p_input:input,p_skill:skill,p_retry:retry}),
  hqFinish:(o,r,token,payload)=>rpc('hana_hq_finish',{p_owner:o,p_run:r,p_attempt:token,p_payload:payload}),
  hqSnapshot:o=>rpc('hana_hq_snapshot',{p_owner:o}),
  hqReview:(o,r,d,n)=>rpc('hana_hq_review',{p_owner:o,p_run:r,p_decision:d,p_note:n}),
  hqFollowup:(o,id,revision,next)=>rpc('hana_hq_followup',{p_owner:o,p_id:id,p_revision:revision,p_next:next}),
  hqTrack:(o,id,revision,stage,note)=>rpc('hana_hq_track',{p_owner:o,p_id:id,p_revision:revision,p_stage:stage,p_note:note})
 };
}
