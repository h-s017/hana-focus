import {mountOrderEditor} from './order-editor.mjs?v=orders-intake-20261104';
import {mountIntakeInbox} from './intake-inbox.mjs?v=orders-intake-20261104';
import {orderMatchesDate} from './calendar-overview.mjs';
export function mountReservationOrders(host,{db}){
 let disposed=false,busy=false,generation=0,rows=[],cursor=null,next=null;const history=[];
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
 const stateNames={DRAFT:'未完成',PENDING:'待付款',PAID:'已付款',FAILED:'付款失敗',CANCELLED:'已取消',EXPIRED:'已過期',LINE_CONFIRMATION:'已確認・待收款'};
 const title=el('h2','課程訂單'),notice=el('p','原預約系統集中管理｜移除保留紀錄，不會寄送通知。');
 const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const search=el('input');search.type='search';search.placeholder='搜尋目前頁的姓名、訂單編號、課程';search.setAttribute('aria-label','搜尋本頁預約');search.autocomplete='off';
 const list=el('div'),controls=el('div'),editor=el('div'),intake=el('section'),archivedLabel=el('label','顯示已移除訂單'),archived=el('input');archived.type='checkbox';archivedLabel.prepend(archived);const date=el('input');date.type='date';date.setAttribute('aria-label','依日期篩選本頁預約');const dateLabel=el('label','日期篩選（僅目前頁）');dateLabel.append(date);const filterNote=el('p');filterNote.setAttribute('role','status');
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const first=button('讀取／重新整理預約明細',()=>load(null,true)),prev=button('上一頁',()=>{if(history.length)void load(history.pop(),false,true);}),more=button('下一頁',()=>{if(next){history.push(cursor);void load(next);}});
 prev.disabled=more.disabled=true;controls.append(first,prev,more);
 const money=v=>v===null||v===undefined?'未提供':'NT$ '+Number(v).toLocaleString('zh-TW');
 function render(){list.replaceChildren();let matched=0;const q=search.value.trim().toLocaleLowerCase();
  for(const row of rows){if(row.archived&&!archived.checked)continue;if(!orderMatchesDate(row,date.value))continue;if(q&&![row.id,row.name,row.course,row.variant,row.sessions].join(' ').toLocaleLowerCase().includes(q))continue;
   const article=el('article'),detail=el('details');detail.append(el('summary',row.name+'｜'+row.course+'｜'+(stateNames[row.status]||row.status||'狀態待確認')));
   for(const [label,value] of [['訂單編號',row.id],['課程方案',row.variant],['場次',row.sessions],['人數／單位',row.quantity===null?'未提供':String(row.quantity)+' '+(row.booking_unit||'位')],['金額',money(row.amount)],['付款狀態',stateNames[row.status]||row.status],['電話',row.phone],['Email',row.email],['LINE',row.line],['取消狀態',row.cancellation_status],['備註',row.note]])detail.append(el('p',label+'：'+(value||'—')));
   if(row.archived)detail.append(el('p','已移除｜保留原紀錄'));
   if(row.archived||['PENDING','FAILED','CANCELLED'].includes(row.status)){
    const remove=button(row.archived?'恢復顯示':'移除未成立訂單',()=>{
     const confirmBox=el('div');confirmBox.append(el('p',row.archived?'恢復清單顯示；不會恢復名額或變更付款。':'確認移除此筆未成立訂單？將取消並釋放名額，原紀錄仍保留。'));
     const yes=button('確認',async()=>{if(busy)return;busy=true;yes.disabled=true;try{const {data,error}=await db.functions.invoke('hana-automation',{body:{action:row.archived?'reservation_restore':'reservation_archive',id:row.id,confirmed:true}});if(error||data?.error)throw Error();busy=false;await load(cursor);status.textContent=row.archived?'已恢復顯示。':'已移除並保留紀錄。';}catch{status.textContent='未核實操作結果，請重新整理；付款處理中或已成立訂單不能移除。';}finally{busy=false;yes.disabled=false;}}),no=button('取消',()=>confirmBox.remove());confirmBox.append(yes,no);detail.append(confirmBox);remove.disabled=true;
     no.onclick=()=>{confirmBox.remove();remove.disabled=false;};
    });detail.append(remove);
   }
   article.append(detail);list.append(article);matched++;
  }
  filterNote.textContent=(date.value?date.value+'｜':'')+'目前頁符合 '+matched+' 筆；不代表全部訂單。其他頁請使用下一頁查詢。';
 }
 async function load(wanted,reset=false,back=false){if(disposed||busy)return;busy=true;first.disabled=prev.disabled=more.disabled=true;const v=++generation;status.textContent='讀取原系統…';
  // Clear previous private records before a request, including when a session expires.
  rows=[];render();
  try{const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'reservation_details',cursor:wanted}});
   if(error){let code;try{code=(await error.context?.json())?.error;}catch{}throw Object.assign(Error('request_failed'),{code});}
   if(data?.error)throw Object.assign(Error('request_failed'),{code:data.error});
   if(!Array.isArray(data?.orders))throw Error('invalid_response');
   if(disposed||v!==generation)return;rows=data.orders;cursor=wanted;next=data.next_cursor||null;if(reset)history.length=0;search.value='';render();
   status.textContent='本頁 '+rows.length+' 筆；付款與場次狀態以原系統為準。可展開查看或管理訂單。';
  }catch(error){if(disposed||v!==generation)return;next=null;if(back)history.length=0;
   const messages={reservation_read_access_required:'此帳號尚未取得客戶預約明細查詢權限。',reservation_connection_required:'原預約系統的服務端管理連線尚未設定或已失效；請只在安全後台設定憑證，不要貼在聊天或任務內容。',reservation_read_incomplete:'原系統分頁資料不完整，請重新整理；未代表沒有訂單。',login_required:'登入已失效，請重新登入。'};
   status.textContent=messages[error.code]||'暫時無法讀取預約明細。請確認登入及原系統連線；正式預約沒有變更。';
  }finally{busy=false;if(!disposed){first.disabled=false;prev.disabled=!history.length;more.disabled=!next;}}
 }
 const selectDate=event=>{if(/^\d{4}-\d{2}-\d{2}$/.test(event.detail||'')){date.value=event.detail;render();}};window.addEventListener('hana-reservation-date',selectDate);date.onchange=render;archived.onchange=render;search.oninput=render;host.replaceChildren(title,notice,intake,editor,controls,dateLabel,search,archivedLabel,status,filterNote,list);const disposeEditor=mountOrderEditor(editor,{db,onSaved:()=>load(null,true)}),disposeIntake=mountIntakeInbox(intake,{db});status.textContent='按「讀取／重新整理預約明細」查詢。';
 // Orders require explicit loading. Intake receipt metadata is private and polls only while visible; neither is cached locally.
 return ()=>{disposeEditor();disposeIntake();window.removeEventListener('hana-reservation-date',selectDate);disposed=true;generation++;rows=[];next=null;cursor=null;history.length=0;search.value='';host.replaceChildren();};
}
