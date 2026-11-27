// Converts one already-prepared HANA micro-lesson PowerPoint into a Canva design.
// External publication is never part of this module.
import preset from '../../../social-editor/visual-preset.json' with {type:'json'};
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
export const lessonPageCount=date=>date>=preset.sensory_editorial.starts_on?preset.sensory_editorial.pages:preset.default_pages;
export async function checkPublicSource(date,fetcher=fetch){
 const urls=sourceUrls(date);
 const result=await fetcher(urls.lesson,{redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!result.ok)return {ready:false,reason:'lesson_unavailable'};
 const lesson=await result.json();
 const count=lessonPageCount(date),sensory=count===preset.sensory_editorial.pages;
 if(lesson.date!==date||lesson.status!=='editorial_ready'||!Array.isArray(lesson.pages)||lesson.pages.length!==count||(sensory&&lesson.edition!=='sensory-v2.1'))return {ready:false,reason:'lesson_not_validated'};
 const art=lesson.visuals;
 if(art?.artwork_ready!==true||art.fixture!==false||art.image_count!==count||typeof art.style!=='string'||!art.style.trim()||!Array.isArray(art.asset_hashes)||art.asset_hashes.length!==count||new Set(art.asset_hashes).size!==count||!art.asset_hashes.every(x=>/^[a-f0-9]{64}$/.test(x))||!/^[a-f0-9]{64}$/.test(art.pptx_sha256||''))return {ready:false,reason:'original_artwork_required'};
 if(sensory&&(art.style!==preset.sensory_editorial.style||!Array.isArray(art.palette)||art.palette.length<4||art.palette.length>6||new Set(art.palette).size!==art.palette.length||art.palette.some(value=>!/^#[0-9A-F]{6}$/.test(value))))return {ready:false,reason:'visual_preset_required'};
 // A custom PPTX is a layout draft, not evidence that the approved Canva
 // typography was preserved. The present builder deliberately cannot set this.
 if(art.preset_id!==(sensory?preset.sensory_editorial.id:preset.id)||art.layout_reference_design_id!==preset.layout_reference_design_id||art.layout_status!=='native_reference_preserved')return {ready:false,reason:'layout_reference_required'};
 const response=await fetcher(urls.pptx,{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)return {ready:false,reason:'powerpoint_unavailable'};
 if(Number(response.headers.get('content-length'))>20*1024*1024){await response.body?.cancel();return {ready:false,reason:'powerpoint_too_large'};}
 const reader=response.body?.getReader();if(!reader)return {ready:false,reason:'powerpoint_unavailable'};
 const chunks=[];let length=0;
 while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>20*1024*1024){await reader.cancel();return {ready:false,reason:'powerpoint_too_large'};}chunks.push(part.value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(sha!==art.pptx_sha256)return {ready:false,reason:'powerpoint_revision_mismatch'};
 return {ready:true,url:urls.pptx,title:(sensory?'HANA 感官誌｜':'HANA 嗅覺藝術微課｜')+date,media_type:mime,pages:count};
}
export function publicImportState(job){
 if(!job)return {status:'not_started',published:false};
 const out={status:job.status,date:job.lesson_date,published:false,technical_verified:job.status==='success',visual_review:'pending_hana'};
 if(job.design_id && /^[A-Za-z0-9_-]{6,64}$/.test(job.design_id)){
  out.design_id=job.design_id;
  out.edit_url='https://www.canva.com/design/'+job.design_id+'/edit';
 }
 if(Number.isInteger(job.page_count))out.page_count=job.page_count;
 if(job.error_code)out.error_code=job.error_code;
 return out;
}
