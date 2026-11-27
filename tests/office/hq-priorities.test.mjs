import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultBusinessProfile,selectBusinessDirection} from '../../supabase/functions/hana-automation/hq-priorities.mjs';
import {proactiveHQ} from '../../supabase/functions/hana-automation/hq-proactive.mjs';

test('national defaults and strategy consider events and recent results',()=>{
 assert.equal(defaultBusinessProfile.county,'');
 assert.equal(defaultBusinessProfile.enabled,false);
 const research={title:'文化館所感官工作坊'};
 assert.equal(selectBusinessDirection([], [research]).id,'overture');
 assert.notEqual(selectBusinessDirection([{direction:'overture',saved:0}], [research]).id,'overture');
});

test('a due production run without search or AI saves blockers and no candidate',async()=>{
 const secret='x'.repeat(32);
 let finished;
 const store={
  hqDailyClaim:async()=>({id:'test',profile:defaultBusinessProfile,known:[]}),
  hqDailyFinish:async(owner,id,status,report,candidates)=>{
   finished={owner,id,status,report,candidates};
   return {status,saved:candidates.length};
  },
 };
 const service=proactiveHQ({store,owner:'test-owner',secret,enabled:true,requireAssisted:true,
  research:async()=>({status:'completed',report:{errors:[],market:[]},candidates:[{company_name:'fixture'}]})});
 const response=await service.worker(new Request('https://example.com',{method:'POST',headers:{'x-hana-hq-worker':secret}}));
 assert.deepEqual(await response.json(),{status:'blocked',saved:0});
 assert.deepEqual(finished.candidates,[]);
 assert.deepEqual(finished.report.errors.map(row=>row.code),['hq_analysis_not_configured','hq_discovery_not_configured']);
});

test('scheduled strategy sends only owner-designated public research fields and records blocked lanes',async()=>{
 const secret='y'.repeat(32),localDay='2026-11-26';
 const lane={id:'fixture-lane',label:'PRIVATE STRATEGY DESCRIPTION',business_line:'education',market:'B2B',channel:'partner',
  public_query:'public fixture query',public_offer:'public fixture offer',public_search_approved:true};
 const confidential={...defaultBusinessProfile,offer:'PRIVATE LEGACY OFFER'};
 let saved,publicQuery,analysisInput;
 const store={
  hqDailyClaim:async()=>({id:'due',profile:confidential,known:[]}),
  hqStrategyRunDay:async()=>localDay,
  hqStrategyGet:async()=>({revision:4,payload:{initial_capital_minor:191919,years:[],
   sales_lanes:[lane,{...lane,id:'consumer',market:'B2C'},{...lane,id:'public',market:'B2G'}]}}),
  hqStrategyReport:async()=>({financial_rows:[]}),
  hqDailyFinish:async(owner,id,status,report,candidates)=>{saved={status,report,candidates};return {status,saved:candidates.length};}
 };
 const discovery={available:true,find:async query=>{publicQuery=query;return [{company_name:'Fixture organization'}];}};
 const sourceReader={available:true,read:async()=>({url:'https://example.com',excerpt:'fixture evidence'})};
 const service=proactiveHQ({store,owner:'fixture',secret,enabled:true,requireAssisted:true,requireStrategy:true,discovery,sourceReader,
  research:async()=>({status:'completed',report:{errors:[],market:[]},candidates:[]}),
  analyze:async input=>{analysisInput=input;return [{fit:true,fit_score:9,offer:'fixture proposal'}];}
 });
 const response=await service.worker(new Request('https://example.com',{method:'POST',headers:{'x-hana-hq-worker':secret}}));
 assert.deepEqual(await response.json(),{status:'completed',saved:1});
 assert.equal(publicQuery.industry,lane.public_query);
 assert.equal(analysisInput.services,lane.public_offer);
 assert.doesNotMatch(JSON.stringify({publicQuery,analysisInput}),/PRIVATE|191919/);
 assert.equal(saved.report.strategy_revision,4);
 assert.equal(saved.report.sales_lanes.find(item=>item.id==='consumer').status,'blocked');
 assert.equal(saved.report.sales_lanes.find(item=>item.id==='public').status,'blocked');
 assert.equal(saved.candidates[0].score_components.channel,'partner');
});
