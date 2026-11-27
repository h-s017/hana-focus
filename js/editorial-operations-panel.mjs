const kindNames={sensory:'今日嗅覺微課',service_marketing:'服務推廣文章',founder_story:'每日創業者限動'};
const stateNames={scheduled:'已排程',running:'執行中',partial:'部分完成',blocked:'受阻',failed:'失敗',ready_for_review:'可審核',approved:'已核准',revision_required:'待修改',published:'已發布'};
const missingNames={verified_original_png:'原始攝影 PNG',story_composite:'9:16 完整限動 PNG',verified_alt_text:'照片替代文字',verified_canva_design:'可編輯 Canva 設計',visual_quality_review:'實際視覺品質查驗',service_source:'官網服務來源驗證'};
const time=value=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function mountEditorialOperations(invoke){
 const el=(tag,value)=>{const item=document.createElement(tag);if(value)item.textContent=value;return item;};
 const section=el('section');section.style.overflowWrap='anywhere';
 const status=el('p'),cards=el('div'),history=el('details');status.setAttribute('role','status');
 const button=(label,fn)=>{const tag=el('button',label);tag.type='button';tag.onclick=fn;return tag;};
 const refresh=button('更新營運成果',()=>void load());
 section.append(el('h2','每日營運審核'),status,refresh,cards,history);
 let sequence=0,visible=false;
 function link(label,url,hosts){
  try{
   const value=new URL(url);
   if(value.protocol!=='https:'||!hosts.includes(value.hostname)||value.username||value.password)return null;
   const anchor=el('a',label);anchor.href=value.href;anchor.target='_blank';anchor.rel='noopener noreferrer';return anchor;
  }catch{return null;}
 }
 function renderEdition(row,active){
  const details=el('details');details.append(el('summary',row.local_day+'｜'+(row.payload?.title||kindNames[row.kind])+'｜'+stateNames[row.state]+'・v'+row.version));
  const p=row.payload||{},e=row.evidence||{};
  for(const [label,value] of [['教學／內容目標',p.objective],['受眾',p.audience],['SEO 標題',p.seo_title],['SEO 摘要',p.seo_description],['文章／限動文字',p.body],['IG 文案',p.caption||p.instagram_caption],['Facebook 文案',p.facebook_caption],['行動引導',p.cta]])if(value){const content=el('p',label+'｜'+value);content.style.whiteSpace='pre-wrap';details.append(content);}
  if(p.visuals?.palette)details.append(el('p','色票｜'+p.visuals.palette.join('、')));
  for(const page of p.pages||[])details.append(el('h4',page.section+'｜'+page.title),el('p',page.body));
  if(p.reels?.status==='storyboard_only'){
   const reels=el('details');
   reels.append(el('summary','Reels 分鏡草稿｜'+p.reels.durationSeconds+' 秒'),el('p',p.reels.recordingRights));
   for(const scene of p.reels.scenes||[])reels.append(el('p',scene.startSeconds+'–'+scene.endSeconds+' 秒｜'+scene.caption));
   details.append(reels);
  }
  if(p.music)details.append(el('p','古典聆賞｜'+p.music.composer+' — '+p.music.work),el('p',p.music.recording_rights));
  if(p.hashtags?.length)details.append(el('p',p.hashtags.join(' ')));
  const edit=link('開啟已核實的 Canva 編輯稿',e.canva?.editUrl,['www.canva.com']);if(edit)details.append(edit);
  const service=link('核對 HANA 官網入口',e.service_url,['hanascent.com']);if(service)details.append(service);
  for(const asset of e.mediaReceipts||[]){
   const name=asset.slot==='story'?'完整限動':'照片 '+asset.slot.replace('photo-','');
   const preview=el('div'),previewStatus=el('p');previewStatus.setAttribute('role','status');
   const show=button('預覽 '+name,async event=>{
    const trigger=event.currentTarget;
    if(preview.childElementCount){preview.replaceChildren();return;}
    trigger.disabled=true;previewStatus.textContent='正在讀取私有素材…';
    try{
     const result=await invoke({action:'editorial_asset',workspace:'work',id:row.id,slot:asset.slot});
     const signed=link('開啟原始 PNG',result.url,['ihmvziqisputjnjkuhvm.supabase.co']);
     if(!signed)throw Error('editorial_media_invalid_url');
     const img=el('img');
     img.alt=name;img.width=asset.width;img.height=asset.height;img.style.cssText='max-width:100%;height:auto';
     img.referrerPolicy='no-referrer';signed.referrerPolicy='no-referrer';img.src=signed.href;
     img.onerror=()=>{preview.replaceChildren();previewStatus.textContent='圖片讀取失敗，請重新預覽。';};
     preview.append(img,signed);previewStatus.textContent='';
    }catch{previewStatus.textContent='無法讀取私有素材，請稍後重試。';}
    finally{trigger.disabled=false;}
   });
   details.append(show,previewStatus,preview);
  }
  if(e.mediaReadFailures?.length)details.append(el('p','素材讀取失敗｜'+e.mediaReadFailures.join('、')));
  if(row.missing?.length)details.append(el('p','缺件｜'+row.missing.map(key=>missingNames[key]||key).join('、')));
  if(row.error_code)details.append(el('p','失敗原因｜'+row.error_code));
  details.append(el('p','執行｜'+time(row.started_at)+' → '+time(row.finished_at)),el('p','紀錄 ID '+row.id));
  if(row.reviewed_at)details.append(el('p','審核｜'+time(row.reviewed_at)+' '+(row.review_note||'')));
  if(active&&['ready_for_review','partial','blocked','failed','revision_required'].includes(row.state)){
   const note=el('textarea');note.rows=2;note.maxLength=2000;note.setAttribute('aria-label','審核意見 '+(p.title||kindNames[row.kind]));details.append(note);
   const actions=row.state==='ready_for_review'?[['核准','approve'],['退回修改','revise']]:[[row.state==='revision_required'?'重新生成':'排入重試','retry']];
   for(const [label,decision] of actions)details.append(button(label,async event=>{
    event.currentTarget.disabled=true;
    try{await invoke({action:'editorial_decide',workspace:'work',id:row.id,decision,note:note.value});await load();}
    catch{status.textContent='操作尚未確認，請更新並檢查版本。';}
    finally{if(event.target instanceof HTMLButtonElement)event.target.disabled=false;}
   }));
  }
  return details;
 }
 async function load(){
  if(!visible)return;
  const id=++sequence;status.textContent='正在讀取執行與審核紀錄…';
  const [editorial,biz]=await Promise.allSettled([invoke({action:'editorial_snapshot',workspace:'work'}),invoke({action:'hq_snapshot',workspace:'work'})]);
  if(id!==sequence||!visible)return;
  cards.replaceChildren();history.replaceChildren(el('summary','歷史版本與執行紀錄'));
  const rows=editorial.status==='fulfilled'&&Array.isArray(editorial.value.entries)?editorial.value.entries:null;
  status.textContent=rows?'已讀取 HANA FOCUS 審核紀錄。':'內容審核資料尚未接通。';
  const newest=new Map();for(const row of rows||[]){const key=row.local_day+':'+row.kind;if(!newest.has(key))newest.set(key,row);}
  for(const [kind,label] of Object.entries(kindNames)){
   const block=el('section');block.append(el('h3',label));
   const current=kind==='service_marketing'?[...newest.values()].find(row=>row.kind===kind):newest.get(date()+':'+kind);
   block.append(current?renderEdition(current,true):el('p','尚無可讀取的成果。'));cards.append(block);
  }
  const prospects=el('section');prospects.append(el('h3','今日商機'));
  const candidates=biz.status==='fulfilled'&&Array.isArray(biz.value?.opportunities)?biz.value.opportunities.filter(row=>row.created_at&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date(row.created_at))===date()):[];
  for(const lead of candidates.slice(0,5)){
   const body=el('details');body.append(el('summary',lead.company_name+'｜'+(lead.fit_score??'待評估')),el('p',lead.fit_reason),el('p',lead.draft));
   try{const source=new URL(lead.source_url);if(source.protocol==='https:')body.append(link('開啟原始證據',source.href,[source.hostname])||el('span'));}catch{}
   prospects.append(body);
  }
  if(!candidates.length)prospects.append(el('p','尚無已確認的今日商機。'));
  const crm=el('a','在 Business HQ 審核商機');crm.href='#business-hq';prospects.append(crm);cards.append(prospects);
  for(const row of rows||[])history.append(renderEdition(row,false));
 }
 return {element:section,setVisible(value){if(visible===value)return;visible=value;section.hidden=!visible;if(visible)void load();else{sequence++;cards.replaceChildren();history.replaceChildren();}},dispose(){visible=false;sequence++;section.remove();}};
}
