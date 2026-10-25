import {priorities} from './runtime.mjs';
const fail=code=>Object.assign(Error(code),{code});
const commands=new Map([
 ['整理專案進度','project_progress'],['整理專案進度報告','project_progress'],
 ['列出今日優先工作','priorities'],['查詢客戶預約明細','orders'],
 ['檢查未來7天預約衝突','calendar'],['檢查未來七天預約衝突','calendar']
]);
export function workInput(body){
 if(typeof body.project!=='string'||typeof body.instruction!=='string'||typeof body.request_id!=='string')throw fail('invalid_work');
 const project=body.project.trim().normalize('NFC'),instruction=body.instruction.trim();
 if(!project||project.length>100||!instruction||instruction.length>2000||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))throw fail('invalid_work');
 return {project,instruction,request:body.request_id,action:commands.get(instruction)||'needs_human'};
}
// Bounded calendar window: today 00:00 Taipei through the start of the eighth day.
export function upcomingWeek(now=Date.now()){
 const day=new Date(now+8*3600000).toISOString().slice(0,10),start=day+'T00:00:00+08:00';
 const end=new Date(Date.parse(start)+7*86400000).toISOString();return {start,end};
}
export function workService({store,reservations,calendarPreview,now=Date.now}){
 return async(user,body)=>{
  const input=workInput(body),owner=user.id;
  const receipt=await store.beginWork(owner,input);
  // No source queries are repeated on duplicate requests. PII is never stored in receipts.
  if(!receipt.fresh)return {duplicate:true,receipt_id:input.request,history:await store.workHistory(owner)};
  if(input.action==='project_progress')return {receipt_id:input.request,history:await store.workHistory(owner)};
  let state='completed',summary='',orders;
  try{
   if(input.action==='needs_human'){
    state='needs_human';summary='已保存交辦，但尚未執行。NT$0 模式只支援下方列出的精確指令；其他需求、策略產稿與對外變更需本人處理。';
   }else if(input.action==='priorities'){
    const rows=priorities(await store.tasks(owner),now());
    summary='今日最多三項優先工作（全工作台最近100筆雲端任務；非本機工作板）\n'+(rows.map((t,i)=>`${i+1}. ${t.project}｜${t.title}｜${t.status}${t.overdue?'｜已逾期':''}`).join('\n')||'已讀取的任務中沒有待處理項目。');
   }else if(input.action==='orders'){
    if(!reservations)throw fail('reservation_connection_required');
    orders=await reservations.list(user,null);
    summary=`已唯讀查詢本頁 ${orders.orders.length} 筆客戶預約${orders.next_cursor?'（另有下一頁）':''}。明細僅顯示於本次登入畫面，不保存在交辦紀錄；重新整理後請重新查詢。未修改預約、退款或寄送通知。`;
   }else if(input.action==='calendar'){
    if(!calendarPreview)throw fail('calendar_authorization_required');
    const {start,end}=upcomingWeek(now()),result=await calendarPreview(owner,start,end);
    summary=`未來7天（Asia/Taipei，自 ${start} 至 ${end}，不含結束時間）\n已讀取 ${result.events_read} 筆行程；建議變更 ${result.changes.length} 個時段；待確認資料 ${result.warnings.length} 筆。\n`+
     result.changes.slice(0,30).map(x=>`${x.date} ${x.time}｜${x.course}｜${x.action==='REVIEW_EXISTING_BOOKING'?'既有預約需本人檢查':'建議關閉，待本人核准'}`).join('\n')+(result.changes.length>30?'\n僅列前30筆，完整預覽請使用下方日曆區。':'')+'\n未更動正式時段、日曆或對外通知。';
   }
  }catch(error){
   const messages={reservation_connection_required:'原預約系統服務端連線尚未設定；請在安全後台確認連線。',reservation_read_access_required:'帳號沒有客戶預約查詢權限，需本人核准授權。',calendar_authorization_required:'網站尚未完成 Google Calendar 唯讀授權。',calendar_timezone_required:'來源日曆時區需要設為 Asia/Taipei 後重新查核。',reservation_read_incomplete:'預約回傳不完整，未代表沒有預約。',calendar_incomplete:'日曆資料不完整，未代表沒有衝突。'};
   state=['reservation_connection_required','reservation_read_access_required','calendar_authorization_required'].includes(error.code)?'needs_connection':'failed';
   summary=messages[error.code]||'查詢失敗，尚未取得可驗證結果；請確認來源及登入後，以新的交辦重試。';orders=undefined;
  }
  // If a receipt write fails, do not claim success or leak source result. Safe to re-fetch history.
  await store.finishWork(owner,input.request,state,summary);
  return {receipt_id:input.request,history:await store.workHistory(owner),...(orders?{orders}:{} )};
 };
}
