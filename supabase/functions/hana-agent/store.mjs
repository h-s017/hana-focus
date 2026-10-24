// Server-only adapter. Never import this module from the static frontend.
export function databaseAdapter({url,service,fetcher=fetch}) {
 async function request(path,method,body,token=service){
  const response=await fetcher(url+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok){const e=new Error('database_operation_failed');Object.assign(e,{conflict:['P0001','23505'].includes(data?.code)});throw e;}
  return data;
 }
 const rpc=(name,args)=>request('/rest/v1/rpc/'+name,'POST',args);
 return {
  authenticate:token=>request('/auth/v1/user','GET',undefined,token),
  store:{
   async getTask(owner,id){const query=new URLSearchParams({select:'id,owner_id,project,role,title,brief,status,parent_task_id',id:'eq.'+id,owner_id:'eq.'+owner,limit:'1'});const rows=await request('/rest/v1/hana_tasks?'+query,'GET');return rows[0]||null;},
   claim:(o,t,r)=>rpc('hana_claim_task',{p_owner:o,p_task:t,p_request:r}),
   finish:(o,t,r,result,error)=>rpc('hana_finish_task',{p_owner:o,p_task:t,p_run:r,p_result:result,p_error:error}),
   review:(o,t,d,n)=>rpc('hana_review_task',{p_owner:o,p_task:t,p_decision:d,p_note:n}),
   handoff:(o,t,r)=>rpc('hana_handoff_task',{p_owner:o,p_task:t,p_request:r}),
   recover:(o,t)=>rpc('hana_recover_task',{p_owner:o,p_task:t}),
   requeue:(o,t)=>rpc('hana_requeue_task',{p_owner:o,p_task:t}),
  }
 };
}
