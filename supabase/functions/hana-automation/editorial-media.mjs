const bucket='hana-editorial-private';
const maxBytes=8*1024*1024;
const pngMagic=[137,80,78,71,13,10,26,10];
const identifier=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const error=code=>Object.assign(Error(code),{code});

export function editorialMediaSlots(kind){
 if(kind==='sensory')return Array.from({length:7},(_,i)=>'photo-'+(i+1));
 if(kind==='founder_story')return ['photo-1','story'];
 if(kind==='service_marketing')return ['photo-1'];
 return [];
}

async function readBytes(source){
 if(Number(source.headers.get('content-length'))>maxBytes)throw error('editorial_media_too_large');
 const reader=source.body?.getReader();
 if(!reader)throw error('editorial_media_invalid_png');
 const chunks=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>maxBytes){await reader.cancel();throw error('editorial_media_too_large');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const output=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}
 return output;
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{
 for(let bit=0;bit<8;bit++)n=(n&1?0xedb88320:0)^(n>>>1);
 return n;
});

async function inspect(bytes,kind){
 if(bytes.length<57||!pngMagic.every((byte,index)=>bytes[index]===byte))throw error('editorial_media_invalid_png');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const width=view.getUint32(16),height=view.getUint32(20);
 if(width!==1080||height!==(kind==='founder_story'?1920:1350))throw error('editorial_media_wrong_dimensions');
 let hasData=false,ended=false;
 for(let offset=8;offset+12<=bytes.length;){
  const size=view.getUint32(offset),typeOffset=offset+4,end=offset+8+size;
  if(end+4>bytes.length)throw error('editorial_media_invalid_png');
  const type=String.fromCharCode(...bytes.subarray(typeOffset,typeOffset+4));
  if((offset===8&&(type!=='IHDR'||size!==13))||(offset!==8&&type==='IHDR')||['acTL','fcTL','fdAT'].includes(type))throw error('editorial_media_invalid_png');
  let crc=0xffffffff;
  for(let i=typeOffset;i<end;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  if(((crc^0xffffffff)>>>0)!==view.getUint32(end))throw error('editorial_media_invalid_png');
  if(type==='IDAT'&&size)hasData=true;
  if(type==='IEND'){
   ended=size===0&&end+4===bytes.length;
   break;
  }
  offset=end+4;
 }
 if(!hasData||!ended)throw error('editorial_media_invalid_png');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 return {width,height,sha256,format:'png',size:bytes.byteLength,readback:true};
}

export function editorialMedia({url,service,fetcher=fetch}){
 const storage=new URL('/storage/v1/',url);
 const headers={apikey:service,Authorization:'Bearer '+service};
 function objectPath(owner,record,slot){
  if(!identifier.test(owner)||!identifier.test(record.id)||!editorialMediaSlots(record.kind).includes(slot))throw error('editorial_media_invalid_slot');
  return bucket+'/'+owner+'/'+record.id+'/'+slot+'.png';
 }
 const request=(path,options={})=>fetcher(new URL(path,storage),{...options,redirect:'error',signal:AbortSignal.timeout(16000),headers:{...headers,...options.headers}});
 async function read(owner,record,slot){
  const response=await request('object/authenticated/'+objectPath(owner,record,slot));
  if(!response.ok){
   const result=await response.json().catch(()=>null);
   // Storage may map a missing private object to HTTP 400 instead of 404.
   if(response.status===404||result?.code==='NoSuchKey'||result?.error==='not_found'||result?.error==='Object not found')return null;
   throw error('editorial_media_storage_unavailable');
  }
  const bytes=await readBytes(response);
  return inspect(bytes,record.kind);
 }
 return {
  async upload(owner,record,slot,req){
   const object=objectPath(owner,record,slot);
   if(req.headers.get('content-type')!=='image/png')throw error('editorial_media_invalid_png');
   const bytes=await readBytes(req),incoming=await inspect(bytes,record.kind);
   // Repeated requests can confirm the same immutable file, never overwrite it.
   const result=await request('object/'+object,{method:'POST',body:bytes,headers:{'Content-Type':'image/png','Cache-Control':'no-store','x-upsert':'false'}});
   if(!result.ok&&![400,409].includes(result.status))throw error('editorial_media_storage_unavailable');
   const persisted=await read(owner,record,slot);
   if(!persisted)throw error('editorial_media_storage_unavailable');
   if(persisted.sha256!==incoming.sha256)throw error('editorial_media_slot_conflict');
   return {...persisted,slot};
  },
  async assess(owner,record){
   const receipts=[];const errors=[];
   const slots=editorialMediaSlots(record.kind);
   for(let index=0;index<slots.length;index+=2){
    const group=slots.slice(index,index+2);
    const results=await Promise.allSettled(group.map(slot=>read(owner,record,slot)));
    results.forEach((result,i)=>{
     if(result.status==='rejected')errors.push(group[i]);
     else if(result.value)receipts.push({...result.value,slot:group[i]});
    });
   }
   return {mediaReceipts:receipts,...(errors.length?{mediaReadFailures:errors}:{})};
  },
  async open(owner,record,slot){
   if(!record.evidence?.mediaReceipts?.some(receipt=>receipt.slot===slot&&receipt.readback===true))throw error('editorial_media_not_available');
   const object=objectPath(owner,record,slot);
   const response=await request('object/sign/'+object,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120})});
   if(!response.ok)throw error('editorial_media_storage_unavailable');
   const result=await response.json();
   const signed=new URL(result.signedURL,storage);
   const expected='/storage/v1/object/sign/'+object;
   if(signed.origin!==storage.origin||![expected,expected.replace('/storage/v1','')].includes(signed.pathname)||!signed.searchParams.get('token'))throw error('editorial_media_storage_unavailable');
   signed.pathname=expected;
   return {url:signed.href,expires_in:120};
  }
 };
}
