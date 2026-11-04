export function mountOrderEditor(host,{db,onSaved}){
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const field=(title,type='text',max)=>{const l=el('label',title),i=el(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;if(max)i.maxLength=max;l.append(i);return {l,i};};
 const box=el('details'),summary=el('summary','新增已成立訂單');box.append(summary);
 const form=el('form'),month=field('場次月份','month'),course=el('select'),courseLabel=el('label','課程方案'),slotsHost=el('div'),status=el('p'),preview=el('div');status.setAttribute('role','status');
 month.i.value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
 // ISO month is stable across browsers regardless of locale ordering.
 month.i.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).format(new Date());
 const read=el('button','載入場次');read.type='button';courseLabel.append(course);
 const name=field('姓名','text',50),phone=field('電話','tel',20),email=field('Email','email',100),line=field('LINE','text',50),quantity=field('人數／單位數','number'),note=field('管理備註','textarea',500),reference=field('收款參考（已收款必填）','text',150);
 quantity.i.min='1';quantity.i.max='100';quantity.i.value='1';for(const x of [name,phone,email])x.i.required=true;
 const paymentLabel=el('label','收款紀錄'),payment=el('select');for(const [value,label] of [['unpaid','已確認・待收款'],['received','實際已收款']]){const o=el('option',label);o.value=value;payment.append(o);}paymentLabel.append(payment);
 const review=el('button','檢查並預覽');review.type='submit';form.append(month.l,read,courseLabel,slotsHost,name.l,phone.l,email.l,line.l,quantity.l,paymentLabel,reference.l,note.l,review);
 let disposed=false,busy=false,courses=[],slots=[],intent=null,requestId=crypto.randomUUID();
 const messages={reservation_manage_access_required:'此操作僅限 HANA 管理員。',reservation_slot_full:'名額不足或場次已關閉，請重新載入場次。',reservation_course_unavailable:'課程目前未開放。',reservation_state_conflict:'訂單狀態已變更，請重新整理確認。',invalid_booking_change:'請檢查必填資料、場次及收款參考。',reservation_manage_unknown:'結果尚未核實。請先重新整理訂單；若未找到，使用原預覽重試，避免另建一筆。'};
 async function api(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error){let code=data?.error;try{code||=(await error?.context?.json())?.error;}catch{}throw Object.assign(Error(),{code});}return data;}
 function drawSlots(){slotsHost.replaceChildren();const c=courses.find(c=>c.id===course.value);if(!c)return;slotsHost.append(el('p',`需選 ${c.required_slots} 場｜每${c.unit||'位'} NT$ ${c.price?.toLocaleString('zh-TW')}`));for(const s of slots.filter(s=>s.course_id===c.id&&s.bookable)){const l=el('label'),i=el('input');i.type='checkbox';i.value=s.id;i.name='slot';l.append(i,document.createTextNode(`${s.date} ${s.time}｜剩 ${s.capacity-s.booked}`));slotsHost.append(l);}if(!slotsHost.querySelector('input'))slotsHost.append(el('p','本月沒有可新增的場次。'));}
 course.onchange=drawSlots;
 read.onclick=async()=>{if(busy)return;busy=true;read.disabled=true;status.textContent='讀取場次…';try{const d=await api({action:'reservation_catalogue',month:month.i.value});if(disposed)return;courses=d.courses.filter(c=>c.enabled&&!c.contest&&c.price>0);slots=d.slots;course.replaceChildren();for(const c of courses){const o=el('option',c.course+(c.variant?'｜'+c.variant:''));o.value=c.id;course.append(o);}drawSlots();status.textContent='已讀取原系統場次。';}catch(e){status.textContent=messages[e.code]||'無法載入場次。';}finally{busy=false;read.disabled=false;}};
 function lock(value){for(const x of form.elements)x.disabled=value;}
 form.onsubmit=e=>{e.preventDefault();if(busy||!form.reportValidity())return;const c=courses.find(c=>c.id===course.value),slotIds=[...slotsHost.querySelectorAll('input:checked')].map(i=>i.value),qty=Number(quantity.i.value),received=payment.value==='received';if(!c||slotIds.length!==c.required_slots||!Number.isInteger(qty)||qty<1||qty>100||received&&!reference.i.value.trim()){status.textContent='請選齊課程場次，並確認人數及收款參考。';return;}
  intent={action:'reservation_create',request_id:requestId,confirmed:true,received,reference:reference.i.value.trim(),name:name.i.value.trim(),phone:phone.i.value.trim(),email:email.i.value.trim(),line:line.i.value.trim(),note:note.i.value.trim(),slotIds,quantity:qty};
  preview.replaceChildren(el('h3','確認新增'),el('p',`${intent.name}｜${c.course}｜${qty} ${c.unit||'位'}｜NT$ ${(c.price*qty).toLocaleString('zh-TW')}｜${received?'已確認實際收款':'待收款'}`),el('p',slotIds.map(id=>{const s=slots.find(s=>s.id===id);return s.date+' '+s.time;}).join('／')),el('p','將成立原系統訂單並占用名額，不會向學生發送通知。'));
  const save=el('button','確認成立訂單'),back=el('button','返回修改');save.type=back.type='button';lock(true);
  back.onclick=()=>{if(busy)return;intent=null;preview.replaceChildren();lock(false);};
  save.onclick=async()=>{if(busy||!intent)return;busy=true;save.disabled=back.disabled=true;status.textContent='儲存中…';try{const r=await api(intent);if(disposed)return;requestId=crypto.randomUUID();intent=null;preview.replaceChildren();lock(false);form.reset();month.i.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).format(new Date());quantity.i.value='1';course.replaceChildren();slotsHost.replaceChildren();status.textContent='已成立：'+r.id+(r.audit_recorded?'':'（工作台操作紀錄待補；原系統已儲存）');await onSaved?.();}catch(e){status.textContent=messages[e.code]||'無法完成，請先重新整理訂單確認結果。';save.textContent='使用同一筆資料重試';}finally{busy=false;save.disabled=back.disabled=false;}};
  preview.append(save,back);
 };
 box.append(form,preview,status);host.append(box);return()=>{disposed=true;intent=null;host.replaceChildren();};
}
