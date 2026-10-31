import {monthDays,monthEndPlan,createMonthlyDraft} from './monthly-calendar.mjs';
const labels={calendar_unverified:'行程未核對',existing_inventory_verified:'原場次可訂',no_existing_open_inventory:'無既有場次',unverified:'待驗證',rules_missing:'待規則',needs_review:'資料待核對',conflict_requires_review:'預約衝突',closed_by_policy:'非授課日',manual_closed:'本人關閉',has_availability:'有候選',fully_booked_or_unavailable:'無候選'};
export function mountMonthlyCalendar(host,{db=null,now=Date.now}={}){
 let disposed=false,busy=false,version=0,record=null,selected=null,request=crypto.randomUUID();
 const today=new Date(now()+8*3600000).toISOString().slice(0,10),plan=monthEndPlan(today),thisMonth=today.slice(0,7);let month=thisMonth,draft=createMonthlyDraft({month});
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
 const heading=el('h2','工作月曆'),intro=el('p','私有規劃｜Asia/Taipei。預設自動讀取原預約場次的時段、課程長度及剩餘名額，不增開場次。點「讀取來源並重算草稿」即可；額外緩衝及新候選另由本人確認。'),toolbar=el('div');toolbar.className='month-toolbar';
 const monthTitle=el('h3'),state=el('p');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
 const thisButton=button('本月',()=>load(thisMonth)),nextButton=button('下月',()=>load(plan.targetMonth)),refresh=button('讀取來源並重算草稿',()=>generate()),approved=button('核准此版本（不發布）',()=>review('approved')),rejected=button('退回此版本',()=>review('rejected'));
 const syncLink=el('a','查看日曆同步與課程審核');syncLink.href='#reviews';toolbar.append(thisButton,nextButton,refresh,syncLink);
 const connect=el('a','查看 Google Calendar 連線設定');connect.href='#settings';connect.className='calendar-connect';const notice=el('p');notice.setAttribute('role','note');
 const source=el('p'),grid=el('div');grid.className='month-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','月曆日期');const detail=el('section');detail.className='month-detail';
 const form=el('form'),settings=el('details');settings.append(el('summary','選用：新增候選的授課規則（沿用原場次免填）'));const fields={};
 function field(name,text,type,value){const label=el('label',text),input=el('input');input.name=name;input.type=type;input.value=value;fields[name]=input;label.append(input);form.append(label);return input;}
 field('weekdays','授課星期，0=週日，1=週一…6=週六；以逗號分隔','text','');field('start','授課起始時間','time','');field('end','授課結束時間','time','');field('duration','每堂分鐘','number','');field('before','行程前緩衝分鐘','number','0');field('after','行程後緩衝分鐘','number','0');
 for(const key of ['duration','before','after']){fields[key].min='0';fields[key].max=key==='duration'?'720':'360';}
 const save=el('button','確認規則並重算');save.type='submit';form.append(save);settings.append(form);
 const audit=el('p'),actions=el('div');actions.append(approved,rejected);const login=el('a','登入工作台以讀取私有月曆');login.href='./workspace.html#office';
 const schedule=el('p',`月末排程未啟用。${plan.windowStart}～${plan.windowEnd} 每天 08:00 規劃更新 ${plan.targetMonth} 同一份草稿；須先完成授權、測試、部署與啟用審核。`);
 host.replaceChildren(heading,intro,toolbar,monthTitle,source,connect,notice,state,grid,detail,settings,actions,audit,schedule);if(!db)host.append(login);
 function lock(value){busy=value;for(const n of [thisButton,nextButton,refresh,save,approved,rejected])n.disabled=value||!db;if(!value){thisButton.disabled=nextButton.disabled=false;approved.disabled=!db||record?.state!=='pending';rejected.disabled=!db||!['pending','unverified'].includes(record?.state);}}
 function render(){
  monthTitle.textContent=month+' 月';source.textContent=`Google Calendar：${draft.sourceStatus?.calendar==='verified'?'已驗證':draft.sourceStatus?.calendar==='needs_connection'?'待網站授權':'未驗證'}；Reservation：${draft.sourceStatus?.reservation==='verified'?'已驗證':'未驗證'}。${draft.checkedAt?'檢查時間：'+new Date(draft.checkedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):''}`;
  connect.hidden=draft.sourceStatus?.calendar==='verified';notice.textContent=draft.sourceStatus?.calendar==='needs_connection'?'已驗證的預約場次可以查看，但尚未核對你的私人行程；不會產生或發布新的可預約時段。':'';
  grid.replaceChildren();for(const day of ['日','一','二','三','四','五','六'])grid.append(el('span',day));for(let i=0;i<monthDays(month)[0].weekday;i++)grid.append(el('span'));
  for(const day of draft.days){const b=button('',()=>{selected=day.date;renderDetail();});b.className='month-day';b.setAttribute('aria-label',day.date+' '+labels[day.status]);b.append(el('strong',Number(day.date.slice(-2))),el('small',day.status==='calendar_unverified'&&day.reservationSlots?.length?day.reservationSlots.length+' 場・行程未核對':labels[day.status]||'待確認'));if(day.date===today)b.setAttribute('aria-current','date');grid.append(b);}
  selected=draft.days.some(d=>d.date===selected)?selected:draft.days[0].date;renderDetail();
  audit.textContent=record?`草稿 monthly-availability:${month}｜版本 ${record.revision}｜${({pending:'待本人審核',unverified:'待來源或規則驗證',approved_internal:'內部核准・未發布',rejected:'退回'})[record.state]||'待確認'}｜變更日期：${(record.changedDates||draft.changedDates||[]).join('、')||'請見執行紀錄'}。重新產製會重新送審。`:'尚無已儲存草稿。';lock(false);
 }
 const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 function renderDetail(){const day=draft.days.find(x=>x.date===selected);detail.replaceChildren(el('h3',selected+'｜'+labels[day.status]));
  if(day.status==='calendar_unverified')detail.append(el('p','以下只顯示原預約系統場次，尚未核對 Google 行程；不代表你有空。'));
  for(const x of day.reservationSlots||day.existingOpen)detail.append(el('p',`原系統場次：${x.course} ${time(x.start)}–${time(x.end)}，${x.status||'開放'}，剩餘 ${x.remaining} 位（非本草稿發布）`));
  for(const x of day.proposed)detail.append(el('p',`未發布候選：${time(x.start)}–${time(x.end)}；名額／課程另待確認`));
  for(const x of day.conflicts)detail.append(el('p',`已報名 ${x.booked} 位的場次與行程衝突，請本人處理；未取消或改期。`));
  if(!day.proposed.length)detail.append(el('p','目前沒有可發布的候選。待驗證不代表空閒。'));
  if(db&&record){detail.append(button(day.manualOverride?'移除本草稿的手動關閉':'本草稿手動關閉此日',()=>{const overrides={...record.overrides};if(day.manualOverride)delete overrides[selected];else overrides[selected]='closed';void generate({overrides});}));}
 }
 async function invoke(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error)throw Error(data?.error||'monthly_unavailable');return data;}
 function adopt(value){record=value;draft=value?.generated||createMonthlyDraft({month});const p=value?.policy||{};fields.weekdays.value=(p.weekdays||[]).join(',');fields.start.value=p.windows?.[0]?.start||'';fields.end.value=p.windows?.[0]?.end||'';fields.duration.value=p.durationMinutes||'';fields.before.value=p.bufferBeforeMinutes||0;fields.after.value=p.bufferAfterMinutes||0;render();}
 async function load(wanted){if(disposed||busy)return;month=wanted;record=null;draft=createMonthlyDraft({month});render();if(!db){state.textContent='尚未登入；未讀取私人行程。';return;}lock(true);const v=++version;state.textContent='讀取私有草稿…';try{const data=await invoke({action:'monthly_load',month});if(disposed||v!==version)return;adopt(data.record);state.textContent='已載入草稿；'+(draft.sourceStatus?.calendar==='needs_connection'?'Google 尚未授權，重算不會自動完成連線。':'需要最新資料請重算。');}catch{if(!disposed&&v===version){adopt(null);state.textContent='草稿無法載入，請確認登入或後端版本；未代表沒有預約。';}}finally{if(!disposed)lock(false);}}
 async function generate(extra={}){if(disposed||busy||!db)return;lock(true);const v=++version;state.textContent='正在唯讀查核來源並儲存草稿…';request=crypto.randomUUID();try{const data=await invoke({action:'monthly_generate',month,revision:record?.revision||0,request_id:request,...extra});if(disposed||v!==version)return;adopt({...data.record,changedDates:data.changedDates});state.textContent='草稿已更新；'+(draft.sourceVerified?'請檢查候選與衝突後審核。':'來源未驗證，不可發布。');}catch{if(!disposed&&v===version){record=null;draft=createMonthlyDraft({month});render();state.textContent='重算未確認成功或版本已更新，請切換月份重新載入後再操作；不可依舊草稿發布。';}}finally{if(!disposed)lock(false);}}
 async function review(decision){if(busy||!record||!confirm('確認'+(decision==='approved'?'核准':'退回')+'目前版本？不會發布或更改正式預約。'))return;lock(true);const v=++version;try{const data=await invoke({action:'monthly_review',month,revision:record.revision,decision,request_id:crypto.randomUUID()});if(disposed||v!==version)return;adopt(data.record);state.textContent='本人審核已記錄，尚未發布。';}catch{if(!disposed)state.textContent='審核未完成。來源可能過期或版本已變更，請先重新讀取來源。';}finally{if(!disposed)lock(false);}}
 form.onsubmit=e=>{e.preventDefault();const weekdays=fields.weekdays.value.split(',').filter(x=>x.trim()!=='').map(Number);if(!weekdays.length||!fields.start.value||!fields.end.value||!fields.duration.value){state.textContent='請先填寫授課星期、時間與每堂分鐘，不會自行推定規則。';return;}void generate({policy:{...record?.policy,weekdays,windows:[{start:fields.start.value,end:fields.end.value}],durationMinutes:Number(fields.duration.value),stepMinutes:30,bufferBeforeMinutes:Number(fields.before.value),bufferAfterMinutes:Number(fields.after.value)}});};
 render();void load(month);return ()=>{disposed=true;version++;record=null;draft=null;host.replaceChildren();};
}
