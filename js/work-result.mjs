// Render old and new outputs as useful summaries. Never render task JSON as a deliverable.
export function readableResult(raw){
 const text=typeof raw==='string'?raw:'';
 const start=text.indexOf('{');let data=null;
 if(start>=0&&text.length<=500000){try{data=JSON.parse(text.slice(start));}catch{}}
 if(data?.action==='work_intake_plan_v1')return {kind:'plan',data};
 if(data?.action==='verified_task_analysis')return {kind:'summary',data:{completed:['已核對目前專案工作狀態'],steps:(data.summary?.top3||[]).slice(0,3).map(t=>String(t.title||'未命名工作').slice(0,140)),questions:['這份舊紀錄只有進度核對，尚未整理照片或製作設計。']}};
 if(data?.action==='source_and_version_comparison')return {kind:'summary',data:{completed:['已比對 '+Number(data.sourceCount||0)+' 份來源紀錄'],steps:(data.historyDraft||[]).slice(0,8).map(x=>String(x.quote||'').slice(0,600)),questions:data.historyChecks?.requiresHumanVerification||['史料仍待核對']}};
 if(data?.action==='scope_and_design_spec_check')return {kind:'summary',data:{completed:['已整理設計需求清單'],steps:(data.deliverableTasks||[]).slice(0,20).map(t=>String(t.title||'').slice(0,140)),questions:[...(data.requirements||[]),data.toolExecution||'尚未產生設計成品']}};
 if(start>=0)return {kind:'unknown',data:{completed:[],steps:[],questions:['這份是舊的系統紀錄，未包含可直接查看的照片或設計成果。請以本次需求重新整理。']}};
 return {kind:'text',text:text.slice(0,16000)||'尚無整理成果。'};
}
export function renderWorkResult(raw,{openFile}={}){
 const out=document.createElement('div');out.className='work-result';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
 const view=readableResult(raw);if(view.kind==='text'){const p=el('p',view.text);p.style.whiteSpace='pre-wrap';out.append(p);return out;}
 const d=view.data;
 if(d.request)out.append(el('h4','你交辦的事'),el('p',d.request));
 const section=(title,rows)=>{if(!rows?.length)return;out.append(el('h4',title));const list=el('ul');for(const row of rows)list.append(el('li',row));out.append(list);};
 section('已整理',d.completed);
 if(d.materials?.length){out.append(el('h4','收到的素材'));for(const file of d.materials){const row=el('div');row.className='work-material';row.append(el('strong',file.name),el('p',file.category+'｜'+file.reading));if(openFile&&file.path){const button=el('button','查看原檔');button.type='button';button.onclick=()=>openFile(file);row.append(button);}out.append(row);}}
 if(d.links?.length){out.append(el('h4','素材連結'));for(const item of d.links){let u;try{u=new URL(item.url);}catch{continue;}if(u.protocol!=='https:'||u.username||u.password)continue;const a=el('a',u.hostname+'｜'+item.status);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';out.append(a);}}
  section('文件中的重點（原文片段，待確認）',(d.sourcePoints||[]).map(p=>p.quote+'（'+p.source+'）'));
 section('接下來的工作',d.steps);section('需要你確認或補充',d.questions);
 if(d.limits)out.append(el('p',d.limits));
 return out;
}
