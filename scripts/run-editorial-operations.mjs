import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scheduledKinds,founderForDate,marketingForDate} from '../social-editor/operations-content.mjs';
import {editorialMediaSlots} from '../supabase/functions/hana-automation/editorial-media.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=process.env.LESSON_DATE||today;
if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)throw Error('invalid editorial date');
const output=path.resolve(process.env.HANA_EDITORIAL_OUTPUT_ROOT||path.join(root,'test-artifacts','editorial-operations'));
const workerEnabled=process.env.HANA_EDITORIAL_SYNC_ENABLED==='1';
const mediaRoot=process.env.HANA_EDITORIAL_MEDIA_ROOT;
const generateSensory=workerEnabled&&process.env.HANA_SOCIAL_IMAGE_ENABLED==='1';
const token=process.env.HANA_EDITORIAL_WORKER_TOKEN||'';
if(workerEnabled&&token.length<32)throw Error('editorial_sync_not_configured');
const write=(name,value)=>fs.writeFile(name,JSON.stringify(value,null,2)+'\n');
const workerUrl='https://ihmvziqisputjnjkuhvm.supabase.co/functions/v1/hana-automation/editorial-worker';
const workerHeaders={'x-hana-editorial-worker':token};
async function worker(body){
 const response=await fetch(workerUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{...workerHeaders,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error('editorial_sync_http_'+response.status);
 return response.json();
}

async function syncMedia(source,task,claimed,content){
 const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
 if(manifest.topic_id!==content.topic_id)throw Error('editorial_media_topic_mismatch');
 const attempts=[];
 for(const slot of editorialMediaSlots(task.kind)){
  try{
   const png=path.join(source,slot+'.png'),file=await fs.stat(png);
   if(!file.isFile()||file.size>8*1024*1024)throw Error('editorial_media_invalid_size');
   const url=new URL(workerUrl);url.search=new URLSearchParams({id:claimed.id,asset:slot});
   const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(42000),headers:{...workerHeaders,'Content-Type':'image/png'},body:await fs.readFile(png)});
   if(!response.ok)throw Error('editorial_media_upload_failed');
   const saved=await response.json();
   if(saved.slot!==slot||saved.readback!==true)throw Error('editorial_media_unconfirmed');
   attempts.push({slot,uploaded:true});
  }catch{attempts.push({slot,uploaded:false});}
 }
 return attempts;
}

async function prepareSensoryMedia(folder,task,content){
 execFileSync(process.env.HANA_EDITORIAL_PYTHON||'python',[path.join(root,'scripts','social-canva-pptx.py')],{
  cwd:folder,env:{...process.env,LESSON_DATE:task.date,HANA_ALLOW_TEST_ARTWORK:'0',HANA_SOCIAL_OUTPUT_ROOT:folder},stdio:'inherit'
 });
 const issueFolder=path.join(folder,'content','instagram',task.date);
 const issue=JSON.parse(await fs.readFile(path.join(issueFolder,'lesson.json'),'utf8'));
 if(issue.visuals?.artwork_ready!==true||issue.visuals?.fixture!==false)return {reason:issue.visuals?.reason||'editorial_media_incomplete'};
 const manifest=JSON.parse(await fs.readFile(path.join(issueFolder,'artwork.json'),'utf8'));
 if(manifest.topic_id!==content.topic_id||manifest.items.length!==7)return {reason:'editorial_media_topic_mismatch'};
 const staged=path.join(folder,'media');await fs.mkdir(staged,{recursive:true});
 for(const entry of manifest.items)await fs.copyFile(path.join(issueFolder,entry.file),path.join(staged,'photo-'+entry.page+'.png'));
 await write(path.join(staged,'manifest.json'),{topic_id:content.topic_id});
 return {staged};
}

