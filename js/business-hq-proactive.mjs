export function mountProactiveHQ(invoke){
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const root=el('section'),settings=el('details'),reportArea=el('section');
 const status=el('p');status.setAttribute('role','status');
 const form=el('form');form.className='hq-fields';
 const fields={};
 for(const [name,label,type,max,value] of [
  ['positioning','HANA 服務定位','textarea',1000,''],['ideal_customer','目標客戶輪廓（ICP）','textarea',1000,''],
  ['offer','可提供的合作服務','textarea',600,''],['district','桃園搜尋行政區（留空為全市）','text',30,''],
  ['signals','可查核的合作訊號（以逗號分隔）','text',240,''],
  ['daily_limit','每日新增商機上限','number',0,'3'],['run_at','每日執行時間（台北）','time',0,'08:00'],
  ['enabled','此 ICP 可供正式排程使用','checkbox',0,''],
 ]){
  const caption=el('label',label),field=el(type==='textarea'?'textarea':'input');
  if(type!=='textarea')field.type=type;
  if(max)field.maxLength=max;
  if(type==='number'){field.min='1';field.max='5';}
  if(!['district','enabled'].includes(name))field.required=true;
  field.value=value;fields[name]=field;caption.append(field);form.append(caption);
 }
 const save=el('button','儲存服務定位與 ICP');save.type='submit';save.disabled=true;form.append(save);
 settings.append(el('summary','服務定位、目標客戶與排程'),el('p','初版研究範圍為桃園旅宿與官方觀光消息。合作訊號可填公開可驗證的服務，例如「會議、親子體驗」。'),form);
 const update=el('button','更新每日報告');update.type='button';update.onclick=()=>void load(false);
 root.append(el('h3','每日商務開發'),status,settings,update,reportArea);
 const time=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
 const addLink=(parent,title,value)=>{
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return;const link=el('a',title);link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';parent.append(link);}catch{/* Unusable links are omitted. */}
 };
 function render(data,loadFields){
  const profile=data.profile;
  if(loadFields&&profile)for(const [name,field] of Object.entries(fields)){
   if(name==='enabled')field.checked=profile[name]===true;
   else field.value=name==='run_at'?profile.run_at.slice(0,5):profile[name]??'';
  }
  save.disabled=false;
  status.textContent=!data.scheduler_available?'排程服務尚未啟用。可先儲存 ICP。':profile?.enabled?'研究時間每日 '+profile.run_at.slice(0,5)+'（台北），實際執行請查看下方紀錄。':'排程服務已啟用，ICP 尚未啟用。';
  reportArea.replaceChildren(el('h4','每日研究報告'));
  if(!data.runs.length)reportArea.append(el('p','尚未有排程執行紀錄。'));
  for(const run of data.runs){
   const report=run.report||{},detail=el('details');
   const labels={running:'執行中',completed:'已完成',partial:'部分完成',failed:'失敗'};
   detail.append(el('summary',run.local_day+'｜'+labels[run.status]+'｜新增 '+(report.saved?.length||0)+' 筆'));
   detail.append(el('p','排定 '+time(run.scheduled_for)+'｜開始 '+time(run.started_at)+'｜結束 '+time(run.finished_at)));
   detail.append(el('p','掃描 '+(report.records_scanned??'—')+' 筆｜查核 '+(report.verified??'—')+' 筆｜略過已存在 '+((report.known_skipped||0)+(report.duplicates_at_save||0))+' 筆'));
   if(report.attribution)detail.append(el('p',report.attribution));
   for(const url of report.source_urls||[]){const row=el('p');addLink(row,'資料來源',url);detail.append(row);}
   if(report.analysis_mode)detail.append(el('p',report.analysis_mode==='assisted'?'本次使用生成式分析':'本次依公開證據及 ICP 訊號評估'));
   for(const company of report.saved||[]){const row=el('p',company.development_rank+'. '+company.company_name+'｜'+company.fit_score+'/10　');addLink(row,'開啟來源',company.source_url);detail.append(row);}
   for(const news of report.market||[]){const row=el('p',news.published+'　');addLink(row,news.title,news.url);detail.append(row);}
   for(const error of report.errors||[])detail.append(el('p','失敗原因｜'+(typeof error==='string'?error:[error.step,error.code].filter(Boolean).join('・'))));
   reportArea.append(detail);
  }
 }
 async function load(loadFields=true){
  try{render(await invoke({action:'hq_profile'}),loadFields);}
  catch{status.textContent='每日研究的設定與報告暫時無法讀取。';}
 }
 form.onsubmit=async event=>{
  event.preventDefault();save.disabled=true;
  const profile=Object.fromEntries(Object.entries(fields).map(([name,field])=>[name,field.type==='checkbox'?field.checked:field.type==='number'?field.valueAsNumber:field.value]));
  try{render(await invoke({action:'hq_profile_save',profile}),true);status.append(' 已儲存。');}
  catch{status.textContent='設定尚未儲存。請核對時間、每日上限，以及至少一個兩字以上的合作訊號。';}
  finally{save.disabled=false;}
 };
 return {root,load};
}
