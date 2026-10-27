import {INTAKE_BUCKET,INTAKE_ACCEPT,FILE_LIMITS,fileType,prepareIntake,sourceLinks} from './work-intake.mjs';
export function createIntakeInput({db,owner}){
 let selected=[],revision=0,pending=null,disposed=false;const uploaded=new Set(),previews=[];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const node=el('div');node.className='work-intake';
 const picker=el('input');picker.type='file';picker.multiple=true;picker.accept=INTAKE_ACCEPT;picker.setAttribute('aria-label','上傳工作素材');
 const drop=el('label','把照片或文件放這裡');drop.className='work-dropzone';drop.append(picker,el('span','也可以點選檔案。最多 10 個，每個 10 MB；支援照片、PDF、TXT、Markdown。'));
 const list=el('div');list.className='work-file-list';
 const links=el('textarea');links.rows=2;links.setAttribute('aria-label','素材連結');links.placeholder='OneDrive、Canva、Google Drive 或 Notion 連結，一行一個';
 const linkLabel=el('label','或貼上已有的素材連結');linkLabel.append(links);
 const status=el('p');status.setAttribute('aria-live','polite');
 node.append(drop,list,linkLabel,status);
 function clearPreviews(){for(const url of previews)URL.revokeObjectURL(url);previews.length=0;}
 function render(){
  clearPreviews();list.replaceChildren();
  selected.forEach((file,i)=>{const row=el('div');row.className='work-file-chip';if(file.type.startsWith('image/')){const image=el('img');image.src=URL.createObjectURL(file);previews.push(image.src);image.alt='';row.append(image);}const remove=el('button','移除');remove.type='button';remove.setAttribute('aria-label','移除素材：'+file.name);remove.onclick=()=>{selected.splice(i,1);revision++;render();};row.append(el('span',file.name),remove);list.append(row);});
  status.textContent=selected.length?'已選擇 '+selected.length+' 個素材；送出時才上傳至私人素材區。':'';
 }
 function choose(files){
  try{if(files.length>FILE_LIMITS.count||files.reduce((n,f)=>n+f.size,0)>FILE_LIMITS.total)throw Error();files.forEach(fileType);selected=files;revision++;render();}
  catch{status.textContent='檔案未加入。請確認格式、數量及大小；原本選取的素材仍保留。';}
 }
 picker.onchange=()=>choose([...picker.files]);links.oninput=()=>revision++;
 drop.ondragover=e=>{e.preventDefault();};drop.ondrop=e=>{e.preventDefault();choose([...selected,...e.dataTransfer.files]);};
 async function prepare(project,fields){
  const files=[...selected],sources=sourceLinks(links.value),v=revision;
  const temporary=pending?.id||crypto.randomUUID(),prepared=await prepareIntake(files,{owner,project,request:temporary});
  const fingerprint=JSON.stringify({project,fields,links:sources,files:prepared.map(x=>[x.record.name,x.record.mime,x.record.size,x.record.sha256])});
  if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
  const request=pending.id;for(const item of prepared)item.record.path=item.record.path.replace('/'+temporary+'/', '/'+request+'/');
  if(files.length||sources.length){
   const {data,error}=await db.functions.invoke('hana-automation',{body:{action:'focus_intake_status'}});
   if(error||data?.version!==1||(files.length&&!data.private_files_ready))throw Object.assign(Error('intake_setup_required'),{code:'intake_setup_required'});
  }
  for(let i=0;i<prepared.length;i++){
   if(disposed)throw Error('disposed');const {file,record}=prepared[i];if(uploaded.has(record.path))continue;
   status.textContent='正在保存素材 '+(i+1)+'／'+prepared.length+'：'+record.name;
   const {error}=await db.storage.from(INTAKE_BUCKET).upload(record.path,file,{contentType:record.mime,cacheControl:'0',upsert:false});
   if(error){
    // A lost response may leave a successful immutable upload. Verify instead of overwriting.
    const duplicate=String(error.statusCode||error.status)==='409';
    if(!duplicate)throw Object.assign(Error('intake_upload_failed'),{code:'intake_upload_failed'});
    const directory=record.path.slice(0,record.path.lastIndexOf('/')),name=record.path.split('/').pop();
    const check=await db.storage.from(INTAKE_BUCKET).list(directory,{search:name,limit:100});
    if(check.error||!check.data?.some(f=>f.name===name&&Number(f.metadata?.size)===record.size&&f.metadata?.mimetype===record.mime))throw Object.assign(Error('intake_upload_failed'),{code:'intake_upload_failed'});
   }
   uploaded.add(record.path);
  }
  return {request,revision:v,materials:{files:prepared.map(x=>x.record),links:sources}};
 }
 return {node,prepare,complete(v){if(v!==revision)return;selected=[];picker.value='';links.value='';pending=null;revision++;render();},dispose(){disposed=true;clearPreviews();selected=[];uploaded.clear();node.replaceChildren();}};
}
