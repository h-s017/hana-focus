import {ROLES,instructions,projectReport} from '../../../js/office-workflow.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cors={'Access-Control-Allow-Origin':'https://h-s017.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
export function handler({authenticate,store,generate,ready=()=>true,authorize=user=>user.app_metadata?.hana_office_access===true}) {
 return async req=>{
  if(req.headers.get('origin') && req.headers.get('origin')!=='https://h-s017.github.io')return json({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'login_required'},401);
  let user;
  try{user=await authenticate(auth.slice(7));}catch{return json({error:'invalid_session'},401);}
  if(!user?.id)return json({error:'invalid_session'},401);
  if(!authorize(user))return json({error:'office_access_required'},403);
  let body;
  try {const text=await req.text();if(text.length>16000)return json({error:'body_too_large'},413);body=JSON.parse(text);}catch{return json({error:'invalid_json'},400);}
  if(!body || !UUID.test(body.task_id||''))return json({error:'invalid_task_id'},400);
  if(!['generate','review','handoff','recover','requeue'].includes(body.action))return json({error:'invalid_action'},400);
  let task;
  try{task=await store.getTask(user.id,body.task_id);}catch{return json({error:'database_unavailable'},503);}
  if(!task)return json({error:'task_not_found'},404);
  try {
   if(body.action==='review') {
    if(!['approved','rejected'].includes(body.decision))return json({error:'invalid_decision'},400);
    await store.review(user.id,task.id,body.decision,String(body.note||'').slice(0,2000));
    return json({status:body.decision,external_delivery:false});
   }
   if(body.action==='recover'||body.action==='requeue') {
    const status=await store[body.action](user.id,task.id);return json({status});
   }
   if(body.action==='generate'&&task.project_id)return json({error:'use_focus_tools'},409);
   if(!UUID.test(body.request_id||''))return json({error:'request_id_required'},400);
   if(body.action==='handoff')return json({task_id:await store.handoff(user.id,task.id,body.request_id),status:'queued'});
   if(!task.project||task.project.length>100||!task.title||task.title.length>140||!task.brief||task.brief.length>12000)return json({error:'invalid_brief'},400);
   if(!ROLES.includes(task.role))return json({error:'invalid_role'},400);
   if(!['queued','failed'].includes(task.status))return json({error:'state_conflict'},409);
   const useAI=ready();
   if(task.role!=='Project Manager'&&!useAI)return json({error:'ai_not_configured'},503);
   const run=await store.claim(user.id,task.id,body.request_id);
   let result;
   try {
    result=task.role==='Project Manager'&&!useAI?projectReport(task):await generate({instructions:instructions(task.role,task),input:JSON.stringify({project:task.project,title:task.title,brief:task.brief})});
    if(typeof result!=='string'||!result.trim())throw Error('empty_result');
    if(useAI)result='AI 草稿｜'+task.role+'（待本人審核，非客戶核准）\n'+result;
    if(result.length>50000)throw Error('result_too_large');
   } catch(error) {
    const code=error?.name==='TimeoutError'||error?.name==='AbortError'?'provider_timeout':'provider_failed';
    await store.finish(user.id,task.id,run,null,code);
    return json({error:code,status:'failed',run_id:run},502);
   }
   await store.finish(user.id,task.id,run,result,null);
   return json({status:'review',run_id:run,mode:useAI?'ai':'rules'});
  }catch(error){return json({error:error?.conflict?'state_conflict':'operation_failed',requires_refresh:true},error?.conflict?409:503);}
 };
}
