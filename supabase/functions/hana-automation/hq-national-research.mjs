import {hqError} from './hq-registry.mjs';
import {digest,signalTerms} from './hq-proactive.mjs';
import {publicUrl} from './hq-source.mjs';
import {boundedBytes,readTourismRows} from './hq-tourism-archive.mjs';
import {taiwanCounties} from '../../../js/taiwan-counties.mjs';

const origin='https://media.taiwan.net.tw';
const archives=origin+'/XMLReleaseAll_public/v2.0/Zh_tw/';
const detail=id=>origin+'/zh-tw/portal/travel/details/'+id.toLowerCase();
const attribution='交通部觀光署・觀光資訊資料庫（政府資料開放授權條款第 1 版）';
const idPattern=/^(?:Hotel|Event)_[A-Z0-9]+_\d{1,12}$/i;
const plain=value=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|nbsp);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' '})[s]).replace(/\s+/g,' ').trim():'';
const normalized=value=>value.normalize('NFKC').toLowerCase().replace(/台/g,'臺').replace(/\s+/g,'');
const providerError=error=>['AbortError','TimeoutError'].includes(error.name)?'provider_timeout':(/^provider_|^company_/.test(error.code||'')?error.code:'provider_unavailable');
const compareCandidates=(a,b)=>b.fit_score-a.fit_score||b.updated.localeCompare(a.updated)||a.id.localeCompare(b.id);

function rankedAcrossCounties(buckets){
 const ordered=[...buckets.values()];
 return Array.from({length:ordered.reduce((n,rows)=>Math.max(n,rows.length),0)},(_,index)=>ordered.flatMap(rows=>rows[index]?[rows[index]]:[]).sort(compareCandidates)).flat();
}

function candidateSite(row,source){
 try{
  const website=publicUrl(row.WebsiteURL);
  if(!/(^|\.)(facebook\.com|instagram\.com|line\.me|booking\.com|agoda\.com)$/.test(website.domain))return website;
 }catch{/* Use the government directory if there is no listed HTTPS business site. */}
 return publicUrl(source);
}

