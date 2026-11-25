import test from 'node:test';
import assert from 'node:assert/strict';
import {businessAnalysis} from '../../supabase/functions/hana-automation/hq-analysis.mjs';
import {businessHQ} from '../../supabase/functions/hana-automation/hq.mjs';

const candidate={company_name:'Synthetic Company',website:'https://fixture.invalid/'};
const source={url:'https://fixture.invalid/about',excerpt:'A public fixture for brand workshops.',content_hash:'fixture-hash'};
const row={id:'1',quote:'public fixture',fit:true,fit_score:7,offer:'Sample activity',need_hypothesis:'Training may fit',proposal:'Test a pilot',validation_question:'Is a pilot wanted?'};

test('model receives bounded evidence and binds its answer to the same source',async()=>{
 const analyze=businessAnalysis(async request=>{
  assert.equal(request.format.strict,true);
  assert.deepEqual(JSON.parse(request.input).companies,[{id:'1',company:candidate.company_name,excerpt:source.excerpt}]);
  assert.ok(!request.input.includes('private brief'));
  return JSON.stringify({companies:[row]});
 });
 const [result]=await analyze({verified:[{candidate,source}],industry:'events',region:'Taipei',services:'scent',context:'private brief'});
 assert.equal(result.source_url,source.url);
 assert.equal(result.source_hash,source.content_hash);
 assert.equal(result.proposal,row.proposal);
});

test('invented quotations, missing companies, and disabled provider fail closed',async()=>{
 assert.equal(businessAnalysis(null),null);
 const input={verified:[{candidate,source}],industry:'events',region:'Taipei',services:'scent'};
 for(const companies of [[],[{...row,quote:'An invented quotation'}],[{...row,id:'unexpected'}],[{...row,fit_score:11}],[{...row,fit_score:2}]]){
  await assert.rejects(businessAnalysis(async()=>JSON.stringify({companies}))(input),/hq_analysis_unavailable/);
 }
 const store={hqStart:()=>assert.fail('No model authorization must mean no run claim')};
 await assert.rejects(businessHQ({store})('owner',{action:'hq_run',workspace:'work',request_id:'70000000-0000-4000-8000-000000000001',input:{workspace:'work',goal:'test',industry:'event',region:'Taipei',services:'scent',limit:1,companies:[],generation_mode:'assisted'}}),/hq_analysis_not_configured/);
});
