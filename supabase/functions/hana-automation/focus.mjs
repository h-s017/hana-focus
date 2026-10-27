import {busyIntervals} from '../../../js/calendar-availability.mjs';
import {focusSummary,roleTool,localTask} from '../../../js/focus-domain.mjs';
import {digest,verifyBackup,localRows} from '../../../js/focus-backup.mjs';
import {schedule} from './calendar-sync.mjs';
const fail=code=>Object.assign(Error(code),{code});const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function focusService({store,notion,readCalendar,now=Date.now}){
 async function snapshot(owner){const value=await store.focusSnapshot(owner);value.tasks=value.tasks.map(t=>({...t,is_current:value.projects.some(p=>p.id===t.project_id&&p.active_version_id===t.version_id)}));value.summary=focusSummary(value.tasks,now());return value;}
 return async function service(owner,body){
  if(body.action==='focus_snapshot')return snapshot(owner);
  if(body.action==='focus_week'){if(!readCalendar)return {status:'needs_connection',busy:[]};const date=new Date(now()+8*3600000).toISOString().slice(0,10),start=date+'T00:00:00+08:00',end=new Date(Date.parse(start)+7*86400000).toISOString();const value=await readCalendar(owner,start,end);return {status:'verified',busy:busyIntervals(value.events,{start,end}),timeZone:'Asia/Taipei',external_writes:false};}
  if(!UUID.test(body.request_id||''))throw fail('invalid_focus_request');
  if(body.action==='focus_project'){validateProject(body.project);const result=await store.focusBootstrap(owner,body.project,body.request_id);return {result,snapshot:await snapshot(owner)};}
  if(body.action==='focus_import_bundle'){
   const bundle=body.bundle;if(!UUID.test(body.import_request_id||''))throw fail('invalid_focus_request');
   if(!bundle||bundle.format!=='hana-project-source-v1'||!bundle.project||!Array.isArray(bundle.tasks)||bundle.tasks.length>100)throw fail('invalid_focus_bundle');
   validateProject(bundle.project);
   // This is an explicit source snapshot import, not a live Notion connection or client approval.
   const {project_id,version_id}=await store.focusBootstrap(owner,bundle.project,body.request_id);
   const result=await store.focusImport(owner,project_id,version_id,bundle.tasks,'notion',body.import_request_id,null);return {result,snapshot:await snapshot(owner)};
  }
  if(body.action==='focus_migrate_local'){
   const backup=await verifyBackup(body.backup);if(!UUID.test(body.device_id||''))throw fail('invalid_focus_request');
   const current=await snapshot(owner),results=[];
   for(const group of localRows(backup)){
    if(group.tasks.length>500||group.ideas.length>500)throw fail('local_batch_too_large');
    const names=[...new Set(group.tasks.map(t=>t.project))];
    for(const name of names){
     let project=current.projects.find(p=>p.legacy_name===name&&p.workspace===group.workspace);
     if(!project){const result=await store.focusBootstrap(owner,{name,legacy_name:name,workspace:group.workspace,external_id:'local-project:'+group.workspace+':'+name,version:{label:'local-import-v1',version_date:new Date(now()+8*3600000).toISOString().slice(0,10),included_terms:[],excluded_terms:[],contract:{client_approved:false}},documents:[]},await derivedRequest(body.request_id,group.workspace+':'+name));project={id:result.project_id,active_version_id:result.version_id};}
     const rows=group.tasks.filter(t=>t.project===name).map(t=>localTask(t,group.workspace,body.device_id));
     for(let i=0;i<rows.length;i+=100)results.push(await store.focusImport(owner,project.id,project.active_version_id,rows.slice(i,i+100),'local',await derivedRequest(body.request_id,group.workspace+':'+name+':batch'+i),backup.checksum));
    }
    const occurrences=new Map();const ideas=[];for(const value of group.ideas){const content=typeof value==='string'?value:JSON.stringify(value),hash=await digest(content),occurrence=occurrences.get(hash)||0;occurrences.set(hash,occurrence+1);ideas.push({external_id:body.device_id+':'+group.workspace+':idea:'+hash+':'+occurrence,content});}
    if(ideas.length)await store.focusIdeas(owner,group.workspace,ideas,backup.checksum,await derivedRequest(body.request_id,group.workspace+':ideas'));
   }
   return {results,originalLocalDataRetained:true,snapshot:await snapshot(owner)};
  }
  if(body.action==='focus_create_task'){
   const window=body.schedule?schedule(body.schedule.schedule_start_at,body.schedule.schedule_end_at):null;
   const context=await snapshot(owner),project=context.projects.find(p=>p.id===body.project_id);if(!project?.active_version_id||typeof body.title!=='string'||!body.title.trim()||body.title.length>140)throw fail('invalid_focus_request');
   await store.focusImport(owner,project.id,project.active_version_id,[{external_id:'manual:'+body.request_id,title:body.title.trim(),brief:String(body.brief||'').slice(0,12000),work_state:'todo',priority:[1,2,3].includes(body.priority)?body.priority:2,assigned_role:'HANA',due_at:window?.schedule_end_at||body.due_at||null}], 'manual',body.request_id,null);
   const mapped=(window||body.auto_run===true)?await store.focusExternalTask(owner,'manual','manual:'+body.request_id):null;
   if(window&&mapped){const t=await store.calendarTask(owner,mapped.task_id);if(!t.schedule_start_at)await store.calendarTaskSchedule(owner,t.id,t.record_revision,window);}
   const result=value=>window?{...value,scheduled_task_id:mapped?.task_id}:value;
   if(body.auto_run===true&&mapped){const current=await snapshot(owner),created=current.tasks.find(t=>t.id===mapped.task_id);if(created?.scope_status==='in_scope'&&created.is_current)return result(await service(owner,{action:'focus_agent',task_id:created.id,role:'Project Manager',request_id:await derivedRequest(body.request_id,'auto-pm')}));}return result(await snapshot(owner));
  }
  if(body.action==='focus_update'){if(!UUID.test(body.task_id||'')||!Number.isInteger(body.revision))throw fail('invalid_focus_request');await store.focusUpdate(owner,body.task_id,body.revision,body.patch,body.request_id);return snapshot(owner);}
  if(body.action==='focus_resolve'){if(!UUID.test(body.conflict_id||'')||!UUID.test(body.task_id||'')||!Number.isInteger(body.revision))throw fail('invalid_focus_request');await store.focusResolve(owner,body,body.request_id);return snapshot(owner);}
  if(body.action==='focus_activate_version'){await store.focusActivate(owner,body.project_id,body.version_id,body.request_id);return snapshot(owner);}
  if(body.action==='focus_sync_interval'){await store.focusSyncInterval(owner,body.project_id,body.minutes,body.request_id);return snapshot(owner);}
  if(body.action==='focus_sync'){
   const state=await store.focusSyncState(owner,body.project_id);if(!state)throw fail('notion_source_required');
   const receipt=await store.focusReceipt(owner,body.request_id);if(receipt){if(receipt.code!=='focus_sync_completed'||receipt.details.project_id!==body.project_id)throw fail('request_conflict');await store.focusSyncStatus(owner,body.project_id,{state:receipt.details.result.conflicts?'conflicts':'success',cursor_at:receipt.details.cursor,error_code:null});return {duplicate:true,snapshot:await snapshot(owner)};}
   const context=await snapshot(owner),project=context.projects.find(p=>p.id===body.project_id),version=context.versions.find(v=>v.id===project?.active_version_id);if(!version)throw fail('project_required');
   try{await store.focusSyncStatus(owner,body.project_id,{state:'running',last_attempt_at:new Date(now()).toISOString(),error_code:null});
    const source=await notion(owner,{...state.config,version},state.cursor_at);if(!source.complete)throw fail('notion_incomplete');
    const result={added:0,updated:0,skipped:0,conflicts:0};for(let i=0;i<source.tasks.length;i+=100){const batch=await store.focusImport(owner,project.id,version.id,source.tasks.slice(i,i+100),'notion',await derivedRequest(body.request_id,'notion-batch:'+i),null);for(const key of Object.keys(result))result[key]+=batch[key]||0;}
    await store.focusMarkSync(owner,project.legacy_name,body.request_id,{project_id:project.id,cursor:source.cursor||state.cursor_at,result});
    await store.focusSyncStatus(owner,project.id,{state:result.conflicts?'conflicts':'success',cursor_at:source.cursor||state.cursor_at,last_success_at:new Date(now()).toISOString(),next_due_at:state.enabled?new Date(now()+(state.interval_minutes||60)*60000).toISOString():null,error_code:null});return {result,snapshot:await snapshot(owner)};
   }catch(error){const code=['notion_authorization_required','notion_source_required','notion_rate_limited','notion_incomplete','notion_scope_mismatch'].includes(error.code)?error.code:'notion_unavailable';try{await store.focusSyncStatus(owner,body.project_id,{state:'failed',error_code:code});await store.event(owner,project.legacy_name,null,null,'focus_sync_failed',{error_code:code,request_id:body.request_id,external_writes:false});}catch{}throw fail(code);}
  }
  if(body.action==='focus_agent'){
   if(!UUID.test(body.task_id||''))throw fail('invalid_focus_request');
   const context=await snapshot(owner),task=context.tasks.find(t=>t.id===body.task_id),project=context.projects.find(p=>p.id===task?.project_id),version=context.versions.find(v=>v.id===task?.version_id);
   if(!task||!task.is_current||task.scope_status!=='in_scope'||project?.workspace!=='work')throw fail('scope_or_version_required');
   if(body.simulate===true){return {mode:'simulation',persisted:false,result:'模擬預覽，未執行或保存為真實工作。\n'+roleTool(body.role,{project,version,tasks:context.tasks.filter(t=>t.project_id===project.id&&t.version_id===version.id),documents:context.documents.filter(d=>d.version_id===version.id)}),external_writes:false};}
   const run=await store.focusRunStart(owner,task.id,body.role,body.request_id);if(!run.fresh)return {duplicate:true,status:run.status,snapshot:await snapshot(owner)};
   try{const result=roleTool(body.role,{project,version,tasks:context.tasks.filter(t=>t.project_id===project.id&&t.version_id===version.id),documents:context.documents.filter(d=>d.version_id===version.id),priorVersions:context.versions.filter(v=>v.project_id===project.id&&v.id!==version.id)});await store.finish(owner,task.id,run.run_id,result,null);return {mode:'free_tools',status:'review',paidApiCalls:0,snapshot:await snapshot(owner)};
   }catch{try{await store.finish(owner,task.id,run.run_id,null,'provider_failed');}catch{}throw fail('focus_tool_failed');}
  }
  throw fail('invalid_focus_action');
 };
}
async function derivedRequest(parent,suffix){const hex=await digest(parent+':'+suffix);return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}

function validateProject(project){
 if(!project||typeof project.name!=='string'||!project.name.trim()||project.name.length>100||typeof project.legacy_name!=='string'||!project.legacy_name.trim()||project.legacy_name.length>100||!['work','church'].includes(project.workspace)||!project.version)throw fail('invalid_focus_bundle');
 const cfg=project.notion_config||{};if(Object.keys(cfg).some(k=>!['data_source_id','project_prefix'].includes(k)))throw fail('invalid_focus_bundle');
 const v=project.version;if(typeof v.label!=='string'||!v.label||!/^\d{4}-\d{2}-\d{2}$/.test(v.version_date||'')||![v.included_terms,v.excluded_terms].every(a=>Array.isArray(a)&&a.length<=100&&a.every(t=>typeof t==='string'&&t.trim()&&t.length<=100)))throw fail('invalid_focus_bundle');
 if(!Array.isArray(project.documents||[])||(project.documents||[]).length>30)throw fail('invalid_focus_bundle');
}
