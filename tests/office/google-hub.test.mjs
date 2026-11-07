import test from 'node:test';import assert from 'node:assert/strict';
import {focusService} from '../../supabase/functions/hana-automation/focus.mjs';
import {googleAgenda,googleOnDay} from '../../js/shared-agenda.mjs';
test('Google month is read for the authenticated owner and only useful fields are returned',async()=>{
 let args,logged=false;const store={calendarLinks:async owner=>{assert.equal(owner,'owner');return [{event_id:'e',kind:'task',source_id:'t',status:'ready'}];},event:async()=>{logged=true;}};
 const service=focusService({store,readCalendarEvents:async(...values)=>{args=values;return {checked_at:'2026-11-04T05:00:00Z',events:[{id:'e',summary:'Church work',start:{dateTime:'2026-11-11T08:00:00+08:00'},end:{dateTime:'2026-11-11T09:00:00+08:00'},attendees:[{email:'private@example.invalid'}],description:'private'},{id:'cancelled',status:'cancelled'}]};}});
 const result=await service('owner',{action:'focus_calendar',month:'2026-11'});assert.equal(args[0],'owner');assert.equal(args[1],'2026-11-01T00:00:00+08:00');assert.equal(Date.parse(args[2]),Date.parse('2026-12-01T00:00:00+08:00'));assert.equal(result.events.length,1);assert.deepEqual(result.events[0].managed,{kind:'task',source_id:'t',status:'ready'});assert.equal(result.events[0].attendees,undefined);assert.equal(result.events[0].description,undefined);assert.equal(result.external_writes,false);
});
test('same title never hides unrelated Google events; only exact ready links are combined',()=>{
 const start={dateTime:'2026-11-11T08:00:00+08:00'},end={dateTime:'2026-11-11T09:00:00+08:00'},task={id:'t',workspace:'church',schedule_start_at:start.dateTime,schedule_end_at:end.dateTime};
 const events=[{id:'linked',title:'Same',start,end,managed:{kind:'task',source_id:'t',status:'ready'}},{id:'other',title:'Same',start,end},{id:'pending',title:'Same',start,end,managed:{kind:'task',source_id:'t',status:'pending'}}];
 assert.deepEqual(googleAgenda(events,[task]).map(x=>x.id),['other','pending']);assert.equal(googleAgenda(events,[{...task,schedule_start_at:'2026-11-11T07:00:00+08:00'}]).length,3);
});
test('all-day and multi-day Google events use Taipei dates and exclusive ends',()=>{
 const events=googleAgenda([{id:'all',start:{date:'2026-11-10'},end:{date:'2026-11-12'},status:'tentative'}]);assert.equal(googleOnDay(events,'2026-11-10').length,1);assert.equal(googleOnDay(events,'2026-11-11').length,1);assert.equal(googleOnDay(events,'2026-11-12').length,0);assert.equal(events[0].confidence,'待確認');assert.equal(googleOnDay(events,'2026-11-11','church').length,0);
});
test('missing Google reader does not report an empty verified calendar',async()=>{
 await assert.rejects(focusService({store:{}})('owner',{action:'focus_calendar',month:'2026-11'}),e=>e.code==='calendar_authorization_required');
});
