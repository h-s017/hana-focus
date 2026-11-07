import {agendaTasks,dailyAgenda,reminderDue,taipeiDay,workspaceName,taskTime} from './shared-agenda.mjs';
export function mountDailyAgenda({db,owner,now=Date.now}){
 let disposed=false,loading=false;const key='hana-daily-agenda-seen:'+owner,enabledKey='hana-daily-agenda-enabled:'+owner;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const dialog=el('dialog');dialog.id='hana-daily-agenda';dialog.setAttribute('aria-labelledby','hana-daily-title');
 const title=el('h2','今日待辦');title.id='hana-daily-title';const list=el('div'),status=el('p');status.setAttribute('role','status');
 const close=el('button','關閉今日待辦');close.type='button';close.onclick=()=>dialog.close();
 const enabled=el('input');enabled.type='checkbox';try{enabled.checked=localStorage.getItem(enabledKey)!=='false';}catch{enabled.checked=true;}
 const label=el('label','每天 09:00 自動顯示');label.append(enabled);enabled.onchange=()=>{try{localStorage.setItem(enabledKey,String(enabled.checked));}catch{}};
 const link=el('a','開啟共用日曆');link.href='#calendar';link.onclick=()=>dialog.close();
 dialog.append(title,el('p','台北時間 09:00；網站開啟時彈出，當天較晚開啟會補顯示。關閉網站時不會由網頁推播。'),status,list,label,link,close);document.body.append(dialog);
 async function show(manual=false){
  if(disposed||loading||dialog.open)return;let seen;try{seen=localStorage.getItem(key);}catch{}
  if(!manual&&(!enabled.checked||!reminderDue(now(),seen)||document.visibilityState!=='visible'||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)))return;
  if(reminderDue(now(),null))try{localStorage.setItem(key,taipeiDay(new Date(now()).toISOString()));}catch{}
  loading=true;status.textContent='正在讀取 HANA 與教會工作…';list.replaceChildren();dialog.showModal();
  try{
   const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'focus_snapshot'}});if(error||data?.error)throw Error('unavailable');if(disposed)return;
   const date=taipeiDay(new Date(now()).toISOString()),groups=dailyAgenda(agendaTasks(data),date);title.textContent=date+' 今日待辦';
   for(const [key,name] of [['today','今日事項'],['overdue','逾期未完成'],['unscheduled','未排日期・待安排']]){
    const section=el('section');section.append(el('h3',name+' '+groups[key].length+' 件'));
    for(const t of groups[key])section.append(el('p',workspaceName(t.workspace)+'｜'+(key==='today'?taskTime(t)+'｜':'')+t.title+'｜'+t.projectName+'｜'+t.confidence));
    if(!groups[key].length)section.append(el('p','目前已讀取資料沒有此類待辦。'));list.append(section);
   }
   status.textContent='來源：HANA FOCUS 兩個雲端工作區。Google 行程與正式預約請在月曆核對。'+(data.truncated?'任務僅載入部分資料，清單可能不完整。':'');
  }catch{status.textContent='無法讀取當日待辦，請更新共用日曆；這不代表今天沒有工作。';}finally{loading=false;}
 }
 const manual=()=>void show(true),check=()=>void show();window.addEventListener('hana-show-today',manual);document.addEventListener('visibilitychange',check);
 const timer=setInterval(check,30000);void show();
 return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('hana-show-today',manual);document.removeEventListener('visibilitychange',check);dialog.close();dialog.remove();};
}
