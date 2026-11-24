// HANA BUSINESS HQ is part of the existing signed-in composer, not another board.
import {taipeiInput} from './calendar-sync-app.mjs';
const labels={'corporate-strategy':'企業策略','operations-management':'營運管理','sales-marketing':'業務與行銷','people-management':'人才與合作','research-development':'研究與開發','financial-management':'財務管理','business-systemization':'經營系統化'};
const stages={identified:'已識別・待查核',qualified:'已篩選',proposal_draft:'提案草稿',approved:'內部核准・未聯絡',contacted:'已聯絡・人工紀錄',negotiating:'洽談中',won:'成交・人工紀錄',lost:'未成交・人工紀錄'};
const messages={hq_invalid_input:'請填寫工作目標、產業、區域、服務及1–10的數量上限，並核對每行公司格式。',hq_invalid_source:'來源須為公司公開 HTTPS 網址，且與官網同網域。',hq_manual_record_required:'請確認已實際聯絡，並填寫至少10字的人工紀錄。',hq_setup_required:'商務服務或資料庫尚未接通。',hq_work_only:'商務資料僅限 HANA WORK。',hq_request_conflict:'這個要求的內容或技能版本已改變，請建立新要求。',hq_persistence_uncertain:'保存結果尚未確認。請保持原要求重試，或更新紀錄核對；不會重複建立。',hq_state_conflict:'紀錄已改變，請更新後再試。',hq_source_unavailable:'來源工具尚未接通，人工內容仍未查核。',hq_database_unavailable:'資料庫未能確認成功，請更新並核對原要求。'};
export function exportOpportunities(rows){
 const cell=s=>'"'+String(s??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';
 const keys=['company_name','website','canonical_domain','source_url','source_checked_at','evidence_excerpt_or_summary','fit_score','fit_reason','stage','next_followup_at','draft'];
 return '\uFEFF'+keys.map(cell).join(',')+'\r\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\r\n')+'\r\n';
}
export function mountBusinessHQ(host,{db,owner,form,titleInput,briefInput,onModeChange=()=>{}}){
 let active=false,workspace='work',view='work',disposed=false,busy=false,epoch=0,snapshot={opportunities:[],runs:[],reviews:[]},catalogue=null,request=null,generalDraft=null,businessDraft=null;
 let searching=false,searchVersion=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const notice=el('p');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const heading=el('h2','HANA BUSINESS HQ｜企業經營總部'),intro=el('p','尋找潛在合作公司，核對公開來源，再把值得跟進的商機與提案交由 HANA 審核。');
 const skills=el('ul');skills.className='hq-skills';const results=el('div');results.className='hq-results';
 const mode=el('select');mode.name='hq_skill';mode.setAttribute('aria-label','處理方式');const ordinary=el('option','一般專案工作');ordinary.value='project-work';mode.append(ordinary);
 for(const [id,label] of Object.entries(labels)){const option=el('option',label+(id==='sales-marketing'?'｜B2B 商務開發':'｜尚未接入'));option.value=id;option.disabled=id!=='sales-marketing';mode.append(option);}
 const modeLabel=el('label','處理方式');modeLabel.append(mode);form.prepend(modeLabel);
 const fields=el('fieldset');fields.className='hq-fields';fields.hidden=true;fields.disabled=true;
 const field=(label,name,type='text',max=100)=>{const l=el('label',label),n=el(type==='textarea'?'textarea':'input');n.name=name;if(type!=='textarea')n.type=type;n.maxLength=max;n.setAttribute('aria-label',label);l.append(n);fields.append(l);return n;};
 const industry=field('產業','hq_industry'),region=field('區域','hq_region'),services=field('希望提供的服務','hq_services','textarea',1000),limit=field('數量上限（1–10）','hq_limit','number');limit.min='1';limit.max='10';limit.value='5';
 const discovery=el('section');discovery.className='hq-discovery';
 const findButton=button('尋找商機',()=>void discover());
 const discoveryStatus=el('p');discoveryStatus.setAttribute('role','status');
 const suggestions=el('ul');
 discovery.append(findButton,discoveryStatus,suggestions);fields.append(discovery);
 const companies=field('公司來源（每行：公司名稱 | 官網 | 來源網址）','hq_companies','textarea',16000);companies.rows=4;
 const excerpt=field('人工補充的來源內容（未查核）','hq_excerpt','textarea',4000);excerpt.rows=3;
 fields.append(el('p','送出建檔前，請核對公司名稱和官網。網頁查核使用已授權的網域，人工補充內容會標示為未查核。'));
 form.append(fields);
 function download(content,name,mime){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function invoke(body){const {data,error}=await db.functions.invoke('hana-automation',{body:{...body,workspace:'work'}});let code=data?.error;try{if(!code&&error)code=(await error.context?.json())?.error;}catch{}if(error||code)throw Object.assign(Error(code||'hq_persistence_uncertain'),{code:code||'hq_persistence_uncertain'});return data;}
 const workVisible=()=>workspace==='work'&&['business-hq','work','agents'].includes(view);
 const pendingKey='hana-hq-request:'+owner;
 const searchFields=[industry,region,services,limit];
 function updateDiscovery(){
  const ready=catalogue?.research?.discovery===true;
  findButton.disabled=searching||!ready;
  if(!ready&&!searching)discoveryStatus.textContent=catalogue?'搜尋服務尚未啟用。你仍可填寫公司來源。':'正在確認搜尋服務設定…';
  else if(ready&&!searching&&!discoveryStatus.textContent)discoveryStatus.textContent='以產業和區域搜尋公開來源。選入的公司會先加入下方表單。';
 }
 function clearDiscovery(){searchVersion++;suggestions.replaceChildren();discoveryStatus.textContent='';updateDiscovery();}
 for(const input of searchFields)input.addEventListener('input',clearDiscovery);
 updateDiscovery();
 function selectCandidate(candidate){
  const rows=companies.value.split('\n').filter(row=>row.trim());
  const known=rows.some(row=>{
   try{return new URL(row.split(/[|｜]/)[1]?.trim()).hostname.toLowerCase().replace(/^www\./,'')===candidate.canonical_domain;}
   catch{return false;}
  });
  if(known){discoveryStatus.textContent='這個網域已在本次表單。';return;}
  if(rows.length>=Number(limit.value)){discoveryStatus.textContent='已達本次數量上限。可先移除一家公司，再選入。';return;}
  const source=candidate.source_url.replaceAll('|','%7C').replaceAll('｜','%EF%BD%9C');
  rows.push([candidate.company_name,candidate.website,source].join(' | '));
  companies.value=rows.join('\n');
  discoveryStatus.textContent='已把「'+candidate.company_name+'」加入表單。核對名稱及官網後再送出。';
 }
 async function discover(){
  if(searching||disposed||!active||!workVisible()||!catalogue?.research?.discovery)return;
  for(const input of searchFields)if(!input.value.trim()||!input.reportValidity()){
   discoveryStatus.textContent='請填寫產業、區域、希望提供的服務及數量上限。';input.focus();return;
  }
  searching=true;const version=++searchVersion;suggestions.replaceChildren();
  discoveryStatus.textContent='正在搜尋公開來源…';updateDiscovery();
  try{
   const criteria={industry:industry.value,region:region.value,services:services.value,limit:Number(limit.value)};
   const value=await invoke({action:'hq_discover',criteria});
   if(disposed||version!==searchVersion||!active||!workVisible())return;
   if(!Array.isArray(value?.candidates))throw Error('Invalid search response');
   for(const candidate of value.candidates){
    const item=el('li');item.className='hq-opportunity';
    item.append(el('h4',candidate.company_name),el('p',candidate.reason),el('p',candidate.approach));
    if(candidate.excerpt)item.append(el('p',candidate.excerpt));
    try{
     const url=new URL(candidate.source_url);
     if(url.protocol!=='https:'||url.username||url.password)continue;
     const link=el('a',candidate.source_title);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
    }catch{continue;}
    item.append(el('p','待確認公司名稱、官網及合作需求。'+(candidate.source_check_available?'可在送出後查核來源。':'此網域尚未授權自動查核。')),button('加入公司來源',()=>selectCandidate(candidate)));
    suggestions.append(item);
   }
   discoveryStatus.textContent=suggestions.children.length?'找到 '+suggestions.children.length+' 筆待查核候選。':'沒有找到新的候選公司。可縮小或調整產業和區域。';
  }catch(error){
   if(!disposed&&version===searchVersion&&active&&workVisible())discoveryStatus.textContent=error.code==='hq_discovery_rate_limited'?'搜尋已達服務上限，請稍後再試。':error.code==='hq_discovery_not_configured'?'搜尋服務尚未啟用。':'搜尋暫時無法完成，原表單與商機紀錄已保留。';
  }finally{searching=false;if(!disposed)updateDiscovery();}
 }
 function render(){
  if(disposed||!workVisible())return;
  skills.replaceChildren();for(const [id,label] of Object.entries(labels)){const record=catalogue?.skills?.find(s=>s.id===id);skills.append(el('li',label+'｜'+(record?.status==='available'?'已接入・v'+record.version:record?'尚未接入':'連線待確認')));}
  results.replaceChildren();results.append(el('h3','商機與提案'),el('p','所有提案是規則式草稿；核准不會自動寄送，也不會變成「已聯絡」。'));
  const bar=el('div');bar.className='hq-actions';bar.append(button('更新商務紀錄',()=>void operate(refresh)),button('建立新的商務要求',()=>{request=null;try{sessionStorage.removeItem(pendingKey);}catch{}notice.textContent='下次送出會建立新要求；既有商機仍依網域去重。';}),button('匯出有來源商機 CSV',()=>download(exportOpportunities(snapshot.opportunities.filter(o=>o.source_checked_at)),'hana-business-opportunities.csv','text/csv;charset=utf-8')),button('匯出商機與提案 JSON',()=>download(JSON.stringify(snapshot,null,2),'hana-business-review.json','application/json;charset=utf-8')));results.append(bar);
  if(!snapshot.opportunities.length)results.append(el('p','目前沒有商機紀錄。填寫商機開發需求與公司來源，即可建立第一筆。'));
  for(const o of snapshot.opportunities){
   const card=el('article');card.className='hq-opportunity';card.append(el('h4',o.company_name),el('p',stages[o.stage]||o.stage),el('p','適配度：'+(o.fit_score===null?'待查核':o.fit_score+'/10')+'｜'+o.fit_reason));
   if(o.source_url){const a=el('a','開啟公司來源');try{const u=new URL(o.source_url);if(u.protocol==='https:'){a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}
   card.append(el('p','查核時間：'+(o.source_checked_at?new Date(o.source_checked_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未由工具查核')));
   const evidence=el('details');evidence.append(el('summary','查看證據與缺漏'),el('p',o.evidence_excerpt_or_summary||'沒有已取得的來源內容。'));card.append(evidence);
   if(o.draft){const d=el('details');d.append(el('summary','查看規則式提案草稿'),el('pre',o.draft));card.append(d);}
   const next=el('input');next.type='datetime-local';next.value=taipeiInput(o.next_followup_at);next.setAttribute('aria-label','下次追蹤：'+o.company_name);
   card.append(el('p','下次追蹤（台北時間，只保存日期，不建立排程通知）'),next,button('儲存追蹤日期',()=>void operate(async()=>{await invoke({action:'hq_followup',opportunity_id:o.id,revision:o.revision,next_followup_at:next.value?new Date(next.value+'+08:00').toISOString():null});await refresh();})));
   if(['approved','contacted','negotiating'].includes(o.stage)){
    const log=el('details');log.append(el('summary','記錄已實際發生的商務進展'));
    const stage=el('select');stage.setAttribute('aria-label','商務進展：'+o.company_name);for(const s of o.stage==='approved'?['contacted']:['negotiating','won','lost']){const opt=el('option',stages[s]);opt.value=s;stage.append(opt);}
    const note=el('textarea');note.maxLength=2000;note.placeholder='實際日期、聯絡管道與結果（至少10字）';note.setAttribute('aria-label','人工聯絡紀錄：'+o.company_name);const confirmed=el('input');confirmed.type='checkbox';const l=el('label','確認這是我已實際完成的聯絡或進展');l.prepend(confirmed);
    log.append(stage,note,l,button('保存人工紀錄',()=>void operate(async()=>{if(!confirmed.checked||note.value.trim().length<10)throw Object.assign(Error(),{code:'hq_manual_record_required'});await invoke({action:'hq_track',opportunity_id:o.id,revision:o.revision,stage:stage.value,note:note.value,manual_confirmation:true});await refresh();})));card.append(log);
   }
   results.append(card);
  }
  const runs=el('section');runs.append(el('h3','執行與審核'));
  for(const r of snapshot.runs){
   const card=el('article');card.className='hq-run';card.append(el('h4',r.skill_input?.goal||'技能工作'),el('p','狀態：'+({blocked:'受阻',failed:'失敗',running:'執行中',review:'待 HANA 審核',approved:'內部核准・未寄送',rejected:'已退回'}[r.skill_state]||r.skill_state)),el('p',r.skill_id+'｜版本 '+r.skill_version+'｜嘗試 '+r.skill_attempt));
   if(r.skill_error_code)card.append(el('p','原因：'+r.skill_error_code));for(const b of r.skill_output?.blockers||[])card.append(el('p',b));
   const details=el('details');details.append(el('summary','來源、工具與版本紀錄'),el('p','內容 SHA-256：'+r.skill_hash),el('p','技能來源：'+r.skill_source));for(const t of r.skill_tool_results||[])details.append(el('p',t.tool+'｜'+(t.status||'')+'｜'+(t.url||t.error_code||t.version||'')));card.append(details);
   if(['blocked','failed','rejected','running'].includes(r.skill_state)&&r.skill_attempt<5)card.append(button(r.skill_state==='running'?'超過5分鐘後恢復執行':'補齊來源或連線後重試',()=>void operate(async()=>{await invoke({action:'hq_run',skill_id:r.skill_id,request_id:r.request_id,input:r.skill_input,retry:true});await refresh();})));
   if(r.skill_state==='review'){
    const note=el('textarea');note.maxLength=2000;note.setAttribute('aria-label','審核意見：'+r.skill_input.goal);card.append(note);
    for(const decision of ['approved','rejected'])card.append(button(decision==='approved'?'核准這批內部草稿':'退回這批草稿',()=>void operate(async()=>{if(!confirm('只記錄 HANA 內部審核，不會聯絡客戶或發布。'))return;await invoke({action:'hq_review',run_id:r.id,decision,note:note.value});await refresh();})));
   }
   for(const v of snapshot.reviews.filter(v=>v.task_id===r.task_id))card.append(el('p',new Date(v.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'｜'+v.decision+'｜'+(v.note||'')));
   runs.append(card);
  }
  results.append(runs);
 }
 async function refresh(){const version=epoch;if(!workVisible())return;const value=await invoke({action:'hq_snapshot'});if(!value||!['opportunities','runs','reviews'].every(k=>Array.isArray(value[k])))throw Object.assign(Error(),{code:'hq_setup_required'});if(disposed||version!==epoch||!workVisible())return;snapshot=value;render();}
 async function load(){if(!workVisible())return;const version=epoch;try{const c=await invoke({action:'hq_catalog'});if(disposed||version!==epoch||!workVisible())return;catalogue=c;discoveryStatus.textContent='';updateDiscovery();render();await refresh();notice.textContent=c.research.available?'可查核已授權的公開網址。':'來源工具尚未接通。可保存人工來源，但會標為受阻、未查核。';}catch(e){if(!disposed&&version===epoch){notice.textContent=messages[e.code]||'商務服務尚無法確認，原有工作仍保留。';render();}}}
 async function operate(fn){if(busy||disposed||!workVisible())return;busy=true;const v=epoch;for(const b of host.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(e){if(!disposed&&v===epoch)notice.textContent=messages[e.code]||'操作未確認成功，請更新紀錄並以原要求重試。';}finally{busy=false;if(!disposed&&v===epoch)for(const b of host.querySelectorAll('button'))b.disabled=false;}}
 function changeMode(){const next=mode.value==='sales-marketing'&&workspace==='work';if(next&&!active){generalDraft={title:titleInput.value,brief:briefInput.value};titleInput.value=businessDraft?.title||'';briefInput.value=businessDraft?.brief||'';}if(!next&&active){businessDraft={title:titleInput.value,brief:briefInput.value};titleInput.value=generalDraft?.title||'';briefInput.value=generalDraft?.brief||'';}active=next;fields.hidden=!active;fields.disabled=!active;for(const f of [industry,region,services,limit])f.required=active;results.hidden=!active||!workVisible();onModeChange(active);}
 mode.onchange=changeMode;
 const skillDetails=el('details');skillDetails.append(el('summary','七項專業技能與接入狀態'),skills);host.className='business-hq';host.append(heading,intro,skillDetails,notice);results.hidden=true;form.after(results);
 return {
  get active(){return active;},
  async submit(){
   if(!active||!workVisible())throw Object.assign(Error(),{code:'hq_work_only'});
   const input={workspace:'work',goal:titleInput.value.trim(),context:briefInput.value.trim(),industry:industry.value.trim(),region:region.value.trim(),services:services.value.trim(),limit:Number(limit.value),companies:companies.value.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>{const parts=s.split(/[|｜]/).map(x=>x.trim());return {company_name:parts[0],website:parts[1],source_url:parts[2]||null,manual_excerpt:excerpt.value};})};
   const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(input))))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(!request)try{request=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch{}
   if(!request||request.fingerprint!==fingerprint)request={fingerprint,id:crypto.randomUUID()};
   try{sessionStorage.setItem(pendingKey,JSON.stringify(request));}catch{}
   try{await invoke({action:'hq_run',skill_id:'sales-marketing',request_id:request.id,input});await refresh();notice.textContent='執行結果已保存，請查看查核狀態及待審核草稿。';}catch(e){notice.textContent=messages[e.code]||'保存尚未確認，請保留原內容重試。';throw e;}
  },
  setContext(w,v){
   const changed=w!==workspace||v!==view,wasDirect=view==='business-hq';
   workspace=w;view=v;
   if(changed&&!workVisible())clearDiscovery();
   const direct=view==='business-hq';
   host.hidden=!workVisible();modeLabel.hidden=w!=='work'||direct;
   if(w!=='work'){
    epoch++;mode.value='project-work';changeMode();snapshot={opportunities:[],runs:[],reviews:[]};results.replaceChildren();notice.textContent='';
   }else{
    const nextMode=direct?'sales-marketing':wasDirect?'project-work':mode.value;
    if(nextMode!==mode.value){mode.value=nextMode;changeMode();}
    if(changed&&workVisible())void load();
   }
   results.hidden=!active||!workVisible();onModeChange(active);
  },
  load,
  dispose(){disposed=true;epoch++;snapshot=null;request=null;businessDraft=generalDraft=null;try{sessionStorage.removeItem(pendingKey);}catch{}form.querySelector('[name=hq_skill]')?.closest('label')?.remove();fields.remove();results.remove();host.replaceChildren();}
 };
}
