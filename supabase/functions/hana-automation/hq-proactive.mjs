import {hqError,loadSkill} from './hq-registry.mjs';
import {publicUrl} from './hq-source.mjs';

const origin='https://travel.tycg.gov.tw';
const accommodation=origin+'/open-api/zh-tw/Shop/Accommodation';
const news=origin+'/open-api/zh-tw/Event/News';
const attribution='桃園市政府觀光旅遊局・桃園觀光導覽網 Open API';
const normalized=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const asList=value=>Array.isArray(value)?value:value?[value]:[];
const publicText=value=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

export function proactiveProfile(value){
 const fields={positioning:1000,ideal_customer:1000,offer:600,district:30,signals:240};
 const profile=Object.fromEntries(Object.entries(fields).map(([key,max])=>{
  const field=value?.[key];
  if(typeof field!=='string'||field.length>max||(!field.trim()&&key!=='district'))throw hqError('hq_invalid_input');
  return [key,field.trim()];
 }));
 if(!signalTerms(profile.signals).length||!Number.isInteger(value.daily_limit)||value.daily_limit<1||value.daily_limit>5||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.run_at)||typeof value.enabled!=='boolean')throw hqError('hq_invalid_input');
 return {...profile,daily_limit:value.daily_limit,run_at:value.run_at,enabled:value.enabled};
}

function signalTerms(value){return [...new Set(value.split(/[,，、\n]/).map(term=>term.trim()).filter(term=>term.length>=2))].slice(0,12);}