/** @param {{fetcher?:typeof fetch,now?:()=>Date}} [options] */
export function nationwideResearch({fetcher=fetch,now=()=>new Date()}={}){
 const agency=(url,type,timeout=15000)=>fetcher(url,{redirect:'error',signal:AbortSignal.timeout(timeout),headers:{Accept:type}});
 async function archive(name,key,visit){
  const response=await agency(archives+name+'-json.zip','application/zip, application/x-zip-compressed, application/octet-stream',35000);
  if(!response.ok)throw hqError('provider_response_invalid');
  return readTourismRows(response,name+'List.json',key,visit);
 }
 return async (profile,known)=>{
  const scope=profile.county||'全臺灣（含離島）',terms=signalTerms(profile.signals).map(value=>[value,normalized(value)]);
  const report={provider:'taiwan-tourism',attribution,scope,source_urls:['https://data.gov.tw/dataset/7780','https://data.gov.tw/dataset/7778'],counties_scanned:[],records_scanned:0,qualified_for_verification:0,verified:0,known_skipped:0,market:[],errors:[],analysis_mode:'evidence_rules'};
  const countyCounts=new Map(),buckets=new Map(),market=[];
  const checkedIds=new Set(),existingRecords=new Set(known.map(entry=>entry.record));
  const existingKeys=new Set(known.map(entry=>entry.domain+'|'+entry.branch));
  const processHotel=row=>{
   const county=plain(row.PostalAddress?.City).replace(/台/g,'臺');
   if(!taiwanCounties.includes(county)||(profile.county&&county!==profile.county))return;
   report.records_scanned++;
   countyCounts.set(county,(countyCounts.get(county)||0)+1);
   const id=plain(row.HotelID),company_name=plain(row.HotelName),registration=plain(row.HotelLicenseNumber);
   const description=plain(row.Description),services=plain(row.ServiceInfo);
   if(!idPattern.test(id)||checkedIds.has(id)||row.ServiceStatus!==1||!registration||company_name.length<2||company_name.length>140) return;
   checkedIds.add(id);
   const text=normalized(description+' '+services);
   const matches=terms.filter(([,term])=>text.includes(term)).map(([value])=>value);
   if(!matches.length) return;
   const record_id=id,source_url=detail(id),site=candidateSite(row,source_url);
   const branch_key=site.url===source_url?id:'';
   if(existingRecords.has(id)||existingKeys.has(site.domain+'|')||existingKeys.has(site.domain+'|'+branch_key)){report.known_skipped++;return;}
   const score_components={mode:'daily_research',location:2,official_evidence:3,documented_signals:Math.min(5,2+matches.length)};
   const fit_score=score_components.location+score_components.official_evidence+score_components.documented_signals;
   const entry={id,updated:plain(row.UpdateTime),company_name,county,town:plain(row.PostalAddress?.Town),registration,description,services,matches,record_id,source_url,site,branch_key,fit_score,score_components};
   const bucket=buckets.get(county)||[];
   bucket.push(entry);
   bucket.sort(compareCandidates);
   if(bucket.length>10)bucket.pop();
   buckets.set(county,bucket);
   report.qualified_for_verification++;
  };
  const today=now().getTime();
  const [hotelResult,eventResult]=await Promise.allSettled([archive('Hotel','Hotels',processHotel),archive('Event','Events',row=>{
   const county=plain(row.PostalAddress?.City).replace(/台/g,'臺'),title=plain(row.EventName),id=plain(row.EventID);
   const from=Date.parse(row.StartDateTime),to=Date.parse(row.EndDateTime);
   if(!taiwanCounties.includes(county)||(profile.county&&county!==profile.county)||!title||!idPattern.test(id)||row.EventStatus==='EventCancelled'||!(from<=today+120*86400000&&to>=today))return;
   market.push({title:title.slice(0,200),county,starts_at:row.StartDateTime,ends_at:row.EndDateTime,url:detail(id)});
  })]);
  if(hotelResult.status==='rejected')report.errors.push({step:'business_search',code:providerError(hotelResult.reason)});
  if(eventResult.status==='rejected')report.errors.push({step:'market_events',code:providerError(eventResult.reason)});
  else{
   const eventRank=event=>{
    const starts=Date.parse(event.starts_at);
    return starts>=today?starts-today:120*86400000+(today-starts);
   };
   report.market=market.sort((a,b)=>eventRank(a)-eventRank(b)).slice(0,5);
  }
  report.counties_scanned=taiwanCounties.filter(county=>countyCounts.has(county));
  if(hotelResult.status==='rejected')return {status:'failed',report,candidates:[]};
  if(!profile.county&&report.counties_scanned.length!==taiwanCounties.length)report.errors.push({step:'business_search',code:'provider_county_coverage_incomplete'});
  if(profile.county&&!report.records_scanned)report.errors.push({step:'business_search',code:'provider_county_no_records'});

  const shortlist=rankedAcrossCounties(buckets).slice(0,Math.min(10,profile.daily_limit+4));
  const checks=await Promise.allSettled(shortlist.map(async item=>{
   const response=await agency(item.source_url,'text/html');
   if(!response.ok||!response.headers.get('content-type')?.startsWith('text/html'))throw hqError('provider_response_invalid');
   const html=new TextDecoder().decode(await boundedBytes(response,1_000_000));
   const title=plain(html.match(/<h1\b[^>]*class=["'][^"']*\bcard-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]||html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.split(' :: ')[0]);
   if(!title||normalized(title)!==normalized(item.company_name))throw hqError('company_name_unconfirmed');
   const {company_name,county,town,registration,description,services,matches,source_url,site,branch_key,record_id,fit_score,score_components}=item;
   const checked_at=now().toISOString();
   const feature=matches[0];
   const snippets=[description,services].filter(Boolean);
   const evidenceText=snippets.find(text=>normalized(text).includes(normalized(feature)))||snippets[0];
   const anchor=Math.max(0,evidenceText.indexOf(feature));
   const excerpt=evidenceText.slice(Math.max(0,anchor-150),anchor+450);
   const source={url:source_url,checked_at,excerpt,record_id,county,town,registration,attribution,verified:true,company_name_confirmed:true,
    content_hash:await digest(JSON.stringify({company_name,county,town,registration,description,services}))};
   const draft=`合作提案草稿｜待 HANA 審核\n對象：${company_name}（${county}${town}）\n公開背景：${excerpt}\n建議試點：依 HANA 服務定位「${profile.positioning}」，評估把「${profile.offer}」結合公開資料提到的「${feature}」。\n訪談問題：對方目前如何安排「${feature}」相關體驗？客群是否符合「${profile.ideal_customer}」，有無合適場地和試辦時段？\n需求、預算及合作意願待訪談，尚未聯絡。`;
   return {company_name,website:site.url,canonical_domain:site.domain,branch_key,branch_reason:branch_key?'交通部觀光署公開旅宿 ID':'',source_url,source_checked_at:checked_at,
    evidence:[source],evidence_excerpt_or_summary:excerpt,public_business_contact:null,stage:'proposal_draft',fit_score,score_components,
    fit_reason:`交通部觀光署旅宿資料｜${county}${town}；可核對的服務訊號：${matches.join('、')}。`,draft};
  }));
  const unique=new Map();
  for(const [index,result] of checks.entries()){
   if(result.status==='rejected'){report.errors.push({step:'source_verification',url:shortlist[index].source_url,code:providerError(result.reason)});continue;}
   const row=result.value,key=row.canonical_domain+'|'+row.branch_key;
   report.verified++;
   if(!unique.has(key))unique.set(key,row);
  }
  const candidates=[...unique.values()].slice(0,profile.daily_limit);
  return {status:report.errors.length?'partial':'completed',report,candidates};
 };
}
