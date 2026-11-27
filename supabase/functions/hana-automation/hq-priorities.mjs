const directions=[
 ['small-batch','B2B 小量香氛製作','品牌 新開幕 新品 空間選物'],
 ['brand-incubation','香氛品牌孵化與產品開發','品牌延伸 生活風格 新系列'],
 ['team-workshop','企業團體調香課程','企業 員工活動 品牌體驗'],
 ['vip','品牌 VIP 活動與嗅覺體驗','會員活動 品牌 VIP 新開幕'],
 ['kpia','KPIA 專業調香課程合作','專業培訓 調香 課程合作'],
 ['overture','氣味藝術序曲課程合作','文化館所 藝術課程 感官工作坊'],
 ['identity','品牌嗅覺識別與跨域藝術合作','空間設計 策展 品牌合作'],
];

export const defaultBusinessProfile={
 positioning:'Hana Scent Artist 提供香氛產品設計、調香課程、品牌嗅覺體驗與跨域藝術合作。',
 ideal_customer:'具公開近期商業動態的臺灣品牌、企業、旅宿、文化場館及教育合作方。依公開證據評估近期試點。',
 offer:directions.map(([,label])=>label).join('、'),
 county:'',signals:'新開幕、新品、企業活動、會員活動、親子體驗、藝術課程、聯名、策展、會議',
 daily_limit:5,run_at:'08:00',enabled:false,
};

export function selectBusinessDirection(recent,market){
 const text=market.map(event=>event.title).join(' ');
 const scored=directions.map(([id,label,query],rank)=>{
  const prior=recent.filter(run=>run.direction===id);
  const matching=query.split(' ').filter(term=>text.includes(term));
  return {id,label,query,matching,rank,score:matching.length*2-prior.length*5+Math.min(2,prior.reduce((sum,run)=>sum+run.saved,0))};
 });
 return scored.sort((a,b)=>b.score-a.score||a.rank-b.rank)[0];
}

export async function discoverBusinessSources({discovery,reader,direction,scope,known,limit}){
 const matches=await discovery.find({industry:direction.query,region:scope,services:direction.offer||direction.label,limit:Math.min(10,limit+3)},known.map(entry=>entry.domain));
 const results=await Promise.allSettled(matches.map(async match=>{
  const {url,checked_at,excerpt,content_hash,public_business_contact}=await reader.read(match);
  return {...match,source_url:url,source_checked_at:checked_at,public_business_contact,branch_key:'',
   stage:'proposal_draft',evidence_excerpt_or_summary:excerpt,
   evidence:[{url,checked_at,excerpt,content_hash,verified:true,company_name_confirmed:true,industry_search:direction.query,website_checked:true}]};
 }));
 return {candidates:results.flatMap(row=>row.status==='fulfilled'?[row.value]:[]),
  errors:results.flatMap((row,index)=>row.status==='rejected'?[{step:'source_verification',url:matches[index].source_url,code:row.reason?.code||'hq_source_unavailable'}]:[])};
}
