import {hqError} from './hq-registry.mjs';

const invalid=()=>hqError('provider_archive_invalid');

export async function boundedBytes(response,max){
 const reader=response.body?.getReader();
 if(!reader)throw invalid();
 const parts=[];let length=0;
 try{
  for(;;){
   const part=await reader.read();
   if(part.done)break;
   length+=part.value.byteLength;
   if(length>max){await reader.cancel();throw hqError('provider_response_too_large');}
   parts.push(part.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;
 for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 return bytes;
}

function openNamedZipEntry(bytes,name){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=i=>{if(i<0||i+2>bytes.length)throw invalid();return view.getUint16(i,true);};
 const u32=i=>{if(i<0||i+4>bytes.length)throw invalid();return view.getUint32(i,true);};
 let end=bytes.length-22;
 for(;end>=Math.max(0,bytes.length-65557);end--){
  if(u32(end)===0x06054b50&&end+22+u16(end+20)===bytes.length)break;
 }
 if(end<Math.max(0,bytes.length-65557)||u16(end+4)||u16(end+6))throw invalid();
 const count=u16(end+10),size=u32(end+12);let offset=u32(end+16);
 if(count>32||offset+size!==end)throw invalid();
 const decoder=new TextDecoder();
 for(let i=0;i<count&&offset<end;i++){
  if(u32(offset)!==0x02014b50)throw invalid();
  const nameLength=u16(offset+28),nameStart=offset+46;
  const next=nameStart+nameLength+u16(offset+30)+u16(offset+32);
  if(next>end)throw invalid();
  if(decoder.decode(bytes.subarray(nameStart,nameStart+nameLength))===name){
   if(u16(offset+10)!==8||(u16(offset+8)&1))throw invalid();
   const compressed=u32(offset+20),expanded=u32(offset+24),local=u32(offset+42);
   if(expanded>64*1024*1024||u32(local)!==0x04034b50)throw invalid();
   const start=local+30+u16(local+26)+u16(local+28);
   if(start+compressed>u32(end+16))throw invalid();
   return {data:bytes.subarray(start,start+compressed),expanded};
  }
  offset=next;
 }
 throw invalid();
}

// Iterate the official top-level row array without retaining the 37 MB JSON
// document and its parsed object graph together in the Edge process.
export async function readTourismRows(response,file,key,visit){
 const {data,expanded}=openNamedZipEntry(await boundedBytes(response,10*1024*1024),file);
 const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const decoder=new TextDecoder('utf-8',{fatal:true});
 const field=new RegExp('"'+key+'"\\s*:\\s*\\[');
 let header='',inside=false,done=false,part='',depth=0,quoted=false,escape=false,bytes=0;
 function consume(chunk){
  if(!inside){
   header+=chunk;
   const prefix=field.exec(header);
   if(!prefix){if(header.length>8192)throw invalid();return;}
   chunk=header.slice(prefix.index+prefix[0].length);header='';inside=true;
  }
  let start=depth?0:-1;
  for(let i=0;i<chunk.length&&!done;i++){
   const c=chunk[i];
   if(quoted){
    if(escape)escape=false;
    else if(c==='\\')escape=true;
    else if(c==='"')quoted=false;
   }else if(c==='"'&&depth)quoted=true;
   else if(c==='{'){if(!depth)start=i;depth++;}
   else if(c==='}'&&depth){
    if(--depth===0){visit(JSON.parse(part+chunk.slice(start,i+1)));part='';start=-1;}
   }else if(!depth&&c===']')done=true;
   else if(!depth&&c!==','&&!/\s/.test(c))throw invalid();
  }
  if(depth){part+=chunk.slice(start);if(part.length>300_000)throw invalid();}
 }
 for await(const chunk of stream){
  bytes+=chunk.byteLength;
  if(bytes>expanded)throw invalid();
  consume(decoder.decode(chunk,{stream:true}));
 }
 consume(decoder.decode());
 if(!done||bytes!==expanded)throw invalid();
}
