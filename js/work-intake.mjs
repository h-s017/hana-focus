// Shared browser/server contract. Files stay in private Storage, never in task JSON.
export const INTAKE_BUCKET='hana-work-intake';
export const FILE_LIMITS={count:10,each:10*1024*1024,total:30*1024*1024};
const TYPES={'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp'],'application/pdf':['pdf'],'text/plain':['txt'],'text/markdown':['md']};
export const INTAKE_ACCEPT=Object.values(TYPES).flat().map(x=>'.'+x).join(',');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad=()=>Object.assign(Error('intake_invalid'),{code:'intake_invalid'});
export function fileType(file){
 const ext=String(file.name||'').split('.').pop().toLowerCase();
 const mime=Object.keys(TYPES).find(m=>TYPES[m].includes(ext));
 if(!mime||(file.type&&file.type!==mime&&file.type!=='application/octet-stream')||!file.name||file.name.length>180||/[\u0000-\u001f]/.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>FILE_LIMITS.each)throw bad();
 return {ext,mime};
}
export function sourceLinks(value){
 const rows=Array.isArray(value)?value:String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(rows.length>10)throw bad();
 return [...new Set(rows.map(raw=>{
  if(typeof raw!=='string'||raw.length>2048)throw bad();
  let u;try{u=new URL(raw);}catch{throw bad();}
  const h=u.hostname;
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(['1drv.ms','onedrive.live.com','canva.com','www.canva.com','docs.google.com','drive.google.com','notion.so','www.notion.so','app.notion.com'].includes(h)||/^[a-z0-9-]+\.(sharepoint\.com|notion\.site)$/.test(h)))throw bad();
  if([...u.searchParams.keys()].some(k=>/^(access_token|refresh_token|api_?key|password|client_secret)$/i.test(k)))throw bad();
  return u.href;
 }))];
}
export function validateIntake(value,{owner,project,request}){
 if(value==null)return {files:[],links:[]};
 if(!value||!Array.isArray(value.files)||value.files.length>FILE_LIMITS.count)throw bad();
 const links=sourceLinks(value.links||[]),seen=new Set();let total=0;
 const files=value.files.map(f=>{
  if(!f||!uuid.test(owner)||!uuid.test(project)||!uuid.test(request)||typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256))throw bad();
  const {ext,mime}=fileType({name:f.name,type:f.mime,size:f.size});
  const path=owner+'/'+project+'/'+request+'/'+f.sha256+'.'+ext;
  if(f.path!==path||seen.has(path))throw bad();seen.add(path);total+=f.size;
  return {path,name:f.name,mime,size:f.size,sha256:f.sha256,excerpt:typeof f.excerpt==='string'?f.excerpt.slice(0,2000):''};
 });
 if(total>FILE_LIMITS.total)throw bad();
 return {files,links};
}
export async function prepareIntake(files,context){
 if(files.length>FILE_LIMITS.count||files.reduce((n,f)=>n+f.size,0)>FILE_LIMITS.total)throw bad();
 const prepared=[];
 for(const file of files){
  const {ext,mime}=fileType(file),bytes=await file.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const excerpt=mime.startsWith('text/')?new TextDecoder().decode(bytes.slice(0,16000)).slice(0,2000):'';
  if(/(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SMTP_PASSWORD)\s*[=:]|sk-proj-[A-Za-z0-9_-]{20,}/.test(excerpt))throw Object.assign(Error('intake_secret_detected'),{code:'intake_secret_detected'});
  prepared.push({file,record:{name:file.name,mime,size:file.size,sha256:hash,path:context.owner+'/'+context.project+'/'+context.request+'/'+hash+'.'+ext,excerpt}});
 }
 validateIntake({files:prepared.map(x=>x.record),links:[]},context);
 return prepared;
}
export function fileCategory(file){
 if(/立面|配置|施工|cad|尺寸/i.test(file.name))return '牆面與尺寸參考';
 if(/菜單|menu/i.test(file.name))return '舊菜單與品牌紀錄';
 if(/門市|招牌|店面|store/i.test(file.name))return '店面照片';
 if(file.mime.startsWith('image/'))return '照片（內容待看圖確認）';
 return '文件與補充資料';
}
export function pmIntakePlan(task){
 const intake=task?.source_payload?.work_intake||{},files=Array.isArray(intake.files)?intake.files:[],links=Array.isArray(intake.links)?intake.links:[];
 const wall=/沿革牆|歷史牆/.test((task?.title||'')+' '+(task?.brief||''));
 return {action:'work_intake_plan_v1',request:String(task?.brief||task?.title||'').slice(0,12000),title:task?.title||'工作整理',
  materials:files.slice(0,10).map(f=>({name:f.name,category:fileCategory(f),size:f.size,mime:f.mime,path:f.path,reading:f.mime?.startsWith('text/')?'已擷取文字片段':'已登記檔案，尚未判讀圖片或 PDF 內文'})),
  links:links.slice(0,10).map(url=>({url,status:'已登記連結，未自動讀取外部檔案'})),
  sourcePoints:files.filter(f=>f.mime?.startsWith('text/')&&f.excerpt).flatMap(f=>f.excerpt.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,4).map(quote=>({source:f.name,quote:quote.slice(0,300)}))).slice(0,8),
  completed:['已保存交辦需求',...(files.length?['已核對上傳檔案並依檔名分類']:[]),'已整理下一步與待確認事項'],
  steps:wall?['檢視並挑選歷史照片，保留原檔','核對照片年代與使用權；1979 背景與 2002 創立分開','整理沿革牆精簡文案','依既有長向立面圖排照片與文字，不改牆面及桌椅高度','將設計初稿送交 HANA 查看']:['核對這次需求與素材','整理工作範圍、缺件與前置事項','準備可查看的工作初稿','由 HANA 確認需要決定的部分'],
  questions:[...(!files.length&&!links.length?['尚未附素材，請補上檔案或素材連結']:[]),...(wall?['需核對照片年代、史料及圖像使用權','實際牆面尺寸及原立面圖需到齊']:[])],
  limits:'目前使用免費規則整理；尚未執行照片辨識、修圖或設計工具。以上步驟是工作草稿，不是已完成的設計。',externalWrites:false,paidApiCalls:0};
}
