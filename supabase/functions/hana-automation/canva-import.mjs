// Converts one already-prepared HANA micro-lesson PowerPoint into a Canva design.
// External publication is never part of this module.
export const SOURCE_ROOT='https://raw.githubusercontent.com/h-s017/hana-focus/hana-focus-preview/content/instagram/';
const datePattern=/^20\d\d-\d\d-\d\d$/;
const mime='application/vnd.openxmlformats-officedocument.presentationml.presentation';
export function lessonDate(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function sourceUrls(date){
 if(!datePattern.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z')))throw Error('bad_lesson_date');
 return {lesson:SOURCE_ROOT+date+'/lesson.json',pptx:SOURCE_ROOT+date+'/canva-import.pptx'};
}
export async function checkPublicSource(date,fetcher=fetch){
 const urls=sourceUrls(date);
 const result=await fetcher(urls.lesson,{redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!result.ok)return {ready:false,reason:'lesson_unavailable'};
 const lesson=await result.json();
 if(lesson.date!==date||lesson.status!=='editorial_ready'||!Array.isArray(lesson.pages)||lesson.pages.length!==6)return {ready:false,reason:'lesson_not_validated'};
 const response=await fetcher(urls.pptx,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)return {ready:false,reason:'powerpoint_unavailable'};
 return {ready:true,url:urls.pptx,title:'HANA 嗅覺藝術微課｜'+date,media_type:mime,pages:6};
}
export function publicImportState(job){
 if(!job)return {status:'not_started',published:false};
 const out={status:job.status,date:job.lesson_date,published:false};
 if(job.design_id && /^[A-Za-z0-9_-]{6,64}$/.test(job.design_id)){
  out.design_id=job.design_id;
  out.edit_url='https://www.canva.com/design/'+job.design_id+'/edit';
 }
 if(Number.isInteger(job.page_count))out.page_count=job.page_count;
 if(job.error_code)out.error_code=job.error_code;
 return out;
}
