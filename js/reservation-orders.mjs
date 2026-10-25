export function mountReservationOrders(host,{db}){
 let disposed=false,busy=false,generation=0,rows=[],cursor=null,next=null;const history=[];
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
 const stateNames={DRAFT:'未完成',PENDING:'待付款',PAID:'已付款',FAILED:'付款失敗',CANCELLED:'已取消',EXPIRED:'已過期'};
 const title=el('h2','客戶預約明細｜唯讀'),notice=el('p','資料由原預約系統即時讀取，不複製客戶資料到工作台資料庫。僅限已獲預約查詢權限的管理帳號。');
 const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const search=el('input');search.type='search';search.placeholder='搜尋目前頁的姓名、訂單編號、課程';search.setAttribute('aria-label','搜尋本頁預約');search.autocomplete='off';
 const list=el('div'),controls=el('div');
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const first=button('讀取／重新整理預約明細',()=>load(null,true)),prev=button('上一頁',()=>{if(history.length)void load(history.pop(),false,true);}),more=button('下一頁',()=>{if(next){history.push(cursor);void load(next);}});
 prev.disabled=more.disabled=true;controls.append(first,prev,more);
 const money=v=>v===null||v===undefined?'未提供':'NT$ '+Number(v).toLocaleString('zh-TW');
 function render(){list.replaceChildren();const q=search.value.trim().toLocaleLowerCase();
  for(const row of rows){if(q&&![row.id,row.name,row.course,row.variant,row.sessions].join(' ').toLocaleLowerCase().includes(q))continue;
   const article=el('article'),detail=el('details');detail.append(el('summary',row.name+'｜'+row.course+'｜'+(stateNames[row.status]||row.status||'狀態待確認')));
   for(const [label,value] of [['訂單編號',row.id],['課程方案',row.variant],['場次',row.sessions],['人數／單位',row.quantity===null?'未提供':String(row.quantity)+' '+(row.booking_unit||'位')],['金額',money(row.amount)],['付款狀態',stateNames[row.status]||row.status],['電話',row.phone],['Email',row.email],['LINE',row.line],['取消狀態',row.cancellation_status],['備註',row.note]])detail.append(el('p',label+'：'+(value||'—')));
   article.append(detail);list.append(article);
  }
 }
 async function load(wanted,reset=false,back=false){if(disposed||busy)return;busy=true;first.disabled=prev.disabled=more.disabled=true;const v=++generation;status.textContent='正在唯讀查詢原系統…';
  // Clear previous private records before a request, including when a session expires.
  rows=[];render();
  try{const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'reservation_details',cursor:wanted}});
   if(error){let code;try{code=(await error.context?.json())?.error;}catch{}throw Object.assign(Error('request_failed'),{code});}
   if(data?.error)throw Object.assign(Error('request_failed'),{code:data.error});
   if(!Array.isArray(data?.orders))throw Error('invalid_response');
   if(disposed||v!==generation)return;rows=data.orders;cursor=wanted;next=data.next_cursor||null;if(reset)history.length=0;search.value='';render();
   status.textContent='本頁 '+rows.length+' 筆；付款與場次狀態以原系統為準。這裡不會修改預約、退款或發送通知。';
  }catch(error){if(disposed||v!==generation)return;next=null;if(back)history.length=0;
   const messages={reservation_read_access_required:'此帳號尚未取得客戶預約明細查詢權限。',reservation_connection_required:'原預約系統的服務端管理連線尚未設定或已失效；請只在安全後台設定憑證，不要貼在聊天或任務內容。',reservation_read_incomplete:'原系統分頁資料不完整，請重新整理；未代表沒有訂單。',login_required:'登入已失效，請重新登入。'};
   status.textContent=messages[error.code]||'暫時無法讀取預約明細。請確認登入及原系統連線；正式預約沒有變更。';
  }finally{busy=false;if(!disposed){first.disabled=false;prev.disabled=!history.length;more.disabled=!next;}}
 }
 search.oninput=render;host.replaceChildren(title,notice,controls,search,status,list);status.textContent='按「讀取／重新整理預約明細」查詢。';
 // No localStorage, offline cache, URL parameters, third-party resources or automatic PII fetch.
 return ()=>{disposed=true;generation++;rows=[];next=null;cursor=null;history.length=0;search.value='';host.replaceChildren();};
}
