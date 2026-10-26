import assert from 'node:assert/strict';
import {sevenDayWindow,secretaryConflictSummary} from '../../js/secretary-conflict.mjs';
assert.deepEqual(sevenDayWindow('2026-10-26'),{start:'2026-10-26T00:00:00+08:00',end:'2026-11-02T00:00:00+08:00'});
assert.deepEqual(sevenDayWindow('2026-12-29'),{start:'2026-12-29T00:00:00+08:00',end:'2027-01-05T00:00:00+08:00'});
assert.throws(()=>sevenDayWindow('2026-02-30'),/invalid_day/);
const mixed=secretaryConflictSummary({mode:'read_only_preview',external_writes:false,
 changes:[{action:'PROPOSE_CLOSE',date:'2026-10-27',time:'10:00–12:00',course:'範例'},
 {action:'REVIEW_EXISTING_BOOKING',date:'2026-10-28',time:'10:00–12:00',course:'既有報名'}],
 warnings:[{slot_id:'invalid',reason:'unknown_duration'}]});
assert.equal(mixed.reservedConflicts,1);
assert.equal(mixed.emptySlotConflicts,1);
assert.equal(mixed.warnings,1);
assert.equal(mixed.status,'needs_owner_resolution');
assert.ok(mixed.message.includes('未更新正式預約'));
assert.equal(secretaryConflictSummary({mode:'read_only_preview',external_writes:false,changes:[],warnings:[]}).status,'no_candidates');
assert.throws(()=>secretaryConflictSummary({mode:'read_only_preview',external_writes:true,changes:[],warnings:[]}),/unverified_calendar_preview/);
assert.throws(()=>secretaryConflictSummary({mode:'read_only_preview',external_writes:false,changes:[{action:'UNKNOWN'}],warnings:null}),/unverified_calendar_preview/);
console.log('PASS: seven-day secretary collision summary, booked vs unbooked safety, year boundary and no fake external writes.');
