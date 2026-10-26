import {databaseAdapter} from '../hana-agent/store.mjs';
export function automationStore({url,service,fetcher=fetch}) {
 const base=databaseAdapter({url,service,fetcher});
 async function request(path,method='GET',body,prefer='return=representation') {
  const r=await fetcher(url+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw Error('database_unavailable');return data;
 }
 const query=(table,params)=>table+'?'+new URLSearchParams(params),rpc=(name,body={})=>request('rpc/'+name,'POST',body);
 const store={...base.store,
  googleOwnerAllowed:owner=>rpc('hana_focus_allowed',{p_owner:owner}),
  async oauthRecentCount(owner,since){const rows=await request(query('hana_automation_events',{owner_id:'eq.'+owner,code:'in.(google_oauth_pending,google_oauth_claimed)',created_at:'gte.'+since,select:'id',limit:'5'}));return rows.length;},
  oauthCreate:(owner,id,details)=>request('hana_automation_events','POST',{id,owner_id:owner,project:'課程預約',code:'google_oauth_pending',details}),
  async oauthGet(owner,id){const rows=await request(query('hana_automation_events',{id:'eq.'+id,owner_id:'eq.'+owner,code:'eq.google_oauth_pending',select:'details'}));return rows[0]||null;},
  async oauthClaim(owner,id,stateHash,expires){const rows=await request(query('hana_automation_events',{id:'eq.'+id,owner_id:'eq.'+owner,code:'eq.google_oauth_pending','details->>state_hash':'eq.'+stateHash,'details->>expires_at':'eq.'+expires}),'PATCH',{code:'google_oauth_claimed',details:{consumed_at:new Date().toISOString()}});return rows.length===1;},
  async canvaOauthRecentCount(owner,since){const rows=await request(query('hana_automation_events',{owner_id:'eq.'+owner,code:'in.(canva_oauth_pending,canva_oauth_claimed)',created_at:'gte.'+since,select:'id',limit:'5'}));return rows.length;},
  canvaOauthCreate:(owner,id,details)=>request('hana_automation_events','POST',{id,owner_id:owner,project:'社群微課',code:'canva_oauth_pending',details}),
  async canvaOauthGet(owner,id){const rows=await request(query('hana_automation_events',{id:'eq.'+id,owner_id:'eq.'+owner,code:'eq.canva_oauth_pending',select:'details'}));return rows[0]||null;},
  async canvaOauthClaim(owner,id,stateHash,expires){const rows=await request(query('hana_automation_events',{id:'eq.'+id,owner_id:'eq.'+owner,code:'eq.canva_oauth_pending','details->>state_hash':'eq.'+stateHash,'details->>expires_at':'eq.'+expires}),'PATCH',{code:'canva_oauth_claimed',details:{consumed_at:new Date().toISOString()}});return rows.length===1;},
  async monthlyGet(owner,month){const rows=await request(query('hana_monthly_drafts',{owner_id:'eq.'+owner,month:'eq.'+month,select:'*'}));return rows[0]||null;},
  async monthlyReceipt(owner,id){const rows=await request(query('hana_automation_events',{id:'eq.'+id,owner_id:'eq.'+owner,code:'in.(monthly_saved,monthly_reviewed)',select:'details'}));return rows[0]?.details||null;},
  monthlySave:(owner,c)=>rpc('hana_monthly_save',{p_owner:owner,p_month:c.month,p_revision:c.revision,p_request:c.request,p_policy:c.policy,p_overrides:c.overrides,p_generated:c.generated,p_changed:c.changed}),
  monthlyReview:(owner,month,revision,decision,request)=>rpc('hana_monthly_review',{p_owner:owner,p_month:month,p_revision:revision,p_decision:decision,p_request:request}),
  monthlyScheduled:()=>rpc('hana_monthly_scheduled'),
  monthlyClaim:(owner,clock)=>rpc('hana_monthly_claim_day',{p_owner:owner,p_clock:clock}),
  async focusExternalTask(owner,provider,id){const rows=await request(query('hana_external_ids',{owner_id:'eq.'+owner,provider:'eq.'+provider,external_id:'eq.'+id,select:'task_id'}));return rows[0]||null;},
  focusSnapshot:owner=>rpc('hana_focus_snapshot',{p_owner:owner}),
  focusBootstrap:(owner,payload,id)=>rpc('hana_focus_bootstrap',{p_owner:owner,p_payload:payload,p_request:id}),
  focusImport:(owner,project,version,items,provider,id,backup)=>rpc('hana_focus_import',{p_owner:owner,p_project:project,p_version:version,p_items:items,p_provider:provider,p_request:id,p_backup_hash:backup}),
  focusUpdate:(owner,task,revision,patch,id)=>rpc('hana_focus_update',{p_owner:owner,p_task:task,p_revision:revision,p_patch:patch,p_request:id}),
  focusResolve:(owner,c,id)=>rpc('hana_focus_resolve',{p_owner:owner,p_conflict:c.conflict_id,p_task:c.task_id,p_revision:c.revision,p_decision:c.decision,p_request:id}),
  focusActivate:(owner,project,version,id)=>rpc('hana_focus_activate_version',{p_owner:owner,p_project:project,p_version:version,p_request:id}),
  focusRunStart:(owner,task,role,id)=>rpc('hana_focus_run_start',{p_owner:owner,p_task:task,p_role:role,p_request:id}),
  focusIdeas:(owner,workspace,items,backup,id)=>rpc('hana_focus_import_ideas',{p_owner:owner,p_workspace:workspace,p_items:items,p_backup_hash:backup,p_request:id}),
  async focusReceipt(owner,id){const rows=await request(query('hana_automation_events',{owner_id:'eq.'+owner,id:'eq.'+id,select:'code,details,project'}));return rows[0]||null;},
  async focusSyncState(owner,project){const rows=await request(query('hana_sync_state',{owner_id:'eq.'+owner,project_id:'eq.'+project,provider:'eq.notion',select:'*'}));return rows[0]||null;},
  focusMarkSync:(owner,project,id,details)=>request('hana_automation_events','POST',{id,owner_id:owner,project,code:'focus_sync_completed',details:{...details,external_writes:false}}),
  focusSyncInterval:(owner,project,minutes,id)=>rpc('hana_focus_sync_interval',{p_owner:owner,p_project:project,p_minutes:minutes,p_request:id}),
  focusSyncStatus:(owner,project,patch)=>request(query('hana_sync_state',{owner_id:'eq.'+owner,project_id:'eq.'+project,provider:'eq.notion'}),'PATCH',{...patch,updated_at:new Date().toISOString()}),
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

