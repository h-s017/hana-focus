// Secretary read-only calendar/booking reconciliation. Does not mutate appointments.
const fail=(message)=>{throw Error(message);};
export function sevenDayWindow(today){
 if(typeof today!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(today))fail('invalid_day');
 const ts=Date.parse(today+'T00:00:00Z');
 if(!Number.isFinite(ts)||new Date(ts).toISOString().slice(0,10)!==today)fail('invalid_day');
 return {start:today+'T00:00:00+08:00',end:new Date(ts+7*86400000).toISOString().slice(0,10)+'T00:00:00+08:00'};
}
export function secretaryConflictSummary(payload){
 if(!payload||payload.mode!=='read_only_preview'||!Array.isArray(payload.changes)||!Array.isArray(payload.warnings)||payload.external_writes!==false)fail('unverified_calendar_preview');
 if(payload.changes.length>10000||payload.warnings.length>10000)fail('unverified_calendar_preview');
 const occupied=payload.changes.filter(x=>x.action==='REVIEW_EXISTING_BOOKING');
 const closable=payload.changes.filter(x=>x.action==='PROPOSE_CLOSE');
 const unknown=payload.changes.filter(x=>!['REVIEW_EXISTING_BOOKING','PROPOSE_CLOSE'].includes(x.action));
 const warnings=payload.warnings.length+unknown.length;
 const text=(x)=>{
  const date=String(x.date||'').slice(0,10),time=String(x.time||'').slice(0,30),course=String(x.course||'').slice(0,60);
  return date+' '+time+'｜'+course;
 };
 return {
  reservedConflicts:occupied.length,emptySlotConflicts:closable.length,warnings,
  occupied:occupied.slice(0,8).map(text),empty:closable.slice(0,8).map(text),
  status:occupied.length?'needs_owner_resolution':closable.length?'suggest_closure':warnings?'needs_data_check':'no_candidates',
  message:'有預約的場次不會被移動或取消；未預約場次僅產生封鎖候選。此檢查未更新正式預約網站，亦未發出外部通知。',
  checkedAt:typeof payload.checked_at==='string'?payload.checked_at:null
 };
}
