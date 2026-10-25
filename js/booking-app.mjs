export function mountBooking(host,{invoke}){
 let disposed=false,busy=false,slots=[],slotRequest=crypto.randomUUID(),orderRequest=crypto.randomUUID();
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const list=el('div'),source=el('select');source.setAttribute('aria-label','選擇原系統時段');
 const slotForm=el('form'),orderForm=el('form');
 const field=(form,name,label,type='text')=>{const input=el('input');input.name=name;input.type=type;const wrap=el('label',label);wrap.append(input);form.append(wrap);return input;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const capacity=field(slotForm,'capacity','名額','number');capacity.min=0;capacity.max=1000;
 const date=field(slotForm,'date','日期','date'),time=field(slotForm,'time','時段（例如 13:00–15:00）');
 const state=el('select');state.name='status';state.setAttribute('aria-label','時段狀態');for(const text of ['開放','關閉']){const option=el('option',text);option.value=text;state.append(option);}slotForm.prepend(source);slotForm.append(state,el('button','儲存時段修改草稿'));
 const order=field(orderForm,'order','原預約／訂單編號');order.required=true;order.maxLength=80;
 const action=el('select');action.name='action';action.setAttribute('aria-label','預約修改類型');for(const [value,text] of [['reschedule','改期'],['quantity','修改人數'],['cancel','取消預約']]){const option=el('option',text);option.value=value;action.append(option);}orderForm.append(action);
 const quantity=field(orderForm,'quantity','修改後人數','number');quantity.min=1;quantity.max=100;
 const ids=field(orderForm,'slot_ids','改期後的場次 ID（多筆以逗號分隔）');ids.maxLength=1800;
 orderForm.append(el('p','只填訂單編號，不需客戶姓名或聯絡資料。尚未取得原系統訂單管理連線前，草稿會保留待查核，不能核准執行。'),el('button','儲存客戶預約修改草稿'));
 source.onchange=()=>{const s=slots.find(x=>x.id===source.value);if(s){capacity.value=s.capacity;date.value=s.date;time.value=s.time;state.value=s.status;}slotRequest=crypto.randomUUID();};
 slotForm.oninput=()=>{slotRequest=crypto.randomUUID();};orderForm.oninput=()=>{orderRequest=crypto.randomUUID();};
 async function run(fn){if(disposed||busy)return;busy=true;try{await fn();}catch(e){if(!disposed)status.textContent=e.message;}finally{busy=false;}}
 async function load(){const data=await invoke({action:'booking_list'});if(disposed)return;list.replaceChildren();
  for(const c of data.changes){const card=el('article');card.append(el('h4',(c.target==='slot'?'時段':'客戶預約')+'｜'+c.target_id),el('p','審核：'+c.state+'｜'+(c.source_verified?'已讀取時段資料':'原訂單待查核')),el('pre',JSON.stringify(c.proposal,null,2)));
   if(c.state==='pending')for(const [decision,label] of [['approved','核准修改建議（不套用）'],['rejected','退回草稿']]){const b=button(label,()=>run(async()=>{if(!confirm(label+'？正式預約不會變更。'))return;await invoke({action:'booking_review',change_id:c.id,decision});await load();status.textContent='審核已保存；正式預約、日曆與通知均未變更。';}));if(decision==='approved'&&!c.source_verified)b.disabled=true;card.append(b);}list.append(card);
  }
 }
 const refresh=button('讀取原系統可預約時段',()=>run(async()=>{const data=await invoke({action:'booking_slots'});if(disposed)return;slots=data.slots;source.replaceChildren();for(const s of slots){const option=el('option',s.date+' '+s.time+'｜'+s.course+'｜已報名 '+s.booked+'/'+s.capacity+'｜ID '+s.id);option.value=s.id;source.append(option);}source.onchange();status.textContent='已唯讀載入 '+slots.length+' 個場次；未修改正式網站。';}));
 slotForm.onsubmit=event=>{event.preventDefault();void run(async()=>{if(!source.value)throw Error('請先讀取並選擇原系統時段。');await invoke({action:'booking_save',request_id:slotRequest,target:'slot',target_id:source.value,patch:{capacity:Number(capacity.value),date:date.value,time:time.value,status:state.value}});await load();status.textContent='時段修改草稿已保存，尚未套用正式網站。';});};
 orderForm.onsubmit=event=>{event.preventDefault();void run(async()=>{const patch={action:action.value};if(action.value==='quantity')patch.quantity=Number(quantity.value);if(action.value==='reschedule')patch.slot_ids=ids.value.split(',').map(s=>s.trim()).filter(Boolean);await invoke({action:'booking_save',request_id:orderRequest,target:'order',target_id:order.value.trim(),patch});await load();status.textContent='客戶預約修改草稿已保存；原訂單與付款狀態仍待查核，未取消或改期。';});};
 host.replaceChildren(el('h3','預約修改｜草稿與人工審核'),el('p','可編輯時段、名額及客戶預約建議。核准只表示內部建議通過，不會直接修改正式預約或寄送通知。'),refresh,slotForm,orderForm,status,button('更新修改草稿',()=>run(load)),list);void run(load);
 return ()=>{disposed=true;host.replaceChildren();};
}
