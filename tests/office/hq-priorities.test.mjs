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
