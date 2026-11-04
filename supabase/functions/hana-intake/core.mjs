const ORIGIN='https://quiz.hanascent.com';
export const SCRIPT='https://script.google.com/macros/s/AKfycbzZ-i9zat_U57yJmHkTnEhIYsxNU3l5UMpmHCLkivz06PVtrccQhfS6SzTwnoewTO5t/exec';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function intakePayload(d){
 const str=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('invalid');return v.trim();};
 const arr=(v,max)=>{if(!Array.isArray(v)||v.length>max)throw Error('invalid');return v.map(x=>str(x,120));};
 if(!d||!uuid(d.submissionId)||d.website||d.formType!=='course_intake_only')throw Error('invalid');
 const name=str(d.name,50);if(!name)throw Error('invalid');
 const submittedAt=str(d.submittedAt,40);if(!Number.isFinite(Date.parse(submittedAt)))throw Error('invalid');
 const consentText=str(d.consentText,500);if(!consentText)throw Error('invalid');
 return {submissionId:d.submissionId,formType:'course_intake_only',submittedAt,name,gender:str(d.gender,30),courses:arr(d.courses,20),purpose:arr(d.purpose,20),favoritePerfume:str(d.favoritePerfume,1000),preferredFamily:arr(d.preferredFamily,30),studyMore:str(d.studyMore,1000),consentText,profile:{type:'未進行人格測驗'},scores:{},answerLog:[]};
}
export function intakeHandler({store,ownerId,hash,fetcher=fetch}){
 const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body,status=200)=>Response.json(body,{status,headers});
 return async req=>{
  if(req.headers.get('origin')!==ORIGIN)return reply({error:'origin'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'method'},405);
  if(!ownerId)return reply({error:'setup'},503);
  let d;try{const raw=await req.text();if(raw.length>20000)return reply({error:'size'},413);d=intakePayload(JSON.parse(raw));}catch{return reply({error:'invalid'},400);}
  try{
   const digest=await hash(JSON.stringify(d));
   // A keyed digest never stores the raw network address. Only the gateway-provided address is used.
   const ipHash=await hash('rate:'+new Date().toISOString().slice(0,10)+':'+(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown'));
   const claim=await store.claim({p_id:d.submissionId,p_owner:ownerId,p_digest:digest,p_name:d.name,p_courses:d.courses,p_ip_hash:ipHash});
   if(claim.state==='saved')return reply({ok:true,submissionId:d.submissionId});
   if(claim.state!=='claimed')return reply({error:claim.state==='rate_limited'?'rate_limited':'processing'},429);
   let ack;
   try{const r=await fetcher(SCRIPT,{method:'POST',redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(d)});if(!r.ok)throw Error();const raw=await r.text();if(raw.length>2000)throw Error();ack=JSON.parse(raw);if(ack.status!=='success'||ack.submissionId!==d.submissionId||!Number.isInteger(ack.row)||ack.row<2)throw Error();}
   catch{await store.finish(d.submissionId,claim.lease,{status:'failed',error_code:'sheet_not_verified'});return reply({error:'save_not_verified'},503);}
   await store.finish(d.submissionId,claim.lease,{status:'saved',source_row:ack.row,error_code:null});
   return reply({ok:true,submissionId:d.submissionId});
  }catch{return reply({error:'save_not_verified'},503);}
 };
}
