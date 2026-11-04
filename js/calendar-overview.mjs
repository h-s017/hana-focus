// Read-only presentation of the existing monthly draft and Reservation aggregates.
// No second database, copied orders, source mutation, or assumed empty Google calendar.
export const FOCUS_ROUTES=['work','projects','agents','reviews','activity','church','calendar','orders','materials','settings'];
export function focusDestination(hash='',saved=''){
 const requested=hash.replace(/^#/,'');
 return FOCUS_ROUTES.includes(requested)?requested:FOCUS_ROUTES.includes(saved)?saved:'calendar';
}
export function shiftMonth(month,delta){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||![1,-1].includes(delta))throw Error('invalid_month');
 const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));
 return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
}
export function calendarDayOverview(day,{calendarVerified=false,reservationVerified=false,checkedAt=null,now=Date.now()}={}){
 const slots=day.reservationSlots||[],booked=slots.reduce((n,s)=>n+(Number.isInteger(s.booked)?s.booked:0),0);
 const closedRule=day.weekday===1?'週一閉館':day.weekday===6?'週六不可營業':null;
 const fresh=!!checkedAt&&Number.isFinite(Date.parse(checkedAt))&&now-Date.parse(checkedAt)>=0&&now-Date.parse(checkedAt)<=30*60*1000;
 const sourceVerified=calendarVerified&&reservationVerified&&fresh;
 const pendingLabel=!reservationVerified?'預約來源未核對':!calendarVerified?'Google 行程待核對':!fresh?'來源需更新':'尚無可預約場次';
 const result={label:pendingLabel,kind:'pending',confidence:'待確認',booked,alerts:[],sourceVerified};
 if(day.manualOverride==='closed'){
  result.label='整日不可預約（草稿）';result.kind='closed';result.confidence='已確認';
  if(booked)result.alerts.push('本草稿已關閉，但原系統仍有 '+booked+' 個報名單位；原訂單保留，需人工核對。');
 }else if(booked){result.label='已預約';result.kind='booked';result.confidence=reservationVerified&&fresh?'已確認':'待確認';}
 else if(closedRule&&!slots.length){result.label=closedRule;result.kind='rule';result.confidence='已確認';}
 else if(sourceVerified&&(day.existingOpen||[]).length){result.label='可預約・原場次';result.kind='available';result.confidence='已確認';}
 else if(slots.length&&!sourceVerified){result.label=pendingLabel;}
 else if((day.proposed||[]).length){result.label='候選・待審核';result.kind='tentative';}
 if(closedRule&&slots.length)result.alerts.push(closedRule+'規則與原系統場次並存；請核對例外安排，未更動正式場次。');
 if(day.conflicts?.length)result.alerts.push('已偵測 '+day.conflicts.length+' 個預約與行程衝突，需本人處理。');
 if(!calendarVerified)result.alerts.push('Google Calendar 未驗證；不可推定此日空閒。');
 if(!reservationVerified)result.alerts.push('預約來源未驗證；無法核實訂單影響。');
 if(checkedAt&&!fresh)result.alerts.push('來源快照已逾 30 分鐘或時間異常；請重新讀取來源。');
 return result;
}
export function orderMatchesDate(row,date){return !date||(String(row.sessions||'').match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]).includes(date);}
