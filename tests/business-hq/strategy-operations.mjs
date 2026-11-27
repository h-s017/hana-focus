import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
import {automationStore} from '../../supabase/functions/hana-automation/store.mjs';
import {hqStore} from '../../supabase/functions/hana-automation/hq-store.mjs';
import {prioritizeStrategySales,strategyBusinessHQ,strategyMarginEvidence} from '../../supabase/functions/hana-automation/hq-strategy.mjs';

const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const business=['education','product_development','core_product'];
const sample={
 effective_from:date,currency:'TWD',core_product:'Fixture ingredient',core_unit:'kg',initial_capital_minor:12345,
 founder_independence_target_year:2028,automation_target_pct:42,market_mix:{B2B:34,B2G:33,B2C:33},
 years:[{year:Number(date.slice(0,4)),core_target_minor:88888,milestone:'Fixture milestone',allocation:{education:35,product_development:38,core_product:27}}],
 business_lines:Object.fromEntries(business.map(id=>[id,{label:id,purpose:'Fixture scope',offerings:['Fixture offer']} ])),
 cash_guardrail:'Fixture constraint',
 sales_lanes:Array.from({length:7},(_,i)=>({
  id:'fixture-'+i,label:'Fixture '+i,business_line:business[i%3],market:i===0?'B2C':i===1?'B2G':'B2B',
  channel:i===3?'partner':'direct',public_query:'public fixture query',public_offer:'public fixture offer',public_search_approved:i!==4
 }))
};

export async function testStrategyOperations({cfg,owner,other}){
 const {store,authenticate}=automationStore({url:cfg.url,service:cfg.service});
 const hq=hqStore({url:cfg.url,service:cfg.service});
 const http=control({store,authenticate,readiness:()=>({}),businessHQ:strategyBusinessHQ({store:hq})});
 const send=(session,body)=>http(new Request(cfg.url,{method:'POST',headers:{Authorization:'Bearer '+session,'Content-Type':'application/json'},body:JSON.stringify({workspace:'work',...body})}));
 const post=async(session,body,status=200)=>{
  const response=await send(session,body),value=await response.json();
  assert.equal(response.status,status,JSON.stringify(value));
  return value;
 };
 assert.equal((await post('signed-out',{action:'hq_strategy_snapshot'},401)).error,'login_required');
 assert.equal((await post(owner.access_token,{action:'hq_strategy_snapshot',workspace:'church'},409)).error,'hq_work_only');
 assert.equal((await post(other.access_token,{action:'hq_strategy_snapshot'})).profile,null);
 const read=await fetch(cfg.url+'/rest/v1/hana_hq_strategy_versions?select=id',{headers:{Authorization:'Bearer '+owner.access_token,apikey:cfg.anon}});
 assert.equal(read.ok,false);
 const request={action:'hq_strategy_approve',confirmed:true,expected_revision:0,profile:sample};
 assert.equal((await post(owner.access_token,{...request,confirmed:false},409)).error,'hq_strategy_invalid');
 assert.equal((await post(owner.access_token,{...request,profile:{...sample,market_mix:{B2B:90,B2C:20,B2G:1}}},409)).error,'hq_strategy_invalid');
 const concurrent=await Promise.all([post(owner.access_token,request),post(owner.access_token,request)]);
 assert.equal(concurrent[0].profile.id,concurrent[1].profile.id);
 assert.equal(concurrent[0].profile.revision,1);
 assert.equal((await post(owner.access_token,{...request,profile:{...sample,core_product:'Conflicting fixture'}},409)).error,'hq_strategy_conflict');
 assert.equal((await post(other.access_token,{action:'hq_strategy_snapshot'})).profile,null);
 const reportBody={action:'hq_strategy_report',through:date,period:'monthly'};
 const empty=await post(owner.access_token,reportBody);
 assert.equal(empty.annual_core_actual_minor,null);assert.equal(empty.annual_core_target_minor,88888);
 const add=async(fact,status=200)=>post(owner.access_token,{action:'hq_strategy_fact',confirmed:true,fact},status);
 const fixture={type:'recognized',line_key:'test-line',event_date:date,business_line:'education',market:'B2C',
  channel:'partner',currency:'TWD',amount_minor:2100,direct_cost_minor:840,source_ref:'Fixture transaction A'};
 const inserted=await add(fixture);
 assert.deepEqual(await add(fixture),{id:inserted.id,replayed:true});
 assert.equal((await add({...fixture,amount_minor:2200},409)).error,'hq_strategy_conflict');
 await add({...fixture,type:'received',direct_cost_minor:null,amount_minor:2100});
 assert.equal((await add({...fixture,type:'invoiced',direct_cost_minor:null,market:'B2B'},409)).error,'hq_strategy_conflict');
 await add({...fixture,business_line:'product_development',line_key:'test-line-2',market:'B2G',channel:'direct',amount_minor:3300,direct_cost_minor:null});
 await add({...fixture,business_line:'core_product',line_key:'test-line-3',market:'B2B',channel:'direct',amount_minor:5000,quantity_milli:1450,direct_cost_minor:2000});
 const report=await post(owner.access_token,reportBody);
 assert.deepEqual(report.skills.map(skill=>skill.id),['corporate-strategy','financial-management']);
 assert.equal(report.annual_core_actual_minor,'5000');
 assert.equal(report.financial_rows.filter(row=>row.event_type==='recognized').reduce((sum,row)=>sum+Number(row.amount_minor),0),10400);
 assert.equal(report.financial_rows.find(row=>row.business_line==='product_development').cost_minor,null);
 assert.equal(report.financial_rows.find(row=>row.business_line==='core_product').quantity_milli,'1450');
 assert.equal(report.financial_rows.find(row=>row.channel==='partner'&&row.event_type==='recognized').market,'B2C');
 assert.deepEqual((await post(other.access_token,reportBody)).financial_rows,[]);
 const plan=prioritizeStrategySales(concurrent[0].profile,{localDay:date,recent:[{direction:'fixture-2',saved:1}],actuals:strategyMarginEvidence(report)});
 assert.equal(plan.lanes.length,7);assert.equal(plan.lanes.find(lane=>lane.market==='B2G').status,'blocked');
 assert.equal(plan.lanes.find(lane=>lane.market==='B2C').status,'blocked');
 assert.ok(plan.selected&&plan.selected.public_search_approved);
 await writeFile('test-artifacts/hq-strategy-isolated.json',JSON.stringify({fixture_data:true,production_modified:false,revision:1,
  strategy_id:concurrent[0].profile.id,owner_isolation:true,market_channel_reconciliation:true,unknown_cost:true,recognized_not_receipts:true},null,2));
 console.log('PASS private strategy: authenticated and isolated version save, identical/concurrent replay, conflict rejection, recognition/receipt and overlapping partner reconciliation, unknown costs and portfolio blockers.');
}
