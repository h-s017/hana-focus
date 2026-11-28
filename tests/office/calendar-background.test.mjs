import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMonth,calendarBackgroundWorker} from '../../supabase/functions/hana-automation/calendar-background.mjs';
const now=()=>Date.parse('2026-12-31T16:05:00Z');
const token='a'.repeat(64);
function setup({enabled=true,authorized=true,configured=true,credential=true,result={status:'complete',changed:2,pending:1,skipped:0}}={}){
 const calls=[],events=[];
 const handler=calendarBackgroundWorker({ownerId:'owner',configured:()=>configured,now,store:{
  calendarWorkerAuthorized:async t=>authorized&&t===token,
  calendarBackgroundStatus:async()=>({current:enabled,next:enabled}),
  googleOwnerAllowed:async o=>o==='owner',
  credential:async()=>credential?{}:null,
  event:async(...a)=>events.push(a)
 },run:async(...a)=>{calls.push(a);return result;}});
 return {handler,calls,events};
}
const request=(route='/calendar-worker',t=token,method='POST')=>new Request('https://example.invalid'+route,{method,headers:{'x-hana-calendar-worker':t}});
test('Taipei month rollover',()=>{assert.equal(calendarMonth(now()),'2027-01');assert.equal(calendarMonth(now(),1),'2027-02');assert.throws(()=>calendarMonth(now(),2));});
test('method and unauthorized requests cannot run',async()=>{const s=setup();assert.equal((await s.handler(request('/calendar-worker',token,'GET'))).status,405);assert.equal((await s.handler(request('/calendar-worker','bad'))).status,401);assert.equal(s.calls.length,0);});
test('disabled schedule does not run',async()=>{const s=setup({enabled:false});assert.equal((await (await s.handler(request())).json()).status,'disabled');assert.equal(s.calls.length,0);});
test('missing credentials blocks',async()=>{const s=setup({credential:false});assert.equal((await s.handler(request())).status,503);assert.equal(s.calls.length,0);assert.equal(s.events[0][4],'calendar_background_failed');});
test('owner and month derived server side; durable receipt',async()=>{const s=setup();const res=await s.handler(request('/calendar-worker-next'));assert.equal(res.status,200);assert.deepEqual(s.calls,[['owner',{action:'calendar_sync_run',month:'2027-02'}]]);assert.equal(s.events[0][4],'calendar_background_run');assert.equal((await res.json()).booking_writes,false);});
test('partial result not reported as complete',async()=>{const s=setup({result:{status:'complete',changed:0,pending:0,skipped:1}});assert.equal((await (await s.handler(request())).json()).status,'partial');});
