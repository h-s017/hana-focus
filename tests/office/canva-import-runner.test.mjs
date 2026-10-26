import assert from 'node:assert/strict';
import {canvaImportRunner} from '../../supabase/functions/hana-automation/canva-import-runner.mjs';
import {checkPublicSource,publicImportState,sourceUrls} from '../../supabase/functions/hana-automation/canva-import.mjs';
import {canvaApiClient} from '../../supabase/functions/hana-automation/canva-import-api.mjs';
const clock=new Date('2026-10-27T01:00:00Z'); // 09:00 in Taipei
const date='2026-10-27';
const owner='test-owner';
function fixture({pages=6,submissionFails=false,noMetadata=false}={}){
 let row=null;const calls=[],events=[];
 const store={
  canvaImportJob:async(o,d)=>o===owner&&d===date?row:null,
  canvaImportReserve:async(o,d)=>{if(row)return false;row={lesson_date:d,status:'reserved',job_id:null,design_id:null,page_count:null,error_code:null};return true;},
  canvaImportUpdate:async(o,d,patch,status)=>{if(!row||row.status!==status)throw Error('storage_claim_mismatch');row={...row,...patch};return row;},
  event:async(...v)=>events.push(v)
 };
 const fetcher=async(url,options={})=>{
  calls.push('source:'+url+':'+(options.method||'GET'));
  if(url.endsWith('lesson.json'))return Response.json({date,status:'editorial_ready',pages:Array.from({length:6},(_,i)=>({title:'P'+i,body:'Text'}))});
  if(url.endsWith('canva-import.pptx')&&options.method==='HEAD')return new Response(null,{status:200});
  throw Error('unrecognized source URL');
 };
 const api=async(o,path,method,body)=>{
  assert.equal(o,owner);calls.push('api:'+path+':'+(method||'GET'));
  if(path==='url-imports'&&method==='POST'){
   assert.equal(body.url,sourceUrls(date).pptx);
   assert.equal(body.mime_type,'application/vnd.openxmlformats-officedocument.presentationml.presentation');
   if(submissionFails)throw Error('unknown import outcome');
   return {job:{id:'canva-job-0001',status:'in_progress'}};
  }
  if(path==='url-imports/canva-job-0001')return {job:{id:'canva-job-0001',status:'success',result:{designs:[{id:'DAABC123456',...(noMetadata?{}:{page_count:pages})}]}}};
  if(path==='designs/DAABC123456')return {design:{id:'DAABC123456',page_count:pages}};
  throw Error('unexpected Canva endpoint');
 };
 const runner=canvaImportRunner({ownerId:owner,store,api,fetcher,now:()=>clock});
 return {runner,calls,events,row:()=>row};
}
const f=fixture();
let result=await f.runner();
assert.equal(result.status,'in_progress');
assert.equal(f.calls.filter(x=>x==='api:url-imports:POST').length,1);
result=await f.runner();
assert.equal(result.status,'success');
assert.equal(result.page_count,6);
assert.equal(result.design_id,'DAABC123456');
assert.equal(result.published,false);
assert.equal(f.events[0][4],'canva_import_verified');
await f.runner();
assert.equal(f.calls.filter(x=>x==='api:url-imports:POST').length,1);
const missing=fixture({pages:5,noMetadata:true});
await missing.runner();
result=await missing.runner();
assert.equal(result.status,'needs_verification');
assert.equal(result.error_code,'page_count_unverified');
const unsure=fixture({submissionFails:true});
result=await unsure.runner();
assert.equal(result.status,'needs_verification');
assert.equal(result.error_code,'submission_uncertain');
await unsure.runner();
assert.equal(unsure.calls.filter(x=>x==='api:url-imports:POST').length,1);
const disabled=canvaImportRunner({ownerId:owner,store:f.runner,api:async()=>{throw Error('called');},now:()=>new Date('2026-10-26T01:00:00Z')});
assert.equal((await disabled()).status,'already_managed');
assert.equal((await checkPublicSource('2026-10-27',async()=>new Response(null,{status:404}))).ready,false);
assert.equal(publicImportState(null).published,false);

{
 let writes=0;
 const store={credential:async()=>({ciphertext:'encrypted',version:'current'}),
  saveCredential:async(o,kind,cipher,version)=>{assert.equal(version,'current');assert.equal(kind,'canva');writes++;}};
 const encryption={open:async()=>({access_token:'old',refresh_token:'refresh-old',scope:'design:content:write',expires_at:0}),seal:async(_,v)=>{assert.equal(v.refresh_token,'refresh-next');return 'sealed';}};
 const seen=[];
 const fetcher=async(url,opt)=>{
  seen.push({url,method:opt.method});
  if(url.endsWith('/oauth/token')){
   assert.equal(opt.body.get('grant_type'),'refresh_token');
   return Response.json({access_token:'access-next',refresh_token:'refresh-next',expires_in:3600,token_type:'Bearer'});
  }
  assert.equal(opt.headers.Authorization,'Bearer access-next');
  return Response.json({job:{id:'canva-job-0001'}});
 };
 const client=canvaApiClient({store,encryption,clientId:'app-id',clientSecret:'app-secret',fetcher,now:()=>Date.parse('2026-10-27T01:00:00Z')});
 assert.equal((await client(owner,'url-imports/test')).job.id,'canva-job-0001');
 assert.equal(writes,1);
 assert.equal(seen.length,2);
}
console.log('PASS: idempotent six-page import, uncertain submission, private token refresh, no publishing.');
