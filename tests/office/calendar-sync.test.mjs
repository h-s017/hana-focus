import test from 'node:test';import assert from 'node:assert/strict';
import {calendarSyncService,sourceEvent,googleEvent,syncDecision,schedule} from '../../supabase/functions/hana-automation/calendar-sync.mjs';
import {googleSyncApi} from '../../supabase/functions/hana-automation/calendar-sync-api.mjs';
import {inputWindow} from '../../js/calendar-sync-app.mjs';
const owner='10000000-0000-4000-8000-000000000001',taskId='20000000-0000-4000-8000-000000000002';
const original=()=>({id:'slot',course:'合成課程',variant:'',date:'2099-12-01',time:'09:00–11:00',status:'OPEN',capacity:5,booked:1,enabled:1,blocked:0});
const gEvent=(v,id='managed')=>({id,etag:'"v1"',status:'confirmed',summary:v.title,start:{dateTime:v.start},end:{dateTime:v.end},extendedProperties:{private:{hana_owner:owner}}});
function fixture({enrolled=1,enabled=true}={}){
 let slot=original();slot.booked=enrolled;let google=gEvent({...sourceEvent('slot',slot),start:'2099-12-02T01:00:00.000Z',end:'2099-12-02T03:00:00.000Z'});
 const row={id:'row',kind:'slot',source_id:'slot',month:'2099-12',event_id:'managed',base_source:sourceEvent('slot',slot),base_google:sourceEvent('slot',slot),status:'ready',revision:1};
 let locked=false;const writes=[],rows=[row],clone=v=>structuredClone(v);
 const store={googleOwnerAllowed:async()=>true,calendarLock:async()=>{if(locked)return false;locked=true;return true;},calendarUnlock:async()=>locked=false,credential:async()=>null,
  calendarTasks:async()=>[],calendarLinks:async()=>clone(rows),calendarLink:async()=>clone(rows[0]),calendarLinkSave:async(o,id,rev,patch)=>{assert.equal(rev,row.revision);Object.assign(row,clone(patch));return clone(row);},event:async()=>writes.push('approval')};
 const api={list:async()=>[clone(google)],get:async()=>clone(google),put:async()=>writes.push('google-write'),remove:async()=>writes.push('google-delete')};
 const reservations=async b=>{if(b.action==='snapshot')return {slots:[clone(slot)]};if(b.action==='get')return {slot:clone(slot)};writes.push('reservation-write');Object.assign(slot,b.patch);return {slot:clone(slot)};};
 const run=calendarSyncService({store,google:api,reservations,ownerId:owner,enabled});
 return {run:body=>run(owner,body),row,writes,slot:()=>slot,changeEnrolment:()=>slot.booked++,changeGoogle:()=>google.etag='"v2"',foreign:()=>google.extendedProperties.private.hana_owner='other',lock:()=>locked=true};
}
test('enrolled course changes display pending review and perform no external write until approved',async()=>{
 const f=fixture(),r=await f.run({action:'calendar_sync_run',month:'2099-12'});assert.equal(r.pending,1);assert.deepEqual(f.writes,[]);assert.equal(f.row.pending.reason,'enrolled');assert.equal(f.slot().date,'2099-12-01');
 const receipt=f.row.pending.id;await assert.rejects(f.run({action:'calendar_sync_review',link_id:'row',review_id:'forged',decision:'approved',direction:'import'}));
 await f.run({action:'calendar_sync_review',link_id:'row',review_id:receipt,decision:'approved',direction:'import'});assert.equal(f.slot().date,'2099-12-02');assert.deepEqual(f.writes,['approval','reservation-write']);assert.equal(f.row.status,'ready');
 await f.run({action:'calendar_sync_run',month:'2099-12'});assert.equal(f.writes.length,2);
});
test('changed enrolment or Google event after review forces new review without source writes',async()=>{
 for(const change of ['changeEnrolment','changeGoogle']){const f=fixture();await f.run({action:'calendar_sync_run',month:'2099-12'});const receipt=f.row.pending.id;f[change]();await assert.rejects(f.run({action:'calendar_sync_review',link_id:'row',review_id:receipt,decision:'approved',direction:'import'}),{code:'calendar_sync_conflict'});assert.deepEqual(f.writes,[]);}
});
test('rejection, unknown outcomes, parallel runs and activation guard never auto-write',async()=>{
 const f=fixture();await f.run({action:'calendar_sync_run',month:'2099-12'});await f.run({action:'calendar_sync_review',link_id:'row',review_id:f.row.pending.id,decision:'rejected'});await f.run({action:'calendar_sync_run',month:'2099-12'});assert.deepEqual(f.writes,[]);
 f.row.status='unknown';await f.run({action:'calendar_sync_run',month:'2099-12'});assert.deepEqual(f.writes,[]);f.lock();await assert.rejects(f.run({action:'calendar_sync_run',month:'2099-12'}),{code:'calendar_sync_busy'});
 await assert.rejects(fixture({enabled:false}).run({action:'calendar_sync_run',month:'2099-12'}),{code:'calendar_sync_activation_required'});
});
test('unbooked imports update source; unrelated or all-day Google events cannot overwrite courses',async()=>{
 const f=fixture({enrolled:0});await f.run({action:'calendar_sync_run',month:'2099-12'});assert.deepEqual(f.writes,['reservation-write']);
 const foreign=fixture({enrolled:0});foreign.foreign();const r=await foreign.run({action:'calendar_sync_run',month:'2099-12'});assert.equal(r.skipped,1);assert.deepEqual(foreign.writes,[]);
 assert.throws(()=>googleEvent({start:{date:'2099-12-01'},end:{date:'2099-12-02'}}));
});
test('three-way comparison detects concurrent edits and enrolled deletion; unscheduled tasks stay out of Calendar',()=>{
 const base=sourceEvent('slot',original()),moved={...base,start:'2099-12-03T01:00:00.000Z'};
 assert.equal(syncDecision(base,base,moved,{cancelled:true},1),'conflict');assert.equal(syncDecision(base,base,base,{cancelled:true},1),'review');
 assert.deepEqual(sourceEvent('task',{title:'todo'}),{cancelled:true});
 assert.deepEqual(inputWindow('2099-12-01T09:00','2099-12-01T10:00'),{start:'2099-12-01T01:00:00.000Z',end:'2099-12-01T02:00:00.000Z'});
 assert.throws(()=>schedule('2099-12-01T10:00:00+08:00','2099-12-01T09:00:00+08:00'));
 const reordered=Object.fromEntries(Object.entries(base).reverse());assert.equal(syncDecision(reordered,reordered,base,base),'aligned');
});
test('JSONB key reordering does not invalidate an otherwise unchanged human review',async()=>{
 const f=fixture();await f.run({action:'calendar_sync_run',month:'2099-12'});
 const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
 f.row.pending=sort(f.row.pending);await f.run({action:'calendar_sync_review',link_id:'row',review_id:f.row.pending.id,decision:'approved',direction:'import'});assert.equal(f.slot().date,'2099-12-02');
});
test('managed Google writes use If-Match and sendUpdates=none, never add invitees or reminders',async()=>{
 const calls=[],store={credential:async()=>({ciphertext:'fixture'})},encryption={open:async()=>({scope:'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',access_token:'synthetic',expires_at:Date.now()+3600000})};
 const api=googleSyncApi({clientId:'fixture',clientSecret:'fixture',ownerId:owner,store,encryption,fetcher:async(url,opts)=>{calls.push({url,opts});return Response.json({id:'managed'});}});
 await api.put(owner,'managed',{summary:'task'},gEvent(sourceEvent('slot',original())));const c=calls[0],body=JSON.parse(c.opts.body);assert.equal(c.opts.headers['If-Match'],'"v1"');assert.ok(c.url.endsWith('?sendUpdates=none'));assert.deepEqual(body.reminders,{useDefault:false,overrides:[]});assert.equal(body.attendees,undefined);
});
test('task-only scheduling does not require or touch Reservation and unscheduling retains the task',async()=>{
 let t={id:taskId,title:'合成任務',work_state:'todo',record_revision:1,schedule_start_at:'2099-12-01T01:00:00.000Z',schedule_end_at:'2099-12-01T02:00:00.000Z'},row;let g=null,puts=0,deletes=0;
 const clone=v=>structuredClone(v),store={googleOwnerAllowed:async()=>true,calendarLock:async()=>true,calendarUnlock:async()=>{},calendarTask:async()=>clone(t),calendarLinks:async()=>row?[clone(row)]:[],calendarLinkCreate:async(o,p)=>{row={id:'row',revision:1,status:'ready',...p};return clone(row);},calendarLinkSave:async(o,id,rev,p)=>{assert.equal(rev,row.revision);Object.assign(row,p);return clone(row);},calendarTaskSchedule:async(o,id,rev,p)=>{assert.equal(rev,t.record_revision);Object.assign(t,p);t.record_revision++;return clone(t);}};
 const api={list:async()=>g?[clone(g)]:[],get:async()=>clone(g),put:async(o,id,p)=>{puts++;g={...gEvent({title:p.summary,start:p.start.dateTime,end:p.end.dateTime},id)};return clone(g);},remove:async()=>{deletes++;g=null;}};
 const run=calendarSyncService({store,google:api,reservations:()=>assert.fail('task-only sync touched course system'),ownerId:owner,enabled:true});
 await run(owner,{action:'calendar_sync_run',month:'2099-12',task_id:taskId});await run(owner,{action:'calendar_sync_run',month:'2099-12',task_id:taskId});assert.equal(puts,1);
 await run(owner,{action:'calendar_task_schedule',task_id:taskId,revision:t.record_revision,start:null,end:null});await run(owner,{action:'calendar_sync_run',month:'2099-12',task_id:taskId});assert.equal(deletes,1);assert.equal(t.title,'合成任務');assert.equal(t.work_state,'todo');
});
