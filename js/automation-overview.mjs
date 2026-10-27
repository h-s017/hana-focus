import {taipeiDate,socialStatus} from './three-agent-status.mjs';
export function mountAutomationOverview(host,{db,getSnapshot,onTask,request=fetch,now=()=>new Date()}){
 let disposed=false,generation=0;const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
 const heading=el('h3','所有自動處理，一起看'),note=el('p','這裡集中顯示現有流程的結果；需要你決定的部分會留在原工作裡。'),list=el('div'),activity=el('div'),status=el('p');status.setAttribute('aria-live','polite');const refresh=el('button','更新處理進度');refresh.type='button';host.append(heading,note,list,activity,refresh,status);
 async function load(){
  if(disposed)return;const v=++generation;refresh.disabled=true;
  const results=await Promise.allSettled([
   db.functions.invoke('hana-automation',{body:{action:'status'}}).then(r=>{if(r.error||r.data?.error)throw Error();return r.data;}),
   request('./content/instagram/latest.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return socialStatus(await r.json(),taipeiDate(now()));}),
   db.functions.invoke('hana-automation',{body:{action:'canva_import_status'}}).then(r=>{if(r.error||r.data?.error)throw Error();return r.data;})
  ]);
  if(disposed||v!==generation)return;list.replaceChildren();activity.replaceChildren();
  const snapshot=getSnapshot(),projects=snapshot?.projects.filter(p=>p.workspace==='work')||[],tasks=(snapshot?.tasks||[]).filter(t=>projects.some(p=>p.id===t.project_id&&p.active_version_id===t.version_id)&&t.scope_status==='in_scope'&&t.work_state!=='done');
  const row=(title,text)=>{const item=el('div');item.className='automation-row';item.append(el('strong',title),el('p',text));list.append(item);};
  row('PM 工作整理',tasks.filter(t=>t.status==='running').length+' 件正在處理；'+tasks.filter(t=>t.status==='review').length+' 份整理等你查看。');
  const social=results[1].status==='fulfilled'?results[1].value:null;
  row('每日社群文案',social?(social.state==='copy_ready'||social.state==='delivered_internal'?'今天已有文案紀錄；不代表已發布。':social.state==='stale'?'尚未確認今天的成果。':'今天的文案尚未完成。'):'目前無法取得執行紀錄。');
  const canva=results[2].status==='fulfilled'?results[2].value:null;
  const canvaLabels={success:'今天的 Canva 設計已完成內部驗證，尚未發布。',in_progress:'正在排版，等待下一次確認。',submitting:'已送出排版工作，等待結果。',reserved:'工作已排隊，尚未送出。',not_started:'今天尚未啟動。',source_not_ready:'正在等今天的教材。',needs_verification:'需要確認設計頁數或結果。',failed:'處理失敗，需要查看原因。'};
  row('Canva 自動排版',canvaLabels[canva?.status]||'目前無法取得排版狀態。');
  const connection=results[0].status==='fulfilled'?results[0].value:null;
  row('日曆與預約',connection?.readiness?.calendar?'日曆連線資料已設定；實際行程要讀取後確認。預約修改與通知保留人工審核。':'日曆連線尚未就緒；不會自動更動預約。');
  const sync=snapshot?.sync||[];row('Notion 資料匯入',sync.some(s=>s.state==='failed')?'有來源讀取失敗，請在該專案重試。':sync.some(s=>s.last_success_at)?'已有成功匯入紀錄；最新狀態請看原專案。':'尚無成功同步紀錄。');
  activity.append(el('h4','最近的工作與結果'));
  const recent=tasks.filter(t=>['running','review','failed'].includes(t.status)).sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)).slice(0,5);
  if(!recent.length)activity.append(el('p','目前沒有正在處理或待查看的新結果。'));
  for(const task of recent){const button=el('button',task.title+'｜'+({running:'處理中',review:'查看整理',failed:'查看問題'})[task.status]);button.type='button';button.onclick=()=>onTask(task);activity.append(button);}
  refresh.disabled=false;status.textContent='最後更新：'+now().toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'});
 }
 refresh.onclick=()=>void load();return {load,dispose(){disposed=true;generation++;host.replaceChildren();}};
}
