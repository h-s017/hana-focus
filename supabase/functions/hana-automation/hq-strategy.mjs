import {hqError,loadSkill} from './hq-registry.mjs';

export const businessLines=['education','product_development','core_product'];
export const markets=['B2B','B2G','B2C'];
export const channels=['direct','partner'];
const eventTypes=['contracted','recognized','invoiced','received'];
const validId=/^[a-z][a-z0-9_-]{0,39}$/;
const moneyLimit=1_000_000_000_000_000;
const invalid=()=>{throw hqError('hq_strategy_invalid');};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function text(value,limit=240){
 if(typeof value!=='string'||!value.trim()||value.length>limit)invalid();
 return value.trim();
}
function integer(value,min,max){
 if(!Number.isSafeInteger(value)||value<min||value>max)invalid();
 return value;
}
function listed(value,allowed){if(!allowed.includes(value))invalid();return value;}
function day(value){
 if(!/^20\d\d-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)invalid();
 return value;
}
function allocation(value,keys){
 if(!object(value)||Object.keys(value).length!==keys.length)invalid();
 const mixed=Object.fromEntries(keys.map(key=>[key,integer(value[key],0,100)]));
 if(Object.values(mixed).reduce((sum,n)=>sum+n,0)!==100)invalid();
 return mixed;
}

export function validateStrategy(input){
 if(!object(input)||!Array.isArray(input.years)||input.years.length<1||input.years.length>10||
  !Array.isArray(input.sales_lanes)||input.sales_lanes.length<7||input.sales_lanes.length>12)invalid();
 const effective_from=day(input.effective_from);
 const years=input.years.map((year,index)=>{
  if(!object(year))invalid();
  const first=integer(input.years[0]?.year,Number(effective_from.slice(0,4)),2090);
  const expected=first+index;
  return {year:integer(year.year,expected,expected),core_target_minor:integer(year.core_target_minor,0,moneyLimit),
   milestone:text(year.milestone,500),allocation:allocation(year.allocation,businessLines)};
 });
 const sales_lanes=input.sales_lanes.map(lane=>{
  if(!object(lane)||!validId.test(lane.id)||typeof lane.public_search_approved!=='boolean')invalid();
  return {id:lane.id,label:text(lane.label,100),business_line:listed(lane.business_line,businessLines),
   market:listed(lane.market,markets),channel:listed(lane.channel,channels),
   public_query:text(lane.public_query,160),public_offer:text(lane.public_offer,160),public_search_approved:lane.public_search_approved};
 });
 if(new Set(sales_lanes.map(lane=>lane.id)).size!==sales_lanes.length||
  businessLines.some(line=>!sales_lanes.some(lane=>lane.business_line===line)))invalid();
 if(!object(input.business_lines))invalid();
 const business_lines=Object.fromEntries(businessLines.map(key=>{
  const line=input.business_lines[key];
  if(!object(line)||!Array.isArray(line.offerings)||!line.offerings.length||line.offerings.length>16)invalid();
  return [key,{label:text(line.label,50),purpose:text(line.purpose,500),offerings:line.offerings.map(offer=>text(offer,100))}];
 }));
 return {effective_from,currency:listed(input.currency,['TWD','USD','JPY','EUR']),core_product:text(input.core_product,100),core_unit:text(input.core_unit,15),
  initial_capital_minor:integer(input.initial_capital_minor,0,moneyLimit),founder_independence_target_year:integer(input.founder_independence_target_year,2000,2099),
  automation_target_pct:integer(input.automation_target_pct,0,100),market_mix:allocation(input.market_mix,markets),years,business_lines,sales_lanes,
  cash_guardrail:text(input.cash_guardrail,500)};
}

export function validateStrategyFact(input){
 if(!object(input))invalid();
 const type=listed(input.type,eventTypes);
 const quantity=input.quantity_milli===null||input.quantity_milli===undefined?null:integer(input.quantity_milli,0,999_999_999);
 const cost=input.direct_cost_minor===null||input.direct_cost_minor===undefined?null:integer(input.direct_cost_minor,0,moneyLimit);
 if(type!=='recognized'&&(quantity!==null||cost!==null))invalid();
 return {type,line_key:text(input.line_key,120),event_date:day(input.event_date),business_line:listed(input.business_line,businessLines),
  market:listed(input.market,markets),channel:listed(input.channel,channels),currency:listed(input.currency,['TWD','USD','JPY','EUR']),
  amount_minor:integer(input.amount_minor,-moneyLimit,moneyLimit),direct_cost_minor:cost,
  quantity_milli:quantity,source_ref:text(input.source_ref,180)};
}

export function prioritizeStrategySales(profile,{localDay,recent=[],actuals={}}){
 if(!profile)return {selected:null,lanes:[],revision:null};
 const allocation=profile.payload.years.find(row=>row.year===Number(localDay.slice(0,4)))?.allocation;
 const lanes=profile.payload.sales_lanes.map((lane,index)=>{
  const prior=recent.filter(row=>row.direction===lane.id);
  const actual=actuals[lane.business_line];
  const evidence=actual?.margin_bps;
  const score=(allocation?.[lane.business_line]??0)/5-prior.length*3+Math.min(4,prior.reduce((sum,row)=>sum+(row.saved||0),0))
   +(typeof evidence==='number'?Math.max(-8,Math.min(8,evidence/1000)):0);
  let blocker=null;
  if(lane.market==='B2G')blocker='official_tender_feed_required';
  else if(lane.market==='B2C')blocker='privacy_safe_enrollment_source_required';
  else if(!lane.public_search_approved)blocker='public_search_authorization_required';
  return {...lane,status:blocker?'blocked':'queued',blocker,score,index};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
 return {selected:lanes.find(lane=>!lane.blocker)||null,lanes,revision:profile.revision};
}

export function strategyMarginEvidence(report){
 const actuals={};
 for(const line of businessLines){
  const rows=report.financial_rows.filter(row=>row.event_type==='recognized'&&row.business_line===line&&row.currency===report.currency);
  if(!rows.length||rows.some(row=>row.cost_minor===null))continue;
  const revenue=rows.reduce((sum,row)=>sum+BigInt(row.amount_minor),0n);
  const cost=rows.reduce((sum,row)=>sum+BigInt(row.cost_minor),0n);
  if(revenue>0n)actuals[line]={margin_bps:Number((revenue-cost)*10000n/revenue)};
 }
 return actuals;
}

/** @param {{store:any}} options */
export function strategyBusinessHQ({store}){
 return async (owner,body)=>{
  if(body.workspace!=='work')throw hqError('hq_work_only');
  if(body.action==='hq_strategy_snapshot')return {profile:await store.hqStrategyGet(owner)};
  if(body.action==='hq_strategy_approve'){
   if(body.confirmed!==true)invalid();
   return {profile:await store.hqStrategySave(owner,integer(body.expected_revision,0,100000),validateStrategy(body.profile))};
  }
  if(body.action==='hq_strategy_fact'){
   if(body.confirmed!==true)invalid();
   return store.hqStrategyFact(owner,validateStrategyFact(body.fact));
  }
  if(body.action==='hq_strategy_report'){
   const through=day(body.through),period=listed(body.period,['daily','weekly','monthly','yearly']);
   const report=await store.hqStrategyReport(owner,through,period);
   const skills=['corporate-strategy','financial-management'].map(id=>{
    const {version,hash}=loadSkill(id);
    return {id,version,hash,tool:'owner_scoped_strategy_report',status:'executed'};
   });
   return {...report,skills};
  }
  return invalid();
 };
}
