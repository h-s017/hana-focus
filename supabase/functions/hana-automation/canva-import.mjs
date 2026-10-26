// Canva public-file import protocol. No implicit publication, folder move or repeat import.
const fail=code=>Object.assign(Error(code),{code});
export const CANVA_PPTX_MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation';
const SHA=/^[a-f0-9]{40}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function validDate(date){
 if(typeof date!=='string'||!DATE.test(date))return false;
 const time=Date.parse(date+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date;
}
export function planCanvaDailyImport({date,commitSha,title}){
 if(!validDate(date)||typeof commitSha!=='string'||!SHA.test(commitSha))throw fail('canva_source_invalid');
 if(typeof title!=='string'||!title.trim()||title.length>120)throw fail('canva_source_invalid');
 // Immutable commit reference: avoids source changes between preview and Canva fetch.
 const url='https://raw.githubusercontent.com/h-s017/hana-focus/'+commitSha.toLowerCase()+'/content/instagram/'+date+'/canva-import.pptx';
 return {date,source_commit:commitSha.toLowerCase(),title:title.trim(),url,mime_type:CANVA_PPTX_MIME,scope:'design:content:write',external_writes:false,instagram_published:false};
}
export function readCanvaImportJob(payload){
 const job=payload?.job;
 if(!job||typeof job.id!=='string'||!ID.test(job.id)||!['in_progress','success','failed'].includes(job.status))throw fail('canva_import_unverified');
 if(job.status==='in_progress')return {status:'in_progress',job_id:job.id,canvaCreated:false,instagramPublished:false};
 if(job.status==='failed')return {status:'failed',job_id:job.id,canvaCreated:false,instagramPublished:false,error:'Canva import failed; inspect owner dashboard before any retry'};
 const designs=job.result?.designs;
 if(!Array.isArray(designs)||designs.length!==1)throw fail('canva_import_unverified');
 const d=designs[0];
 if(!d||typeof d.id!=='string'||!/^D[A-Za-z0-9_-]{10,}$/.test(d.id))throw fail('canva_import_unverified');
 if(d.page_count!=null&&d.page_count!==6)throw fail('canva_page_count_unverified');
 let editUrl=null;
 if(typeof d.urls?.edit_url==='string'){
  try{const u=new URL(d.urls.edit_url);
   if(u.protocol!=='https:'||u.hostname!=='www.canva.com')throw Error();
   editUrl=u.href;
  }catch{throw fail('canva_import_unverified');}
 }
 return {status:'created_in_canva',job_id:job.id,design_id:d.id,canvaCreated:true,
  pagesConfirmed:d.page_count===6,requiresVisualCheck:true,edit_url_temporary:editUrl,
  edit_link_expires_in_days:30,instagramPublished:false};
}
async function jsonResponse(fetcher,url,options){
 let response,body;
 try{response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});body=await response.text();}catch{throw fail('canva_import_provider_unavailable');}
 if(!response.ok||body.length>100000)throw fail('canva_import_provider_unavailable');
 try{return JSON.parse(body);}catch{throw fail('canva_import_provider_unavailable');}
}
export function canvaImportClient({accessToken,fetcher=fetch}){
 if(typeof accessToken!=='string'||accessToken.length<10||accessToken.length>8192)throw fail('canva_reconnect_required');
 const headers={Authorization:'Bearer '+accessToken};
 return {
  async start(plan,{enabled=false}={}){
   // Default deny; this adapter NEVER interprets source existence as owner consent.
   if(enabled!==true)throw fail('canva_import_disabled');
   if(!plan||!validDate(plan.date)||!SHA.test(plan.source_commit)||plan.url!==planCanvaDailyImport({date:plan.date,commitSha:plan.source_commit,title:plan.title}).url)throw fail('canva_source_invalid');
   const payload=await jsonResponse(fetcher,'https://api.canva.com/rest/v1/url-imports',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({title:plan.title,url:plan.url,mime_type:CANVA_PPTX_MIME})
   });
   return readCanvaImportJob(payload);
  },
  async check(jobId){
   if(typeof jobId!=='string'||!ID.test(jobId))throw fail('canva_import_unverified');
   const payload=await jsonResponse(fetcher,'https://api.canva.com/rest/v1/url-imports/'+encodeURIComponent(jobId),{
    method:'GET',headers
   });
   return readCanvaImportJob(payload);
  }
 };
}