await fs.mkdir(output,{recursive:true});
const archive=workerEnabled?(await worker({action:'history'})).entries:[];
const latest=new Map();
for(const row of archive){const key=row.local_day+':'+row.kind;if(!latest.has(key))latest.set(key,row);}
const tasks=new Map(scheduledKinds(date).map(kind=>[date+':'+kind,{date,kind}]));
if(workerEnabled&&date===today)for(const [key,row] of latest){
 if(row.state==='scheduled')tasks.set(key,{date:row.local_day,kind:row.kind});
}
const receipts=[];
for(const task of tasks.values()){
 const claimed=workerEnabled?await worker({...task,action:'claim'}):{claimed:true,version:1};
 if(!claimed.claimed){receipts.push({...task,state:claimed.state,replayed:true});continue;}
 const folder=path.join(output,task.date,task.kind,'v'+claimed.version);
 await fs.mkdir(folder,{recursive:true});
 const seen=[...latest.values()].filter(row=>row.kind===task.kind&&row.local_day!==task.date&&row.payload?.topic_id).map(row=>row.payload);
 const file=path.join(folder,'edition.json');
 let content=null,reason=null,failed=false;
 try{
  if(task.kind==='founder_story')content=founderForDate(task.date,seen);
  if(task.kind==='service_marketing')content=marketingForDate(task.date,seen);
  if(task.kind==='sensory'){
   const historyFile=path.join(folder,'history.json');await write(historyFile,seen);
   const archiveRoot=path.join(folder,'content','instagram');await fs.mkdir(archiveRoot,{recursive:true});
   // Previous public lessons remain a migration-era history source. Generated
   // V2.1 editions go only to the owner-protected delivery ledger.
   for(const archivedDay of (await fs.readdir(path.join(root,'content','instagram'))).filter(day=>/^20\d{2}-\d{2}-\d{2}$/.test(day)&&day<task.date)){
    const item=path.join(archiveRoot,archivedDay);await fs.mkdir(item,{recursive:true});
    await fs.copyFile(path.join(root,'content','instagram',archivedDay,'lesson.json'),path.join(item,'lesson.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
   }
   execFileSync(process.execPath,[path.join(root,'scripts','social-editor.mjs')],{cwd:folder,env:{...process.env,LESSON_DATE:task.date,HANA_EDITORIAL_HISTORY_FILE:historyFile},stdio:'inherit'});
   const lesson=JSON.parse(await fs.readFile(path.join(archiveRoot,task.date,'lesson.json'),'utf8'));
   if(lesson.status==='editorial_ready'){
    const reels=await fs.readFile(path.join(archiveRoot,task.date,'reels-brief.json'),'utf8').then(JSON.parse,error=>{
     if(error.code!=='ENOENT')throw error;
     return null;
    });
    content=reels?{...lesson,reels}:lesson;
   }
   else reason=lesson.reason;
  }
  if(!content)reason=reason||'approved_content_queue_exhausted';
 }catch{failed=true;reason='editorial_preparation_failed';}
 let media=[];
 if(workerEnabled&&content&&(mediaRoot||(generateSensory&&task.kind==='sensory'))){
  try{
   const external=mediaRoot?path.resolve(mediaRoot,task.date,task.kind,'v'+claimed.version):null;
   const staged=external?{staged:external}:await prepareSensoryMedia(folder,task,content);
   if(staged.reason)reason=staged.reason;
   else{media=await syncMedia(staged.staged,task,claimed,content);if(media.some(receipt=>!receipt.uploaded))reason='editorial_media_incomplete';}
  }
  catch{reason='editorial_media_source_unconfirmed';}
 }
 await write(file,{...task,version:claimed.version,content:content||{},reason});
 const result=workerEnabled?await worker({...task,action:'finish',id:claimed.id,content:content||{},blocked:!content,failed,reason}):{state:failed?'failed':content?'partial':'blocked'};
 receipts.push({...task,version:claimed.version,state:result.state,content_saved:Boolean(content),media,reason:reason||null});
}
await write(path.join(output,'execution.json'),{date,synced_to_hana_focus:workerEnabled,receipts});
console.log(JSON.stringify({date,synced_to_hana_focus:workerEnabled,receipts}));
if(receipts.some(receipt=>receipt.state==='failed'))process.exitCode=1;
