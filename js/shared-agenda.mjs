// One presentation of both workspaces. Nothing here writes to Google or Reservation.
export const taipeiDay=value=>{
 const t=Date.parse(value);return Number.isFinite(t)?new Date(t+28800000).toISOString().slice(0,10):null;
};
export function agendaTasks(snapshot){
 const projects=new Map((snapshot?.projects||[]).map(p=>[p.id,p]));
 return (snapshot?.tasks||[]).flatMap(t=>{
  const p=projects.get(t.project_id);
  if(!p||!['work','church'].includes(p.workspace)||t.parent_task_id||t.task_kind==='agent'||t.version_id!==p.active_version_id||t.scope_status==='out_of_scope'||t.work_state==='done'||t.status==='cancelled')return [];
  const start=t.schedule_start_at||t.due_at,end=t.schedule_end_at||start;
  return [{...t,workspace:p.workspace,projectName:p.name,date:taipeiDay(start),endDate:taipeiDay(end),scheduled:!!t.schedule_start_at,confidence:t.scope_status==='needs_review'?'待確認':'已確認',source:'HANA FOCUS 雲端',sourceId:t.id}];
 }).sort((a,b)=>(a.schedule_start_at||a.due_at||'9999').localeCompare(b.schedule_start_at||b.due_at||'9999')||(a.priority||2)-(b.priority||2)||a.title.localeCompare(b.title));
}
export function tasksOnDay(tasks,date,workspace='all'){
 const start=Date.parse(date+'T00:00:00+08:00'),end=start+86400000;
 return tasks.filter(t=>{
  if(workspace!=='all'&&t.workspace!==workspace)return false;
  if(!t.scheduled)return t.date===date;
  const a=Date.parse(t.schedule_start_at),b=Date.parse(t.schedule_end_at);
  return Number.isFinite(a)&&Number.isFinite(b)?a<end&&b>start:t.date===date;
 });
}
export function dailyAgenda(tasks,date){
 return {today:tasksOnDay(tasks,date),overdue:tasks.filter(t=>t.due_at&&taipeiDay(t.due_at)<date),unscheduled:tasks.filter(t=>!t.date)};
}
export function reminderDue(now,lastSeen){
 const local=new Date(now+28800000),date=local.toISOString().slice(0,10);
 return local.getUTCHours()>=9&&lastSeen!==date;
}
export const workspaceName=value=>value==='church'?'教會':'HANA';
export function taskTime(t){return t.scheduled?new Date(t.schedule_start_at).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}):'到期';}
