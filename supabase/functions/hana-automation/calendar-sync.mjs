const fail=code=>Object.assign(Error(code),{code});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const stamp=v=>{if(typeof v!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw fail('calendar_sync_invalid');return new Date(v).toISOString();};
export function schedule(start,end){
 if(start===null&&end===null)return {schedule_start_at:null,schedule_end_at:null};
 const a=stamp(start),b=stamp(end);if(Date.parse(b)<=Date.parse(a)||Date.parse(b)-Date.parse(a)>7*86400000)throw fail('calendar_sync_invalid');
 return {schedule_start_at:a,schedule_end_at:b};
}
export function sourceEvent(kind,s){
 if(!s)throw fail('calendar_sync_conflict');
 if(kind==='task'){
  if(!s.schedule_start_at&&!s.schedule_end_at)return {cancelled:true};
  const w=schedule(s.schedule_start_at,s.schedule_end_at);return {title:(s.work_state==='done'?'✓ ':'')+s.title,start:w.schedule_start_at,end:w.schedule_end_at,cancelled:false};
 }
 if(!Number.isSafeInteger(s.booked)||s.booked<0)throw fail('calendar_sync_incomplete');
 if((s.status==='CLOSED'||!s.enabled||s.blocked)&&s.booked===0)return {cancelled:true};
 const m=/^([01]\d|2[0-3]):([0-5]\d)\s*[–-]\s*([01]\d|2[0-3]):([0-5]\d)$/.exec(s.time||'');
 if(!m)throw fail('calendar_sync_duration_required');
 const w=schedule(s.date+'T'+m[1]+':'+m[2]+':00+08:00',s.date+'T'+m[3]+':'+m[4]+':00+08:00');
 return {title:s.course+(s.variant?'｜'+s.variant:''),start:w.schedule_start_at,end:w.schedule_end_at,cancelled:false};
}
export function googleEvent(g){
 if(!g||g.status==='cancelled')return {cancelled:true};
 if(g.recurrence||g.recurringEventId||!g.start?.dateTime||!g.end?.dateTime)throw fail('calendar_sync_conflict');
 const w=schedule(g.start.dateTime,g.end.dateTime);return {title:String(g.summary||''),start:w.schedule_start_at,end:w.schedule_end_at,cancelled:false};
}
export function syncDecision(baseSource,baseGoogle,source,google,booked=0){
 if(!baseSource||!baseGoogle)return same(source,google)?'aligned':google.cancelled?'export':'conflict';
 const a=!same(baseSource,source),b=!same(baseGoogle,google);
 if(!a&&!b)return 'aligned';if(same(source,google))return 'aligned';
 if(a&&b)return 'conflict';if(a)return 'export';return booked>0?'review':'import';
}
const eventPayload=v=>({summary:v.title,start:{dateTime:v.start,timeZone:'Asia/Taipei'},end:{dateTime:v.end,timeZone:'Asia/Taipei'}});
const taipei=v=>new Date(Date.parse(v)+28800000).toISOString();
const monthFor=(kind,s,fallback)=>kind==='slot'?s.date?.slice(0,7)||fallback:s.schedule_start_at?taipei(s.schedule_start_at).slice(0,7):fallback;
export function calendarSyncService({store,google,reservations,ownerId,enabled=false,now=Date.now}){
 async function source(owner,kind,id){return kind==='slot'?(await reservations({action:'get',id})).slot:store.calendarTask(owner,id);}
 async function googleCurrent(owner,row,events){const g=events?.get(row.event_id)||await google.get(owner,row.event_id);if(g&&g.status!=='cancelled'&&g.extendedProperties?.private?.hana_owner!==owner)throw fail('calendar_sync_conflict');return g;}
 async function save(owner,row,patch){return store.calendarLinkSave(owner,row.id,row.revision,{...patch,revision:row.revision+1,updated_at:new Date(now()).toISOString()});}
 async function claim(owner,row,s,g,direction){
  let patch={status:'unknown'},current=g;
  if(direction==='export'&&g?.status==='cancelled'&&!sourceEvent(row.kind,s).cancelled){
   const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.event_id+':'+row.revision)));
   patch.event_id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');current=null;
  }
  return {row:await save(owner,row,patch),current};
 }
 async function exported(owner,row,s,g){const value=sourceEvent(row.kind,s);if(value.cancelled)await google.remove(owner,row.event_id,g);else await google.put(owner,row.event_id,eventPayload(value),g);const verified=await google.get(owner,row.event_id);if(!same(googleEvent(verified),value))throw fail('calendar_sync_unknown');return verified;}
 async function imported(owner,row,s,g,approved=false,reviewId=null){
  const value=googleEvent(g),prior=sourceEvent(row.kind,s);
  if(!value.cancelled&&value.title!==prior.title)throw fail('calendar_sync_conflict');
  if(row.kind==='task')return store.calendarTaskSchedule(owner,s.id,s.record_revision,value.cancelled?{schedule_start_at:null,schedule_end_at:null}:{schedule_start_at:value.start,schedule_end_at:value.end});
  let patch={status:'CLOSED'};
  if(!value.cancelled){const start=taipei(value.start),end=taipei(value.end);if(start.slice(0,10)!==end.slice(0,10)||Date.parse(value.start)%60000||Date.parse(value.end)%60000)throw fail('calendar_sync_invalid');patch={date:start.slice(0,10),time:start.slice(11,16)+'–'+end.slice(11,16)};}
  return (await reservations({action:'apply',id:s.id,expected:s,patch,approved,review_id:reviewId})).slot;
 }
 async function baseline(owner,row,s,g){return save(owner,row,{base_source:sourceEvent(row.kind,s),base_google:googleEvent(g),month:monthFor(row.kind,s,row.month),status:'ready',pending:null});}
 async function stage(owner,row,s,g,direction,reason){
  const pending={id:crypto.randomUUID(),source:s,google:g,direction,reason};
  return save(owner,row,{status:reason==='both_changed'?'conflict':'pending',pending});
 }
 return async(owner,body)=>{
  if(owner!==ownerId||!await store.googleOwnerAllowed(owner))throw fail('calendar_sync_owner_required');
  if(body.action==='calendar_sync_status')return {enabled,links:await store.calendarLinks(owner),authorized:!!await store.credential(owner,'google_sync'),background_enabled:false};
  if(!enabled)throw fail('calendar_sync_activation_required');
  const lock=crypto.randomUUID();if(!await store.calendarLock(owner,lock))throw fail('calendar_sync_busy');
  try{
   if(body.action==='calendar_task_schedule'){
    if(!UUID.test(body.task_id||'')||!Number.isInteger(body.revision))throw fail('calendar_sync_invalid');
    const w=schedule(body.start,body.end);await store.calendarTaskSchedule(owner,body.task_id,body.revision,w);
    return {status:'scheduled',synced:false};
   }
   if(body.action==='calendar_sync_review'){
    const row=await store.calendarLink(owner,body.link_id);if(!row?.pending||row.pending.id!==body.review_id||!['approved','rejected'].includes(body.decision))throw fail('calendar_sync_conflict');
    if(body.decision==='rejected'){await save(owner,row,{status:'rejected'});return {status:'rejected',external_writes:false};}
    if(!['import','export'].includes(body.direction))throw fail('calendar_sync_invalid');
    // Both snapshots, including enrolled count and Google etag, must still match the reviewed warning.
    const current=await source(owner,row.kind,row.source_id),g=await googleCurrent(owner,row);
    if(!same(current,row.pending.source)||!same(g,row.pending.google))throw fail('calendar_sync_conflict');
    await store.event(owner,'日曆同步',row.kind==='task'?row.source_id:null,null,'calendar_sync_human_approved',{review_id:body.review_id,link_id:row.id,direction:body.direction});
    let next=current,newGoogle=g;
    // Mark unknown before external effects. An interrupted write cannot auto-run the proposal again.
    const attempt=await claim(owner,row,current,g,body.direction),claimed=attempt.row;
    if(body.direction==='import')next=await imported(owner,claimed,current,g,true,body.review_id);else newGoogle=await exported(owner,claimed,current,attempt.current);
    await baseline(owner,claimed,next,newGoogle);return {status:'synced',orders_changed:false};
   }
   if(body.action==='calendar_sync_reconcile'){
    const row=await store.calendarLink(owner,body.link_id);if(!row)throw fail('calendar_sync_invalid');
    const s=await source(owner,row.kind,row.source_id),g=await googleCurrent(owner,row);
    if(same(sourceEvent(row.kind,s),googleEvent(g)))await baseline(owner,row,s,g);
    else await stage(owner,row,s,g,null,'both_changed');
    return {status:'review_refreshed',external_writes:false};
   }
   if(body.action!=='calendar_sync_run'||!/^20\d\d-(0[1-9]|1[0-2])$/.test(body.month||''))throw fail('calendar_sync_invalid');
   if(body.task_id&&!UUID.test(body.task_id))throw fail('calendar_sync_invalid');
   const inventory=body.task_id?{slots:[]}:await reservations({action:'snapshot',month:body.month});if(!Array.isArray(inventory.slots))throw fail('calendar_sync_incomplete');
   const tasks=body.task_id?[await store.calendarTask(owner,body.task_id)].filter(Boolean):await store.calendarTasks(owner),allRows=await store.calendarLinks(owner),rows=body.task_id?allRows.filter(r=>r.kind==='task'&&r.source_id===body.task_id):allRows,events=new Map((await google.list(owner)).map(g=>[g.id,g]));
   const candidates=new Map();for(const s of inventory.slots)candidates.set('slot:'+s.id,{kind:'slot',id:s.id,s});
   for(const s of tasks)if(monthFor('task',s,'')===body.month||rows.some(r=>r.kind==='task'&&r.source_id===s.id&&r.month===body.month))candidates.set('task:'+s.id,{kind:'task',id:s.id,s});
   for(const r of rows.filter(r=>r.month===body.month))if(!candidates.has(r.kind+':'+r.source_id))candidates.set(r.kind+':'+r.source_id,{kind:r.kind,id:r.source_id,s:await source(owner,r.kind,r.source_id)});
   let changed=0,pending=0,skipped=0;const warnings=[],started=now();
   for(const {kind,id,s} of candidates.values()){
    if(changed>=20||now()-started>40000)return {status:'more_pending',changed,pending,skipped,warnings};
    let row=rows.find(r=>r.kind===kind&&r.source_id===id);
    try{
     const v=sourceEvent(kind,s);if(!row&&v.cancelled)continue;
     if(!row){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+':'+kind+':'+id)));const event_id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');row=await store.calendarLinkCreate(owner,{kind,source_id:id,month:body.month,event_id});}
     if(['pending','conflict','rejected','unknown'].includes(row.status)){pending++;continue;}
     const g=await googleCurrent(owner,row,events),gv=googleEvent(g),decision=syncDecision(row.base_source,row.base_google,v,gv,kind==='slot'?s.booked:0);
     if(decision==='aligned'){if(!same(row.base_source,v)||!same(row.base_google,gv))await baseline(owner,row,s,g);continue;}
     if(decision==='review'||decision==='conflict'){await stage(owner,row,s,g,decision==='review'?'import':null,decision==='review'?'enrolled':'both_changed');pending++;changed++;continue;}
     // Re-fetch immediately before comparing/writing. CAS on Reservation and If-Match on Google close the race.
     const fresh=await source(owner,kind,id);if(!same(fresh,s))throw fail('calendar_sync_conflict');
     const attempt=await claim(owner,row,s,g,decision),claimed=attempt.row;let next=s,newGoogle=g;
     if(decision==='export')newGoogle=await exported(owner,claimed,s,attempt.current);else next=await imported(owner,claimed,s,g);
     await baseline(owner,claimed,next,newGoogle);changed++;
    }catch(error){skipped++;warnings.push({kind,source_id:id,code:['calendar_sync_duration_required','calendar_sync_conflict','calendar_sync_unknown'].includes(error.code)?error.code:'calendar_sync_failed'});}
   }
   return {status:'complete',changed,pending,skipped,warnings,background_enabled:false};
  }finally{await store.calendarUnlock(owner,lock);}
 };
}
