import test from 'node:test';import assert from 'node:assert/strict';
import {agendaTasks,tasksOnDay,dailyAgenda,reminderDue} from '../../js/shared-agenda.mjs';
const projects=[{id:'w',name:'HANA',workspace:'work',active_version_id:'v'},{id:'c',name:'教會',workspace:'church',active_version_id:'v'}];
const task=(id,p,extra={})=>({id,title:id,project_id:p,version_id:'v',work_state:'todo',scope_status:'in_scope',due_at:'2026-11-04T02:00:00Z',...extra});
test('combines both workspaces without merging same-title records or completed/history/agent work',()=>{
 const items=agendaTasks({projects,tasks:[task('a','w',{title:'same'}),task('b','c',{title:'same'}),task('done','w',{work_state:'done'}),task('old','c',{version_id:'old'}),task('agent','w',{task_kind:'agent'}),task('out','c',{scope_status:'out_of_scope'}),task('pending','c',{scope_status:'needs_review'})]});
 assert.equal(items.length,3);assert.equal(items.find(x=>x.id==='pending').confidence,'待確認');assert.equal(tasksOnDay(items,'2026-11-04','church').length,2);
});
test('Taipei dates, exclusive midnight ends, overdue and undated records stay distinct',()=>{
 const items=agendaTasks({projects,tasks:[task('overnight','c',{schedule_start_at:'2026-11-03T15:00:00Z',schedule_end_at:'2026-11-03T16:00:00Z',due_at:'2026-11-03T16:00:00Z'}),task('late','w',{due_at:'2026-11-03T12:00:00Z'}),task('undated','c',{due_at:null})]});
 assert.equal(tasksOnDay(items,'2026-11-04').length,0);assert.equal(tasksOnDay(items,'2026-11-03').length,2);
 const daily=dailyAgenda(items,'2026-11-04');assert.deepEqual(daily.overdue.map(x=>x.id),['late']);assert.deepEqual(daily.unscheduled.map(x=>x.id),['undated']);
});
test('09:00 reminder runs once per Taipei day and catches up after reopening',()=>{
 assert.equal(reminderDue(Date.parse('2026-11-04T00:59:59Z'),null),false);assert.equal(reminderDue(Date.parse('2026-11-04T01:00:00Z'),null),true);assert.equal(reminderDue(Date.parse('2026-11-04T05:00:00Z'),'2026-11-04'),false);assert.equal(reminderDue(Date.parse('2026-11-05T01:00:00Z'),'2026-11-04'),true);
});
