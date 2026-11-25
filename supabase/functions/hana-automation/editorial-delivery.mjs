const kinds=new Set(['sensory','service_marketing','founder_story']);
const sections=['封面','概念','原理','延伸','案例','應用','結語'];
const valid=value=>typeof value==='string'&&Boolean(value.trim());
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dayPattern=/^20\d{2}-\d{2}-\d{2}$/;
const editorialDate=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const timeDigest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const verifiedServicePaths=new Set(['/product-development/','/enterprise-fragrance-workshop/','/courses/','/overture/']);

function serviceLink(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='hanascent.com'&&!url.username&&!url.password;}
 catch{return false;}
}
export async function checkEditorialSources(_owner,kind,content,fetcher=fetch){
 if(kind!=='service_marketing'||!serviceLink(content.service_url))return {};
 const url=new URL(content.service_url);
 if(!verifiedServicePaths.has(url.pathname)||url.search||url.hash||url.port)return {};
 try{
  const response=await fetcher(url.href,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(8000)});
  return {serviceLinkVerified:response.ok,service_url:url.href,checked_at:new Date().toISOString()};
 }catch{return {serviceLinkVerified:false};}
}

export function editorialAssessment(kind,content,proof={}){
 const missing=[];
 const text=(field,message=field)=>{if(!valid(content[field]))missing.push(message);};
 text('title');text('topic_id');
 if(kind==='sensory'){
  for(const field of ['objective','audience','caption'])text(field);
  if(!Array.isArray(content.pages)||content.pages.length!==7||sections.some((section,index)=>content.pages[index]?.section!==section||!valid(content.pages[index]?.title)||!valid(content.pages[index]?.body)))missing.push('seven_teaching_pages');
  const palette=content.visuals?.palette;
  if(!Array.isArray(palette)||palette.length<4||palette.length>6||new Set(palette).size!==palette.length||palette.some(color=>!/^#[A-F0-9]{6}$/.test(color)))missing.push('issue_palette');
  if(!content.music||!['composer','work','reason','recording_rights'].every(field=>valid(content.music[field])))missing.push('classical_music');
 }
 if(kind==='service_marketing'){
  for(const field of ['audience','body','seo_title','seo_description','instagram_caption','facebook_caption','cta'])text(field);
  if(!serviceLink(content.service_url)||proof.serviceLinkVerified!==true)missing.push('service_source');
 }
 if(kind==='founder_story'&&(!valid(content.body)||[...content.body].length<25||[...content.body].length>70))missing.push('original_story_copy');
 if(kind!=='founder_story'&&(!Array.isArray(content.hashtags)||!content.hashtags.length||content.hashtags.some(tag=>!/^#[\p{L}\p{N}_]+$/u.test(tag))))missing.push('hashtags');
 const target=kind==='sensory'?7:1,height=kind==='founder_story'?1920:1350;
 const images=proof.images;
 if(!Array.isArray(images)||images.length!==target||new Set(images.map(image=>image.sha256)).size!==target||images.some((image,index)=>image.page!==index+1||image.width!==1080||image.height!==height||image.format!=='png'||!image.original||!image.readback||!(/^[a-f0-9]{64}$/i.test(image.sha256))))missing.push('verified_original_png');
 if(kind==='founder_story'&&(proof.storyComposite?.readback!==true||proof.storyComposite.width!==1080||proof.storyComposite.height!==1920))missing.push('story_composite');
 if(kind!=='founder_story'&&(!Array.isArray(proof.altText)||proof.altText.length!==target||proof.altText.some(value=>!valid(value))))missing.push('verified_alt_text');
 // The Media/Canva verifier is a server adapter, never a field copied from a job or the browser.
 const design=proof.canva;
 if(!design&&kind==='service_marketing'&&proof.canvaAvailable===false){/* Canva is optional for a marketing article with a verified visual. */}
 else if(!design||design.readback!==true||design.editableLayers!==true||design.pageCount!==target||!/^[-\w]{6,64}$/.test(design.id||'')||!/^https:\/\/www\.canva\.com\/(?:design\/[-\w]+\/edit|d\/[-\w]+)$/.test(design.editUrl||''))missing.push('verified_canva_design');
 if(proof.visualQA!==true)missing.push('visual_quality_review');
 return missing;
}

/** @param {{store:any,owner:string,token:string,enabled:boolean,verify?:(owner:string,kind:string,content:any,proof:any)=>Promise<Record<string,any>>,now?:()=>Date}} options */
export function editorialDelivery({store,owner,token,enabled,verify,now=()=>new Date()}){
 const authorized=async supplied=>{
  if(!enabled||!owner||token.length<32||supplied.length!==token.length)return false;
  const [left,right]=await Promise.all([timeDigest(supplied),timeDigest(token)]);
  let difference=0;for(let i=0;i<left.length;i++)difference|=left[i]^right[i];return difference===0;
 };
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 async function worker(req){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!await authorized(req.headers.get('x-hana-editorial-worker')||''))return json({error:'unauthorized'},401);
  try{
   const text=await req.text();if(text.length>115000)return json({error:'editorial_input_too_large'},413);
   const body=JSON.parse(text||'{}');
   if(body.action==='history')return json({entries:await store.editorialList(owner)});
   if(!kinds.has(body.kind)||!dayPattern.test(body.date)||Number.isNaN(Date.parse(body.date))||body.date>editorialDate(now()))return json({error:'editorial_invalid'},400);
   if(body.action==='claim')return json(await store.editorialClaim(owner,body.date,body.kind));
   if(body.action!=='finish'||!idPattern.test(body.id||'')||!body.content||Array.isArray(body.content)||typeof body.content!=='object')return json({error:'editorial_invalid'},400);
   const record=await store.editorialGet(owner,body.id);
   if(record?.kind!==body.kind||record.local_day!==body.date||record.state!=='running')return json({error:'editorial_conflict'},409);
   const content=body.content;
   const proof=verify?await verify(owner,body.kind,content,body.evidence):{};
   const missing=editorialAssessment(body.kind,content,proof);
   const stage=body.failed===true?'failed':body.blocked===true||!valid(content.title)?'blocked':missing.length?'partial':'ready_for_review';
   const reason=/^[a-z][a-z_0-9]{1,60}$/.test(body.reason||'')?body.reason:null;
   return json(await store.editorialFinish(owner,body.id,stage,content,{...proof,verified:stage==='ready_for_review'},missing,reason));
  }catch{return json({error:'editorial_worker_unavailable'},503);}
 }
 async function account(owner,body){
  if(body.workspace!=='work')throw Error('editorial_work_only');
  if(body.action==='editorial_snapshot')return {entries:await store.editorialList(owner)};
  if(body.action!=='editorial_decide'||!idPattern.test(body.id||'')||!['approve','revise','retry'].includes(body.decision)||typeof (body.note??'')!=='string'||(body.note||'').length>2000)throw Error('editorial_invalid');
  return store.editorialDecide(owner,body.id,body.decision,body.note||'');
 }
 return {worker,account};
}
