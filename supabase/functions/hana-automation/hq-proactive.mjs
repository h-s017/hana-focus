import {hqError,loadSkill} from './hq-registry.mjs';
import {taiwanCounties} from '../../../js/taiwan-counties.mjs';
import {defaultBusinessProfile,discoverBusinessSources,selectBusinessDirection} from './hq-priorities.mjs';
import {prioritizeStrategySales,strategyMarginEvidence} from './hq-strategy.mjs';

export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

export function proactiveProfile(value){
 const fields={positioning:1000,ideal_customer:1000,offer:600,county:5,signals:240};
 const profile=Object.fromEntries(Object.entries(fields).map(([key,max])=>{
  const field=value?.[key];
  if(typeof field!=='string'||field.length>max||(!field.trim()&&key!=='county'))throw hqError('hq_invalid_input');
  return [key,field.trim()];
 }));
 if((profile.county&&!taiwanCounties.includes(profile.county))||!signalTerms(profile.signals).length||!Number.isInteger(value.daily_limit)||value.daily_limit<1||value.daily_limit>5||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.run_at)||typeof value.enabled!=='boolean')throw hqError('hq_invalid_input');
 return {...profile,daily_limit:value.daily_limit,run_at:value.run_at,enabled:value.enabled};
}

export function signalTerms(value){return [...new Set(value.split(/[,，、\n]/).map(term=>term.trim()).filter(term=>term.length>=2))].slice(0,12);}

/** @typedef {ReturnType<typeof import('./hq-analysis.mjs').businessAnalysis>} Analysis */
export function proactiveHQ({store,research,owner,enabled,secret,analyze=/** @type {Analysis} */ (null),requireAssisted=false,requireStrategy=false,
 discovery=/** @type {ReturnType<typeof import('./hq-discovery.mjs').publicBusinessDiscovery>|null} */ (null),
 sourceReader=/** @type {ReturnType<typeof import('./hq-source.mjs').publicSourceReader>|null} */ (null)}){
 const ready=enabled&&Boolean(owner)&&secret.length>=32;
 async function account(user,body){
  const state=await store.hqProfile(user,body.action==='hq_profile_save'?proactiveProfile(body.profile):null);
  return {...state,default_profile:defaultBusinessProfile,scheduler_available:ready&&user===owner,
   scheduled_generation:analyze?'assisted':requireAssisted?'blocked':'evidence_rules',scheduled_discovery:Boolean(discovery?.available&&sourceReader?.available)};
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
  const save=async(status,report,candidates)=>{
   try{return respond(await store.hqDailyFinish(owner,claim.id,status,report,candidates,{id:skill.id,version:skill.version,hash:skill.hash,source:skill.source}));}
   catch{return respond({error:'schedule_save_unconfirmed'},503);}
  };
  let plan=null;
  if(requireStrategy){
   let profile,localDay,actuals={};
   try{localDay=await store.hqStrategyRunDay(owner,claim.id);if(!localDay)throw Error();profile=await store.hqStrategyGet(owner,localDay);}
   catch{return save('blocked',{errors:[{step:'strategy',code:'strategy_read_unconfirmed'}]},[]);}
   if(!profile)return save('blocked',{errors:[{step:'strategy',code:'strategy_profile_missing'}]},[]);
   try{actuals=strategyMarginEvidence(await store.hqStrategyReport(owner,localDay,'weekly'));}
   catch{/* Keep evidence unknown if financial data is unavailable. */}
   plan=prioritizeStrategySales(profile,{localDay,recent:claim.recent||[],actuals});
  }
  let result;
  try{result=await research(claim.profile,claim.known);}catch{result={status:'failed',report:{errors:[{step:'research',code:'research_failed'}]},candidates:[]};}
  const selected=plan?.selected;
  const direction=selected?{...selected,query:selected.public_query,offer:selected.public_offer,matching:[]}:
   selectBusinessDirection(claim.recent||[],result.report.market||[]);
  result.report.direction=direction.id;
  result.report.direction_label=direction.label;
  result.report.direction_market_signals=direction.matching;
  if(requireAssisted){
   if((requireStrategy&&!selected)||!analyze||!discovery?.available||!sourceReader?.available){
    result.status='blocked';
    result.candidates=[];
    result.report.analysis_mode='blocked';
    if(requireStrategy&&!selected)result.report.errors.push({step:'strategy',code:'strategy_no_authorized_sales_lane'});
    if(!analyze)result.report.errors.push({step:'proposal_analysis',code:'hq_analysis_not_configured'});
    if(!discovery?.available||!sourceReader?.available)result.report.errors.push({step:'business_search',code:'hq_discovery_not_configured'});
   }else{
    try{
     const scope=claim.profile.county||'臺灣';
     const broad=await discoverBusinessSources({discovery,reader:sourceReader,direction,scope,known:claim.known,limit:claim.profile.daily_limit});
     result.report.errors.push(...broad.errors);
     result.report.verified_web_sources=broad.candidates.length;
     result.candidates=broad.candidates;
     result.report.analysis_mode='assisted';
     result.status=result.report.errors.length?'partial':'completed';
    }catch(error){
     result.status='failed';
     result.candidates=[];
     result.report.errors.push({step:'business_search',code:error.code||'hq_discovery_unavailable'});
    }
   }
  }
  if(analyze&&result.candidates.length){
   try{
    const rows=await analyze({industry:selected?.public_query||(requireAssisted?direction.label:'旅宿'),region:claim.profile.county||'全臺灣（含離島）',services:selected?.public_offer||direction.label+'；'+claim.profile.offer,
     verified:result.candidates.map(candidate=>({candidate,source:{...candidate.evidence[0],url:candidate.source_url}}))});
    result.candidates=result.candidates.flatMap((candidate,index)=>{
     const row=rows[index];
     return row.fit?[{...candidate,fit_score:row.fit_score,fit_reason:row.offer,
      score_components:{mode:'assisted',strategy_revision:plan?.revision||null,
       ...(selected?{business_line:selected.business_line,market:selected.market,channel:selected.channel}:{})},
      draft:`AI 合作提案草稿｜待 HANA 審核\n公開證據：${row.quote}\n需求假設：${row.need_hypothesis}\n合作提案：${row.proposal}\n驗證問題：${row.validation_question}\n尚未聯絡。`}]:[];
    }).sort((a,b)=>b.fit_score-a.fit_score).slice(0,claim.profile.daily_limit);
    result.report.analysis_mode='assisted';
   }catch{
    result.status='partial';
    result.report.errors.push({step:'proposal_analysis',code:'hq_analysis_unavailable'});
    result.candidates=[];
   }
  }
  if(plan){
   result.report.strategy_revision=plan.revision;
   result.report.sales_lanes=plan.lanes.map(({id,label,business_line,market,channel,status,blocker})=>({id,label,business_line,market,channel,
    status:id===selected?.id?result.status:status,blocker}));
   if(!selected){delete result.report.direction;delete result.report.direction_label;delete result.report.direction_market_signals;}
  }
  return save(result.status,result.report,result.candidates);
 }
 return {account,worker};
}
