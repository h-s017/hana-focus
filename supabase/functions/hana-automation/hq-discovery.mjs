import {hqError} from './hq-registry.mjs';
import {publicUrl} from './hq-source.mjs';

const searchEndpoint='https://api.search.brave.com/res/v1/web/search';
const directories=['facebook.com','instagram.com','linkedin.com','wikipedia.org','104.com.tw','1111.com.tw','tripadvisor.com'];
const text=(value,max)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const normalize=value=>value.normalize('NFKC').toLowerCase();

/** @param {{enabled?:boolean,apiKey?:string,fetcher?:typeof fetch}} [options] */
export function publicBusinessDiscovery({enabled=false,apiKey='',fetcher=fetch}={}){
 const available=enabled&&Boolean(apiKey.trim());
 return {available,
 /** @param {{industry:string,region:string,services:string,limit:number}} criteria @param {string[]} [existingDomains] */
 async find({industry,region,services,limit},existingDomains=[]){
  if(!available)throw hqError('hq_discovery_not_configured');
  const url=new URL(searchEndpoint);
  const q=industry+' '+region;
  url.search=new URLSearchParams({q,country:'ALL',search_lang:/\p{Script=Han}/u.test(q)?'zh-hant':'en',count:String(Math.min(20,limit*3)),result_filter:'web',text_decorations:'false',safesearch:'moderate'}).toString();
  let data;
  try{
   const response=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','X-Subscription-Token':apiKey}});
   if(response.status===429)throw hqError('hq_discovery_rate_limited');
   if(!response.ok)throw hqError('hq_discovery_unavailable');
   const body=await response.text();
   if(body.length>512000)throw hqError('hq_discovery_unavailable');
   data=JSON.parse(body);
  }catch(error){
   if(error.code==='hq_discovery_rate_limited')throw error;
   throw hqError('hq_discovery_unavailable');
  }
  const rows=data?.web?.results??(data?.type==='search'&&!data.web?[]:null);
  if(!Array.isArray(rows)||rows.length>20)throw hqError('hq_discovery_unavailable');
  const known=new Set(existingDomains);
  const candidates=new Map();
  for(const row of rows){
   let source;
   try{source=publicUrl(row?.url);}catch{continue;}
   const {url:source_url,domain}=source;
   if(known.has(domain)||directories.some(d=>domain===d||domain.endsWith('.'+d)))continue;
   const source_title=text(row.title,240),excerpt=text(row.description,600);
   const profile=text(row.profile?.name,140);
   const company_name=(profile||source_title.split(/\s+[|｜–—-]\s+/)[0]).replace(/[|｜]/g,' ').trim().slice(0,140);
   if(company_name.length<2||!source_title)continue;
   const searchText=normalize(source_title+' '+excerpt);
   const matches=[industry,region].filter(term=>searchText.includes(normalize(term)));
   const score=matches.length;
   if(candidates.has(domain)&&candidates.get(domain).score>=score)continue;
   candidates.set(domain,{score,value:{company_name,website:new URL('/',source_url).href,canonical_domain:domain,source_url,source_title,excerpt,
    reason:matches.length?'搜尋結果提及 '+matches.join('、')+'。':'搜尋結果由目標條件帶出，產業與地區仍待核對。',
    approach:'可評估以「'+services+'」作為合作切入點。',
    verification:'unverified'}});
  }
  return [...candidates.values()].sort((a,b)=>b.score-a.score).slice(0,limit).map(candidate=>candidate.value);
 }};
}
