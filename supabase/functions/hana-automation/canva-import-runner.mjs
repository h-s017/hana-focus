import {checkPublicSource,publicImportState,lessonDate} from './canva-import.mjs';
// Single tenant, fixed current Taiwan date. No caller-supplied URL or arbitrary file.
export function canvaImportRunner({ownerId,store,api,fetcher=fetch,now=()=>new Date()}){
 const fail=code=>Object.assign(Error(code),{code});
 async function poll(owner,date,row){
  if(row.status!=='in_progress'||!row.job_id)return publicImportState(row);
  const response=await api(owner,'url-imports/'+encodeURIComponent(row.job_id));
  const job=response?.job;
  if(job?.id!==row.job_id)throw fail('canva_import_provider_unavailable');
  if(job.status==='in_progress')return publicImportState(row);
  if(job.status==='failed'){
   const error=(typeof job.error?.code==='string'&&/^[a-z_]{2,50}$/.test(job.error.code))?job.error.code:'provider_failed';
   const saved=await store.canvaImportUpdate(owner,date,{status:'failed',error_code:error},'in_progress');
   return publicImportState(saved);
  }
  if(job.status!=='success')throw fail('canva_import_provider_unavailable');
  const designs=job.result?.designs;
  if(!Array.isArray(designs)||designs.length!==1||!/^[-\w]{6,64}$/.test(designs[0]?.id||'')){
   const bad=await store.canvaImportUpdate(owner,date,{status:'needs_verification',error_code:'unexpected_design_count'},'in_progress');
   return publicImportState(bad);
  }
  const design=designs[0];
  let count=Number.isInteger(design.page_count)?design.page_count:null;
  if(count===null){
   const metadata=await api(owner,'designs/'+encodeURIComponent(design.id));
   if(Number.isInteger(metadata?.design?.page_count))count=metadata.design.page_count;
  }
  const verified=count===6;
  const saved=await store.canvaImportUpdate(owner,date,{
   status:verified?'success':'needs_verification',
   design_id:design.id,page_count:count,
   error_code:verified?null:'page_count_unverified'
  },'in_progress');
  try{await store.event(owner,'社群微課',null,null,verified?'canva_import_verified':'canva_import_needs_verification',
   {date,design_id:design.id,pages:count,published:false});}catch{}
  return publicImportState(saved);
 }
 return async function execute(){
  if(!ownerId)throw fail('canva_import_unavailable');
  const date=lessonDate(now()),owner=ownerId;
  // The user may already have a manually generated design today; scheduling
  // is only for dates after the adoption day (2026-10-26).
  if(date<='2026-10-26')return {status:'already_managed',date,published:false};
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).format(now()));
  if(hour<8)return {status:'not_yet_scheduled',date,published:false};
  let row=await store.canvaImportJob(owner,date);
  if(row)return poll(owner,date,row);
  const source=await checkPublicSource(date,fetcher);
  if(!source.ready)return {status:'source_not_ready',date,reason:source.reason,published:false};
  const won=await store.canvaImportReserve(owner,date);
  if(!won){
   row=await store.canvaImportJob(owner,date);
   return publicImportState(row);
  }
  // Mark the exclusive row before issuing Canva POST; a crash or timeout must
  // never cause a second asynchronous import for the same lesson date.
  await store.canvaImportUpdate(owner,date,{status:'submitting'},'reserved');
  let job;
  try{
   const result=await api(owner,'url-imports','POST',{
    title:source.title,url:source.url,mime_type:source.media_type
   });
   job=result?.job;
   if(typeof job?.id!=='string'||job.id.length>128)throw fail('canva_import_unverified_response');
  }catch{
   await store.canvaImportUpdate(owner,date,{status:'needs_verification',error_code:'submission_uncertain'},'submitting');
   return {status:'needs_verification',date,error_code:'submission_uncertain',published:false};
  }
  row=await store.canvaImportUpdate(owner,date,{status:'in_progress',job_id:job.id},'submitting');
  return publicImportState(row);
 };
}
