const failure=code=>Object.assign(Error(code),{code});
const bytesTo64=bytes=>btoa(String.fromCharCode(...bytes));
const from64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export function cipher(secret) {
 const bytes=from64(secret||'');if(bytes.length!==32)throw Error('invalid_connector_key');
 const key=crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
 return {
  async seal(owner,value){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await key,new TextEncoder().encode(JSON.stringify(value)));return bytesTo64(iv)+'.'+bytesTo64(new Uint8Array(data));},
  async open(owner,value){const [iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv),additionalData:new TextEncoder().encode(owner)},await key,from64(data))));}
 };
}
async function limitedText(response,max=131072) {
 if(Number(response.headers.get('content-length'))>max)throw failure('source_limit');
 if(!response.body)return '';const reader=response.body.getReader();let size=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw failure('source_limit');parts.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return new TextDecoder().decode(bytes);
}
export function microsoft({clientId,tenant='consumers',store,encryption,fetcher=fetch,now=Date.now}) {
 if(!/^(consumers|common|organizations|[a-f0-9-]{36})$/.test(tenant))throw Error('invalid_tenant');
 const login='https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/';
 async function oauth(endpoint,params){
  if(!clientId)throw failure('source_unavailable');
  const response=await fetcher(login+endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,...params})});
  const data=JSON.parse(await limitedText(response));return {ok:response.ok,data};
 }
 const get=async(owner,kind)=>{const record=await store.credential(owner,kind);if(!record)throw failure('source_expired');return {...record,value:await encryption.open(owner,record.ciphertext)};};
 const save=async(owner,kind,value,version)=>store.saveCredential(owner,kind,await encryption.seal(owner,value),version);
 async function token(owner){
  const record=await get(owner,'microsoft');
  if(record.value.expires_at>now()+60000)return record.value.access_token;
  const {ok,data}=await oauth('token',{grant_type:'refresh_token',refresh_token:record.value.refresh_token,scope:'https://graph.microsoft.com/Files.Read offline_access'});
  if(!ok||!data.access_token)throw failure('source_expired');
  await save(owner,'microsoft',{access_token:data.access_token,refresh_token:data.refresh_token||record.value.refresh_token,expires_at:now()+Math.min(Number(data.expires_in)||3600,86400)*1000},record.version);
  return data.access_token;
 }
 async function graph(owner,path,signal){
  const r=await fetcher('https://graph.microsoft.com/v1.0'+path,{method:'GET',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+await token(owner)}});
  if(!r.ok)throw failure(r.status===401?'source_expired':r.status===403?'source_denied':'source_unavailable');
  return JSON.parse(await limitedText(r,1048576));
 }
 const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9!_-]{1,200}$/.test(value))throw failure('source_denied');return encodeURIComponent(value);};
 async function content(owner,item,signal){
  let r=await fetcher('https://graph.microsoft.com/v1.0/me/drive/items/'+id(item)+'/content',{method:'GET',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+await token(owner)}});
  if([301,302,303,307,308].includes(r.status)){
   const location=new URL(r.headers.get('location')||'');
   if(location.protocol!=='https:'||location.username||location.password||location.port||!(/(^|\.)files\.1drv\.com$/.test(location.hostname)||/^[a-z0-9-]+\.sharepoint\.com$/.test(location.hostname)))throw failure('source_denied');
   // Signed Microsoft download URL: NEVER forward the Graph bearer token, never follow another redirect.
   r=await fetcher(location.href,{method:'GET',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  }
  if(!r.ok)throw failure('source_unavailable');return limitedText(r);
 }
 return {
  async start(owner){
   const {ok,data}=await oauth('devicecode',{scope:'https://graph.microsoft.com/Files.Read offline_access'});
   if(!ok||!data.device_code||!data.user_code)throw failure('source_unavailable');
   const previous=await store.credential(owner,'pending');const interval=Math.max(Number(data.interval)||5,5);
   await save(owner,'pending',{device_code:data.device_code,expires_at:now()+Math.min(Number(data.expires_in)||900,900)*1000,next_poll_at:now()+interval*1000,interval},previous?.version);
   return {user_code:data.user_code,verification_uri:'https://microsoft.com/devicelogin',interval};
  },
  async finish(owner){
   const record=await get(owner,'pending'),pending=record.value;
   if(!pending.device_code||pending.expires_at<now())throw failure('source_expired');
   if(pending.next_poll_at>now())return {status:'pending',retry_after:Math.ceil((pending.next_poll_at-now())/1000)};
   // CAS reserves the poll before contacting Microsoft, preventing concurrent replay and too-fast polling.
   const version=await save(owner,'pending',{...pending,next_poll_at:now()+pending.interval*1000},record.version);
   const {ok,data}=await oauth('token',{grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:pending.device_code});
   if(!ok){
    if(['authorization_pending','slow_down'].includes(data.error)){
     const interval=pending.interval+(data.error==='slow_down'?5:0);
     await save(owner,'pending',{...pending,interval,next_poll_at:now()+interval*1000},version);return {status:'pending',retry_after:interval};
    }
    await save(owner,'pending',{expires_at:0},version);throw failure('source_expired');
   }
   if(!data.access_token||!data.refresh_token)throw failure('source_expired');
   const scopes=String(data.scope||'').toLowerCase().split(' ');
   if(!scopes.some(x=>x==='files.read'||x==='https://graph.microsoft.com/files.read')||scopes.some(x=>x.includes('write')))throw failure('source_denied');
   const previous=await store.credential(owner,'microsoft');
   await save(owner,'microsoft',{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:now()+Math.min(Number(data.expires_in)||3600,86400)*1000},previous?.version);
   await save(owner,'pending',{expires_at:0},version);
   return {status:'connected'};
  },
  async folders(owner,item=null){
   const path=item?'/me/drive/items/'+id(item):'/me/drive/root';
   const folder=await graph(owner,path+'?$select=id,name,folder');if(!folder.folder)throw failure('source_denied');
   const data=await graph(owner,path+'/children?$select=id,name,folder,remoteItem&$top=100');
   return {current:{id:folder.id,name:folder.name},folders:(data.value||[]).filter(x=>x.folder&&!x.remoteItem).map(x=>({id:x.id,name:x.name})),limited:!!data['@odata.nextLink']};
  },
  async snapshot(owner,root,project){
   const signal=AbortSignal.timeout(30000);const queue=[{id:root,depth:0}],items=[];let limited=false,total=0,requests=0;
   const rootFolder=await graph(owner,'/me/drive/items/'+id(root)+'?$select=id,name,folder',signal);if(!rootFolder.folder)throw failure('source_denied');if(project&&String(rootFolder.name||'').trim().normalize('NFC')!==project.trim().normalize('NFC'))throw failure('source_denied');
   while(queue.length&&items.length<40&&requests<15){
    const folder=queue.shift();const data=await graph(owner,'/me/drive/items/'+id(folder.id)+'/children?$select=id,name,eTag,size,file,folder,remoteItem,lastModifiedDateTime&$top=40',signal);requests++;
    if(data['@odata.nextLink'])limited=true;
    for(const file of data.value||[]){
     if(items.length>=40){limited=true;break;}if(file.remoteItem){limited=true;continue;}
     if(file.folder){if(folder.depth<2)queue.push({id:file.id,depth:folder.depth+1});else limited=true;continue;}
     const entry={id:file.id,name:String(file.name||'').slice(0,200),version:file.eTag||file.lastModifiedDateTime||'unknown',read_status:'metadata_only'};
     if(/\.(txt|md|csv|json)$/i.test(entry.name)&&file.size<=131072&&total<16000){const text=await content(owner,file.id,signal);entry.text=text.slice(0,Math.min(6000,16000-total));total+=entry.text.length;entry.read_status=entry.text.length<text.length?'text_truncated':'text_read';if(entry.read_status==='text_truncated')limited=true;}
     items.push(entry);
    }
   }
   if(queue.length)limited=true;
   return {items,limited,note:'僅讀選定資料夾及最多兩層子資料夾，最多40檔/15次列舉、16000文字。PDF/Word/圖片僅檔案資訊，未做OCR或內容解析；來源均待事實核對。'};
  }
 };
}