/** @param {{fetcher?:typeof fetch,now?:()=>Date}} [options] */
export function taoyuanResearch({fetcher=fetch,now=()=>new Date()}={}){
 async function read(url,type){
  const response=await fetcher(url,{headers:{Accept:type},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.headers.get('content-type')?.includes(type))throw hqError('provider_response_invalid');
  const reader=response.body?.getReader();
  if(!reader)throw hqError('provider_response_invalid');
  const decode=new TextDecoder();
  let value='',bytes=0;
  try{
   for(;;){
    const result=await reader.read();
    if(result.done)break;
    bytes+=result.value.length;
    if(bytes>2_000_000){await reader.cancel();throw hqError('provider_response_too_large');}
    value+=decode.decode(result.value,{stream:true});
   }
   return value+decode.decode();
  }finally{reader.releaseLock();}
 }
 async function list(url){
  const rows=JSON.parse(await read(url,'application/json')).Infos;
  if(!rows||typeof rows!=='object')throw hqError('provider_schema_invalid');
  return asList(rows.Info);
 }
 function detailUrl(id){return origin+'/zh-tw/accommodation/detail/'+id;}
 const providerError=error=>['AbortError','TimeoutError'].includes(error.name)?'provider_timeout':error.code||'provider_unavailable';
 return async (profile,known)=>{
  const page=1+Math.floor(now().getTime()/86400000)%6;
  const pages=[...new Set([1,2,page])];
  const reports=await Promise.allSettled([...pages.map(p=>list(accommodation+'?page='+p)),list(news+'?page=1')]);
  const newsResult=reports.pop();
  const report={provider:'taoyuan-tourism',attribution,source_urls:[...pages.map(p=>accommodation+'?page='+p),news+'?page=1'],records_scanned:0,qualified_for_verification:0,verified:0,known_skipped:0,market:[],errors:[],analysis_mode:'evidence_rules'};
  if(newsResult.status==='fulfilled')report.market=newsResult.value.filter(row=>/^\d+$/.test(row.Id)&&publicText(row.Name)&&row.Posted).slice(0,5).map(row=>({title:publicText(row.Name).slice(0,200),published:String(row.Posted).slice(0,30),url:origin+'/zh-tw/event/news/'+row.Id}));
  else report.errors.push({step:'market_news',code:providerError(newsResult.reason)});
  const rows=new Map();
  reports.forEach((result,index)=>{
   if(result.status==='rejected'){report.errors.push({step:'business_search',page:pages[index],code:providerError(result.reason)});return;}
   for(const row of result.value)if(/^\d+$/.test(row.Id))rows.set(String(row.Id),row);
  });
  report.records_scanned=rows.size;
  const signals=signalTerms(profile.signals);
  const existingRecords=new Set(known.map(x=>x.record));
  const existingKeys=new Set(known.map(x=>x.domain+'|'+x.branch));
  const ranked=[];
  for(const [id,row] of rows){
   if(profile.district&&!normalized(publicText(row.District)).includes(normalized(profile.district)))continue;
   const description=publicText(row.Description);
   const matches=signals.filter(term=>normalized(description).includes(normalized(term)));
   if(!matches.length||description.length<20)continue;
   const record_id='taoyuan-accommodation:'+id,source_url=detailUrl(id);
   let website=source_url;
   for(const link of asList(row.Links?.Link)){
    if(link.Subject!=='官方網站')continue;
    try{const u=publicUrl(link.Src);if(!/(^|\.)(facebook\.com|instagram\.com|line\.me|booking\.com|agoda\.com)$/.test(u.domain)){website=u.url;break;}}catch{/* The government detail remains the verified listing. */}
   }
   const domain=publicUrl(website).domain,branch=website===source_url?record_id:'';
   if(existingRecords.has(record_id)||existingKeys.has(domain+'|')||existingKeys.has(domain+'|'+branch)){report.known_skipped++;continue;}
   ranked.push({id,row,description,matches,record_id,source_url,website,domain,branch});
  }
  ranked.sort((a,b)=>b.matches.length-a.matches.length||Number(Boolean(b.row.Registrations))-Number(Boolean(a.row.Registrations))||Number(a.id)-Number(b.id));
  report.qualified_for_verification=ranked.length;
  const checks=await Promise.allSettled(ranked.slice(0,Math.min(10,profile.daily_limit+4)).map(async item=>{
   const html=await read(item.source_url,'text/html');
   const meta=html.match(/<meta\s+property=["']?og:title["']?\s+content=(?:"([^"]+)"|'([^']+)'|([^\s>]+))\s*\/?\s*>/i);
   const company_name=publicText(meta?.[1]||meta?.[2]||meta?.[3]).replace(/&amp;/g,'&');
   if(company_name.length<2||company_name.length>140||company_name==='桃園觀光導覽網')throw hqError('company_name_unconfirmed');
   const {row,matches}=item,district=publicText(row.District),registration=publicText(row.Registrations?.Registration);
   const excerpts=matches.slice(0,4).map(term=>{
    const index=item.description.indexOf(term);
    return index<0?item.description.slice(0,240):item.description.slice(Math.max(0,index-65),index+term.length+115);
   });
   const excerpt=excerpts.join(' … ').slice(0,900);
   const checked_at=now().toISOString();
   const source={url:item.source_url,checked_at,excerpt,record_id:item.record_id,attribution,verified:true,company_name_confirmed:true,
    content_hash:await digest(JSON.stringify({company_name,district,registration,description:item.description}))};
   const score_components={mode:'daily_research',location:2,official_evidence:registration?3:2,documented_signals:Math.min(5,2+matches.length)};
   const fit_score=score_components.location+score_components.official_evidence+score_components.documented_signals;
   const feature=matches[0];
   const draft=`合作提案草稿｜待 HANA 審核\n對象：${company_name}（${district}）\n公開背景：${excerpt}\n建議試點：依 HANA 服務定位「${profile.positioning}」，評估把「${profile.offer}」結合公開介紹提到的「${feature}」。\n訪談問題：對方目前如何安排「${feature}」相關體驗？客群是否符合「${profile.ideal_customer}」，有無合適場地和試辦時段？\n需求、預算及合作意願待訪談，尚未聯絡。`;
   return {company_name,website:item.website,canonical_domain:item.domain,branch_key:item.branch,branch_reason:item.branch?'桃園市政府公開旅宿登錄編號':'',source_url:item.source_url,source_checked_at:checked_at,
    evidence:[source],evidence_excerpt_or_summary:excerpt,public_business_contact:null,stage:'proposal_draft',fit_score,score_components,
    fit_reason:`桃園市政府旅宿資料｜${district}；可核對的服務訊號：${matches.join('、')}。`,draft};
  }));
  const verified=[];
  for(const [index,result] of checks.entries()){
   if(result.status==='fulfilled')verified.push(result.value);
   else report.errors.push({step:'source_verification',url:ranked[index].source_url,code:providerError(result.reason)});
  }
  report.verified=verified.length;
  const unique=new Map();
  verified.sort((a,b)=>b.fit_score-a.fit_score).forEach(row=>{const key=row.canonical_domain+'|'+row.branch_key;if(!unique.has(key))unique.set(key,row);});
  const candidates=[...unique.values()].slice(0,profile.daily_limit);
  const status=reports.every(result=>result.status==='rejected')?'failed':report.errors.length?'partial':'completed';
  return {status,report,candidates};
 };
}

/** @typedef {ReturnType<typeof import('./hq-analysis.mjs').businessAnalysis>} Analysis */
export function proactiveHQ({store,research,owner,enabled,secret,analyze=/** @type {Analysis} */ (null)}){
 const ready=enabled&&Boolean(owner)&&secret.length>=32;
 async function account(user,body){
  const state=await store.hqProfile(user,body.action==='hq_profile_save'?proactiveProfile(body.profile):null);
  return {...state,scheduler_available:ready&&user===owner,scheduled_generation:analyze?'assisted':'evidence_rules'};
 }
 async function worker(req){
  const respond=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
  const incoming=req.headers.get('x-hana-hq-worker')||'';
  if(!ready||incoming.length!==secret.length)return respond({error:'unauthorized'},401);
  const [a,b]=await Promise.all([digest(incoming),digest(secret)]);
  let difference=0;
  for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  if(difference)return respond({error:'unauthorized'},401);
  let claim;
  try{claim=await store.hqDailyClaim(owner);}catch{return respond({error:'schedule_claim_failed'},503);}
  if(!claim)return respond({status:'not_due'});
  const skill=loadSkill('sales-marketing');
  let result;
  try{result=await research(claim.profile,claim.known);}catch{result={status:'failed',report:{errors:[{step:'research',code:'research_failed'}]},candidates:[]};}
  if(analyze&&result.candidates.length){
   try{
    const rows=await analyze({industry:'旅宿',region:'桃園市 '+claim.profile.district,services:claim.profile.offer,
     verified:result.candidates.map(candidate=>({candidate,source:{...candidate.evidence[0],url:candidate.source_url}}))});
    result.candidates=result.candidates.flatMap((candidate,index)=>{
     const row=rows[index];
     return row.fit?[{...candidate,fit_score:row.fit_score,fit_reason:row.offer,score_components:{mode:'assisted'},
      draft:`AI 合作提案草稿｜待 HANA 審核\n公開證據：${row.quote}\n需求假設：${row.need_hypothesis}\n合作提案：${row.proposal}\n驗證問題：${row.validation_question}\n尚未聯絡。`}]:[];
    }).sort((a,b)=>b.fit_score-a.fit_score);
    result.report.analysis_mode='assisted';
   }catch{
    result.status='partial';
    result.report.errors.push({step:'proposal_analysis',code:'hq_analysis_unavailable'});
    result.candidates=[];
   }
  }
  try{return respond(await store.hqDailyFinish(owner,claim.id,result.status,result.report,result.candidates,{id:skill.id,version:skill.version,hash:skill.hash,source:skill.source}));}
  catch{return respond({error:'schedule_save_unconfirmed'},503);}
 }
 return {account,worker};
}
