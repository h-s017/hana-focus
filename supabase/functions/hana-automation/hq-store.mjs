import {hqError} from './hq-registry.mjs';
export function hqStore({url,service,fetcher=fetch}){
 const rpc=async(name,args)=>{
  let response;try{response=await fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args)});}catch{throw hqError('hq_persistence_uncertain');}
  const data=await response.json();
  if(!response.ok){const allowed=['hq_owner_required','hq_request_conflict','hq_state_conflict','hq_stale_attempt','hq_manual_record_required','hq_invalid_stage','hq_invalid_input'];throw hqError(allowed.includes(data.message)?data.message:data.code==='PGRST202'?'hq_setup_required':'hq_database_unavailable');}
  return data;
 };
 return {
  hqStart:(o,r,input,skill,retry)=>rpc('hana_hq_start',{p_owner:o,p_request:r,p_input:input,p_skill:skill,p_retry:retry}),
  hqFinish:(o,r,token,payload)=>rpc('hana_hq_finish',{p_owner:o,p_run:r,p_attempt:token,p_payload:payload}),
  hqSnapshot:o=>rpc('hana_hq_snapshot',{p_owner:o}),
  hqReview:(o,r,d,n)=>rpc('hana_hq_review',{p_owner:o,p_run:r,p_decision:d,p_note:n}),
  hqFollowup:(o,id,revision,next)=>rpc('hana_hq_followup',{p_owner:o,p_id:id,p_revision:revision,p_next:next}),
  hqTrack:(o,id,revision,stage,note)=>rpc('hana_hq_track',{p_owner:o,p_id:id,p_revision:revision,p_stage:stage,p_note:note})
 };
}
