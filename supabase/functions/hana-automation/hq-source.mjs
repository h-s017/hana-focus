import {hqError} from './hq-registry.mjs';
const domainPattern=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export function publicUrl(value){
 let u;try{u=new URL(value);}catch{throw hqError('hq_invalid_source');}
 const host=u.hostname.toLowerCase().replace(/^www\./,'');
 if(u.protocol!=='https:'||u.username||u.password||u.port||!domainPattern.test(host)||/\.(?:local|internal|localhost|test|invalid|example)$/.test(host)||host==='localhost')throw hqError('hq_invalid_source');
 u.hash='';return {url:u.href,domain:host};
}
function plainText(html){return html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt|#\d+|#x[a-f0-9]+);/gi,x=>{if(x==='&nbsp;')return ' ';if(x==='&amp;')return '&';if(x==='&quot;')return '"';if(x==='&lt;')return '<';if(x==='&gt;')return '>';const n=x.startsWith('&#x')?parseInt(x.slice(3),16):parseInt(x.slice(2),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/\s+/g,' ').trim();}
// No discovery/search is claimed. Only explicitly configured public hosts can
// be read; arbitrary caller URLs, redirects, credentials and private hosts fail closed.
/** @param {{allowedHosts?: string[], fetcher?: typeof fetch, now?: () => Date, timeoutMs?: number}} [options] */
export function publicSourceReader({allowedHosts=[],fetcher=fetch,now=()=>new Date(),timeoutMs=8000}={}){
 // A malformed HQ setting must not take down existing calendar/Auth routes.
 const hosts=new Set();for(const h of allowedHosts){try{hosts.add(publicUrl('https://'+h).domain);}catch{}}
 return {available:hosts.size>0,mode:'public_url_read',discovery:false,
  async read(candidate){
   const source=publicUrl(candidate.source_url),website=publicUrl(candidate.website);
   if(!hosts.has(source.domain)||source.domain!==website.domain)throw hqError('hq_source_not_authorized');
   let response;
   try{response=await fetcher(source.url,{redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'text/html,text/plain','User-Agent':'HANA-Business-HQ/1.0 (single-source review)'}});}catch(e){throw hqError(['AbortError','TimeoutError'].includes(e.name)?'hq_source_timeout':'hq_source_unavailable');}
   if(!response.ok||!/^text\/(?:html|plain)\b/i.test(response.headers.get('content-type')||''))throw hqError('hq_source_unavailable');
   const reader=response.body?.getReader();if(!reader)throw hqError('hq_source_unavailable');
   const chunks=[];let bytes=0;
   try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>512000){await reader.cancel();throw hqError('hq_source_too_large');}chunks.push(part.value);}}catch(e){throw e.code?e:hqError(['AbortError','TimeoutError'].includes(e.name)?'hq_source_timeout':'hq_source_unavailable');}
   const buffer=new Uint8Array(bytes);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
   const text=plainText(new TextDecoder().decode(buffer)).slice(0,60000);
   if(text.length<40)throw hqError('hq_source_insufficient');
   const name=candidate.company_name.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
   if(name.length<2||!text.normalize('NFKC').toLowerCase().replace(/\s+/g,'').includes(name))throw hqError('hq_company_unconfirmed');
   const anchor=Math.max(0,text.toLowerCase().indexOf(candidate.company_name.toLowerCase())-120);
   const excerpt=text.slice(anchor,anchor+1800);
   // Role-based public business mailboxes only; never infer employee contacts.
   const contact=text.match(/\b(?:info|contact|business|sales|service|hello)@[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[0]||null;
   return {url:source.url,checked_at:now().toISOString(),excerpt,content_hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join(''),verified:true,company_name_confirmed:true,public_business_contact:contact,text};
  }
 };
}
