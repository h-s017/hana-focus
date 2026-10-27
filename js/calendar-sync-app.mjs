import {beginGoogleConnection} from './google-connect.mjs';
export const taipeiInput=value=>value?new Date(Date.parse(value)+28800000).toISOString().slice(0,16):'';
export function inputWindow(start,end){
 if(!start&&!end)return {start:null,end:null};
 const valid=v=>/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(v)&&Number.isFinite(Date.parse(v+':00+08:00'));
 if(!valid(start)||!valid(end)||Date.parse(end+':00+08:00')<=Date.parse(start+':00+08:00'))throw Object.assign(Error('calendar_sync_invalid'),{code:'calendar_sync_invalid'});
 return {start:new Date(start+':00+08:00').toISOString(),end:new Date(end+':00+08:00').toISOString()};
}
export function mountCalendarSyncPanel(host,{db}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const status=el('p','尚未檢查同步設定。'),list=el('div'),month=el('input');status.setAttribute('role','status');month.type='month';month.value=new Date(Date.now()+28800000).toISOString().slice(0,7);month.setAttribute('aria-label','同步月份');
 const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=()=>operate(fn);return b;};
 async function call(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error){let code=data?.error;try{code||=(await error.context?.json())?.error;}catch{}throw Object.assign(Error('sync_failed'),{code});}return data;}
 let busy=false;
 async function operate(fn){if(busy)return;busy=true;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){const messages={calendar_sync_activation_required:'日曆寫入同步尚未啟用；原唯讀連線仍可使用。',calendar_sync_authorization_required:'請先完成 Google 同步寫入授權。',reservation_sync_setup_required:'原課程系統的專用同步連線尚未完成。',calendar_sync_conflict:'資料已變動，請更新警告內容後重新審核。',calendar_sync_busy:'另一個同步正在執行，請稍後更新狀態。'};status.textContent=messages[e.code]||'同步未確認完成，請更新狀態；不要將此狀態視為成功。';}finally{busy=false;host.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 async function load(){const d=await call({action:'calendar_sync_status'});status.textContent=(d.enabled?'同步功能已啟用':'同步尚未啟用')+'；Google 寫入授權：'+(d.authorized?'已保存':'尚未取得')+'；背景排程關閉。';list.replaceChildren();
  for(const r of d.links.filter(r=>r.status!=='ready')){
   const card=el('article'),p=r.pending;card.append(el('h4',p?.source?.course||p?.source?.title||r.source_id));
   const enrolled=r.kind==='slot'&&(p?.source?.booked||0)>0;
   const warning=el('p',enrolled?'警告：已有 '+p.source.booked+' 單位報名。Google 的改期／刪除尚未更新原課程系統，須本人審核。':'同步狀態：'+r.status+'；兩邊資料需本人核對。');if(enrolled){warning.setAttribute('role','alert');warning.className='calendar-sync-warning';}card.append(warning);
   if(p){card.append(el('p','原課程／任務：'+(p.source.date? p.source.date+' '+p.source.time : taipeiInput(p.source.schedule_start_at)+' ～ '+taipeiInput(p.source.schedule_end_at))));card.append(el('p','Google：'+(p.google?.status==='cancelled'||!p.google?'已刪除':taipeiInput(p.google.start?.dateTime)+' ～ '+taipeiInput(p.google.end?.dateTime))));
    card.append(el('p','日曆刪除核准後只停止該場次收新報名；既有訂單及付款保留，不自動退款或通知客戶。'));
    if(r.status!=='unknown')for(const [direction,label] of [['import','核准 Google 變更並更新原系統'],['export','採原系統資料更新 Google']])card.append(button(label,async()=>{if(!confirm(label+'？請核對警告及新舊時間。'))return;await call({action:'calendar_sync_review',link_id:r.id,review_id:p.id,decision:'approved',direction});await load();}));
    if(r.status!=='unknown')card.append(button('退回變更（保留兩邊資料）',async()=>{await call({action:'calendar_sync_review',link_id:r.id,review_id:p.id,decision:'rejected'});await load();}));
   }
   card.append(button('重新查核兩邊資料',async()=>{await call({action:'calendar_sync_reconcile',link_id:r.id});await load();}));list.append(card);
  }
 }
 host.append(el('p','課程雙向同步；已報名課程先警告並送本人審核。只有已排開始／結束時間的任務會同步。'),month,
  button('授權 Google 日曆同步寫入',async()=>{if(!confirm('允許 HANA 管理同步事件；Google 將要求日曆事件寫入權限。本人需在 Google 最後同意。'))return;await beginGoogleConnection({db,storage:sessionStorage,navigate:url=>location.assign(url),sync:true});}),
  button('更新同步與待審核狀態',load),button('同步此月份課程與任務',async()=>{const r=await call({action:'calendar_sync_run',month:month.value});await load();status.textContent='本次同步 '+r.changed+' 項；待審核 '+r.pending+' 項；未完成 '+r.skipped+' 項。'+(r.status==='more_pending'?'仍有待處理資料，請再次同步。':'');for(const w of r.warnings||[])list.append(el('p',w.source_id+'：'+w.code));}),status,list);
}
