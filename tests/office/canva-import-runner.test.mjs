import assert from 'node:assert/strict';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
import {canvaImportRunner} from '../../supabase/functions/hana-automation/canva-import-runner.mjs';
import {checkPublicSource,publicImportState,sourceUrls} from '../../supabase/functions/hana-automation/canva-import.mjs';
import {canvaApiClient} from '../../supabase/functions/hana-automation/canva-import-api.mjs';
const clock=new Date('2026-10-27T01:00:00Z'); // 09:00 in Taipei
const date='2026-10-27';
const owner='test-owner';
const pptxBytes=new TextEncoder().encode('isolated PPTX fixture');
const pptxHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pptxBytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
const visuals={artwork_ready:true,fixture:false,image_count:6,style:'fixture',preset_id:'hana-art-editorial-2026-10-20',layout_reference_design_id:'DAHYaeidsPw',layout_status:'native_reference_preserved',asset_hashes:Array.from({length:6},(_,i)=>String(i+1).repeat(64)),pptx_sha256:pptxHash};
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
  if(url.endsWith('lesson.json'))return Response.json({date,status:'editorial_ready',visuals,pages:Array.from({length:6},(_,i)=>({title:'P'+i,body:'Text'}))});
  if(url.endsWith('canva-import.pptx'))return new Response(pptxBytes,{status:200});
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
const placeholder=await checkPublicSource(date,async()=>Response.json({date,status:'editorial_ready',pages:Array(6).fill({title:'copy'}),visuals:{artwork_ready:false}}));
assert.equal(placeholder.ready,false);assert.equal(placeholder.reason,'original_artwork_required');
const mismatch=await checkPublicSource(date,async url=>url.endsWith('lesson.json')?Response.json({date,status:'editorial_ready',pages:Array(6).fill({title:'copy'}),visuals}):new Response('changed after visual QA'));
assert.equal(mismatch.ready,false);assert.equal(mismatch.reason,'powerpoint_revision_mismatch');
for(const invalid of [{...visuals,layout_status:'draft_relayout'},{...visuals,layout_status:undefined},{...visuals,preset_id:'old-default-watercolor'},{...visuals,layout_reference_design_id:'another-template'}]){
 let deckFetches=0;
 const result=await checkPublicSource(date,async url=>{if(!url.endsWith('lesson.json')){deckFetches++;throw Error('unreviewed draft must not be fetched');}return Response.json({date,status:'editorial_ready',pages:Array(6).fill({title:'copy'}),visuals:invalid});});
 assert.equal(result.reason,'layout_reference_required');assert.equal(deckFetches,0);
}
for(const invalid of [{...visuals,fixture:true},{...visuals,fixture:undefined},{...visuals,asset_hashes:Array(6).fill('a'.repeat(64))},{...visuals,style:''}]){
 const result=await checkPublicSource(date,async()=>Response.json({date,status:'editorial_ready',pages:Array(6).fill({title:'copy'}),visuals:invalid}));
 assert.equal(result.reason,'original_artwork_required');
}
for(const streamed of [false,true]){
 let canceled=false;
 const tooLarge=await checkPublicSource(date,async url=>url.endsWith('lesson.json')?Response.json({date,status:'editorial_ready',pages:Array(6).fill({title:'copy'}),visuals}):new Response(new ReadableStream({start(controller){if(streamed)controller.enqueue(new Uint8Array(20*1024*1024+1));},cancel(){canceled=true;}}),{headers:streamed?{}:{'content-length':String(20*1024*1024+1)}}));
 assert.equal(tooLarge.reason,'powerpoint_too_large');assert.equal(canceled,true);
}
assert.equal(publicImportState({status:'success',lesson_date:date}).visual_review,'pending_hana');
{
 let probes=0;
 const status=control({authenticate:async()=>({id:owner,app_metadata:{hana_office_access:true}}),readiness:()=>({}),store:{canvaImportJob:async()=>null},canvaSourceStatus:async day=>{assert.equal(day,date);probes++;return {ready:false,reason:'layout_reference_required'};}});
 const response=await status(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer isolated-fixture'},body:JSON.stringify({action:'canva_import_status',lesson_date:date})}));
 assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.status,'source_not_ready');assert.equal(data.reason,'layout_reference_required');assert.equal(data.published,false);assert.equal(probes,1);
 const denied=control({authenticate:async()=>({id:owner,app_metadata:{}}),canvaSourceStatus:async()=>{throw Error('must not probe without trusted access');}});
 assert.equal((await denied(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer isolated-fixture'},body:'{}'}))).status,403);
}

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
