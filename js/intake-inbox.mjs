import {intakeState,receiptTime} from './intake-state.mjs?v=intake-history-20261104';
const SHEET='https://docs.google.com/spreadsheets/d/1kT-xXo9lRoR4ZlqpMr8cjCk2pejMdNcMg7lKHIqpZek/edit';
export function mountIntakeInbox(host,{db}){
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const heading=el('h3','課前問卷'),status=el('p'),latestLabel=el('p'),list=el('div'),refresh=el('button','查看新回覆'),details=el('details'),summary=el('summary','回覆紀錄與來源');status.setAttribute('role','status');refresh.type='button';
 const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
 details.append(summary,el('p','歷史回覆保留原填寫時間，不計入新通知。姓名與訂單對應待本人核對；完整答案見原回覆表。' ),link('原回覆表',SHEET),document.createTextNode(' ｜ '),link('學生問卷','https://quiz.hanascent.com/'),list);host.append(heading,status,latestLabel,refresh,details);
 let disposed=false,busy=false,lastIds='',toast=null;
 async function load(){if(disposed||busy||document.hidden)return;busy=true;refresh.disabled=true;
  try{const {data,error}=await db.from('hana_intake_receipts').select('id,student_name,courses,source_row,seen_at,created_at,status,receipt_kind,submitted_at,source_verified_at').order('created_at',{ascending:false}).order('submitted_at',{ascending:false,nullsFirst:false}).limit(100);if(error)throw error;if(disposed)return;
   const state=intakeState(data),unread=state.unread,ids=unread.map(x=>x.id).join(',');status.textContent=data.length?'本頁 '+state.saved.length+' 份｜新 '+unread.length+'｜歷史 '+state.historical.length:'尚無已核實紀錄，請查原回覆表。';summary.textContent='回覆紀錄（最近 '+data.length+' 筆）';latestLabel.textContent=state.latest?'最新回覆：'+state.latest.student_name+'｜'+new Date(receiptTime(state.latest)).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+(state.latest.receipt_kind==='historical'?'（歷史）':''):'';
   if(unread.length&&ids!==lastIds){toast?.remove();toast=el('aside');toast.className='intake-toast';toast.setAttribute('role','status');toast.append(el('span','有 '+unread.length+' 份新課前問卷 '));const open=el('button','查看'),close=el('button','稍後');open.type=close.type='button';open.onclick=()=>{document.documentElement.dataset.focusWorkspace='work';window.dispatchEvent(new CustomEvent('hana-workspace-changed'));location.hash='orders';details.open=true;host.scrollIntoView({behavior:'smooth'});toast.remove();};close.onclick=()=>toast.remove();toast.append(open,close);document.body.append(toast);}lastIds=ids;const pending=state.pending.length;if(pending)status.textContent+=' 待查核 '+pending+' 筆。';
   list.replaceChildren();for(const r of data){const item=el('article'),d=el('details');d.append(el('summary',(r.receipt_kind==='historical'?'歷史｜':r.seen_at?'':'新｜')+r.student_name+'｜'+new Date(receiptTime(r)).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})),el('p',r.status==='saved'?'已確認儲存｜訂單對應待確認':'儲存尚未核實｜請查核原回覆表'),el('p','曾上課程：'+(r.courses.join('、')||'未填')),
    link('開啟原始回覆',r.source_row?SHEET+'#range='+encodeURIComponent("'測驗回覆'!A"+r.source_row+':AD'+r.source_row):SHEET));
    if(r.status==='saved'&&r.receipt_kind!=='historical'&&!r.seen_at){const seen=el('button','標為已讀');seen.type='button';seen.onclick=async()=>{seen.disabled=true;const {error}=await db.from('hana_intake_receipts').update({seen_at:new Date().toISOString()}).eq('id',r.id);if(error){status.textContent='無法更新已讀狀態。';seen.disabled=false;}else{lastIds='';toast?.remove();await load();}};d.append(seen);}item.append(d);list.append(item);}
  }catch{if(!disposed){status.textContent='回覆讀取失敗，筆數尚未核實；請查看原回覆表。';latestLabel.textContent='';list.replaceChildren();}}finally{busy=false;if(!disposed)refresh.disabled=false;}
 }
 refresh.onclick=load;void load();const timer=setInterval(load,60000);const visible=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',visible);
 return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);toast?.remove();host.replaceChildren();};
}
