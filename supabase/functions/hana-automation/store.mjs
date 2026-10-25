import {databaseAdapter} from '../hana-agent/store.mjs';
export function automationStore({url,service,fetcher=fetch}) {
 const base=databaseAdapter({url,service,fetcher});
 async function request(path,method='GET',body,prefer='return=representation') {
  const r=await fetcher(url+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw Error('database_unavailable');return data;
 }
 const query=(table,params)=>table+'?'+new URLSearchParams(params),rpc=(name,body={})=>request('rpc/'+name,'POST',body);
 const store={...base.store,
  claimRules:cap=>rpc('hana_automation_claim_rules',{p_cap:cap}),
  bookingChanges:owner=>request(query('hana_booking_changes',{owner_id:'eq.'+owner,select:'*',order:'created_at.desc',limit:'50'})),
  async bookingGet(owner,id){const rows=await request(query('hana_booking_changes',{owner_id:'eq.'+owner,id:'eq.'+id,select:'*'}));return rows[0]||null;},
  bookingSave:(owner,requestId,c)=>rpc('hana_booking_save',{p_owner:owner,p_request:requestId,p_target:c.target,p_target_id:c.target_id,p_proposal:c.proposal,p_snapshot:c.source_snapshot,p_verified:c.source_verified}),
  bookingReview:(owner,id,decision)=>rpc('hana_booking_review',{p_owner:owner,p_change:id,p_decision:decision}),
  recover:()=>rpc('hana_automation_recover'),advance:()=>rpc('hana_automation_advance'),claim:cap=>rpc('hana_automation_claim',{p_cap:cap}),
  async allowed(owner,project){const rows=await request(query('hana_automation_settings',{owner_id:'eq.'+owner,project:'eq.'+project,select:'enabled'}));return rows[0]?.enabled===true;},
  event:(owner,project,task,run,code,details={})=>request('hana_automation_events','POST',{owner_id:owner,project,task_id:task,run_id:run,code,details}),
  settings:owner=>request(query('hana_automation_settings',{owner_id:'eq.'+owner,select:'*'})),
  configure:(owner,settings)=>request('hana_automation_settings?on_conflict=owner_id,project','POST',{owner_id:owner,...settings,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation'),
  tasks:owner=>request(query('hana_tasks',{owner_id:'eq.'+owner,select:'id,project,title,status,due_at,created_at',order:'created_at.desc',limit:'100'})),
  events:owner=>request(query('hana_automation_events',{owner_id:'eq.'+owner,select:'project,task_id,code,created_at',order:'created_at.desc',limit:'20'})),
  retry:(owner,task)=>rpc('hana_automation_retry',{p_owner:owner,p_task:task}),
  async credential(owner,kind){const rows=await request(query('hana_connector_credentials',{owner_id:'eq.'+owner,kind:'eq.'+kind,select:'ciphertext,version'}));return rows[0]||null;},
  async saveCredential(owner,kind,ciphertext,version=null){
   const next=crypto.randomUUID();
   const rows=version?await request(query('hana_connector_credentials',{owner_id:'eq.'+owner,kind:'eq.'+kind,version:'eq.'+version}),'PATCH',{ciphertext,version:next}):await request('hana_connector_credentials','POST',{owner_id:owner,kind,ciphertext,version:next});
   if(!rows.length)throw Error('credential_changed');return next;
  }
 };
 return {authenticate:base.authenticate,store};
}
