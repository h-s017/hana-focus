import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {scheduledKinds,founderForDate,marketingForDate} from '../social-editor/operations-content.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=process.env.LESSON_DATE||today;
if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)throw Error('invalid editorial date');
const output=path.resolve(process.env.HANA_EDITORIAL_OUTPUT_ROOT||path.join(root,'test-artifacts','editorial-operations'));
const workerEnabled=process.env.HANA_EDITORIAL_SYNC_ENABLED==='1';
const token=process.env.HANA_EDITORIAL_WORKER_TOKEN||'';
if(workerEnabled&&token.length<32)throw Error('editorial_sync_not_configured');
const write=(name,value)=>fs.writeFile(name,JSON.stringify(value,null,2)+'\n');
async function worker(body){
 const url='https://ihmvziqisputjnjkuhvm.supabase.co/functions/v1/hana-automation/editorial-worker';
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','x-hana-editorial-worker':token},body:JSON.stringify(body)});
 if(!response.ok)throw Error('editorial_sync_http_'+response.status);
 return response.json();
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
   if(lesson.status==='editorial_ready')content=lesson;
   else reason=lesson.reason;
  }
  if(!content)reason=reason||'approved_content_queue_exhausted';
 }catch{failed=true;reason='editorial_preparation_failed';}
 await write(file,{...task,version:claimed.version,content:content||{},reason});
 const result=workerEnabled?await worker({...task,action:'finish',id:claimed.id,content:content||{},blocked:!content,failed,reason}):{state:failed?'failed':content?'partial':'blocked'};
 receipts.push({...task,version:claimed.version,state:result.state,content_saved:Boolean(content),reason:reason||null});
}
await write(path.join(output,'execution.json'),{date,synced_to_hana_focus:workerEnabled,receipts});
console.log(JSON.stringify({date,synced_to_hana_focus:workerEnabled,receipts}));
if(receipts.some(receipt=>receipt.state==='failed'))process.exitCode=1;
