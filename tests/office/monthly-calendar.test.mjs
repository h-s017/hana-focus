import test from 'node:test';
import assert from 'node:assert/strict';
import {monthEndPlan,monthDays,createMonthlyDraft} from '../../js/monthly-calendar.mjs';
const policy={weekdays:[1,2,3,4,5],windows:[{start:'10:00',end:'15:00'}],durationMinutes:60,stepMinutes:60};
const verified={calendar:true,reservation:true};
const build=(extras={})=>createMonthlyDraft({month:'2026-11',events:[],slots:[],policy,sources:verified,...extras});
const date=(draft,day)=>draft.days.find(d=>d.date==='2026-11-'+day);
test('last five days use actual month length and roll the target month',()=>{
 assert.deepEqual([monthEndPlan('2026-10-26').shouldRun,monthEndPlan('2026-10-27').shouldRun,monthEndPlan('2026-10-31').targetMonth],[false,true,'2026-11']);
 assert.equal(monthEndPlan('2026-02-24').shouldRun,true);
 assert.equal(monthEndPlan('2028-02-24').shouldRun,false);
 assert.equal(monthEndPlan('2028-02-25').shouldRun,true);
 assert.equal(monthEndPlan('2026-12-31').targetMonth,'2027-01');
 assert.equal(monthEndPlan('2026-04-26').windowStart,'2026-04-26');
});
test('month days are stable with correct weekday',()=>{
 assert.equal(monthDays('2028-02').length,29);
 assert.equal(monthDays('2026-11')[0].weekday,0);
 assert.throws(()=>monthDays('2026-13'),/invalid_month/);
});
test('unverified source must never claim availability',()=>{
 const d=build({sources:{calendar:true,reservation:false}});
 assert.equal(d.sourceVerified,false);
 assert.equal(date(d,'02').status,'unverified');
 assert.deepEqual(date(d,'02').proposed,[]);
 assert.equal(d.externalWrites,false);
});
test('no booking policy means no availability regardless of calendar',()=>{
 const d=build({policy:{}});
 assert.equal(date(d,'02').status,'rules_missing');
});
test('weekend rule and weekday proposals',()=>{
 const d=build();
 assert.equal(date(d,'01').status,'closed_by_policy');
 assert.equal(date(d,'02').proposed.length,5);
 assert.equal(date(d,'02').existingOpen.length,0);
});
test('timed busy event blocks only overlapping slots',()=>{
 const d=build({events:[{start:{dateTime:'2026-11-02T11:00:00+08:00'},end:{dateTime:'2026-11-02T12:00:00+08:00'},status:'confirmed',transparency:'opaque'}]});
 assert.equal(date(d,'02').proposed.length,4);
 assert.ok(date(d,'02').proposed.some(x=>x.start===10*60));
 assert.ok(date(d,'02').proposed.some(x=>x.start===12*60));
});
test('transparent events do not block',()=>{
 const d=build({events:[{start:{dateTime:'2026-11-02T10:00:00+08:00'},end:{dateTime:'2026-11-02T11:00:00+08:00'},status:'confirmed',transparency:'transparent'}]});
 assert.equal(date(d,'02').proposed.length,5);
});
test('full-day opaque event blocks all slots on that day',()=>{
 const d=build({events:[{start:{date:'2026-11-02'},end:{date:'2026-11-03'},status:'confirmed',transparency:'opaque'}]});
 assert.equal(date(d,'02').proposed.length,0);
 assert.equal(date(d,'02').status,'fully_booked_or_unavailable');
});
test('booked slot collision with calendar raises human-review warning',()=>{
 const d=build({slots:[{id:'booked-1',date:'2026-11-02',time:'11:00–12:00',booked:1,capacity:2,status:'開放',course:'Vol.1'}],events:[{start:{dateTime:'2026-11-02T11:00:00+08:00'},end:{dateTime:'2026-11-02T12:00:00+08:00'},status:'confirmed',transparency:'opaque'}]});
 assert.equal(date(d,'02').status,'conflict_requires_review');
 assert.equal(date(d,'02').conflicts[0].slotId,'booked-1');
 assert.equal(date(d,'02').existingOpen.length,0);
});
test('existing open slot shows remaining seats, without duplicating proposal',()=>{
 const d=build({slots:[{id:'existing',date:'2026-11-02',time:'10:00-11:00',booked:1,capacity:3,status:'開放',course:'Vol.2'}]});
 assert.equal(date(d,'02').existingOpen[0].remaining,2);
 assert.ok(!date(d,'02').proposed.some(x=>x.start===600));
});
test('manual closed slot stays closed even if proposed calendar is free',()=>{
 const d=build({slots:[{id:'closed',date:'2026-11-02',time:'10:00–11:00',booked:0,capacity:3,status:'關閉'}]});
 assert.equal(date(d,'02').existingOpen.length,0);
 assert.ok(!date(d,'02').proposed.some(x=>x.start===600));
});
test('closed dates, incomplete slot data and stable draft key',()=>{
 const d=build({policy:{...policy,closedDates:['2026-11-03']},slots:[{id:'broken',date:'2026-11-02',time:'unknown',booked:0,capacity:1,status:'開放'}]});
 assert.equal(date(d,'03').status,'closed_by_policy');
 assert.equal(date(d,'02').status,'needs_review');
 assert.equal(date(d,'02').proposed.length,0);
 assert.equal(d.draftKey,'monthly-availability:2026-11');
});
test('buffer minutes are honored by availability proposals',()=>{
 const d=build({policy:{...policy,bufferBeforeMinutes:30,bufferAfterMinutes:30},events:[{start:{dateTime:'2026-11-02T11:00:00+08:00'},end:{dateTime:'2026-11-02T12:00:00+08:00'},status:'confirmed',transparency:'opaque'}]});
 assert.equal(date(d,'02').proposed.length,2);
});

test('already-booked collision is detected even on a closed-by-policy day',()=>{
 const d=build({slots:[{id:'sat-paid',date:'2026-11-07',time:'10:00–11:00',booked:1,capacity:2,status:'開放'}],events:[{start:{dateTime:'2026-11-07T10:00:00+08:00'},end:{dateTime:'2026-11-07T11:00:00+08:00'},status:'confirmed',transparency:'opaque'}]});
 assert.equal(date(d,'07').status,'conflict_requires_review');
 assert.equal(date(d,'07').conflicts[0].slotId,'sat-paid');
 assert.equal(date(d,'07').proposed.length,0);
});
