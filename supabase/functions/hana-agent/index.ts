import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
import {handler} from './core.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const apiKey=Deno.env.get('OPENAI_API_KEY');
async function rpc(name:string,args:Record<string,unknown>){
 const {data,error}=await admin.rpc(name,args);
 if(error){const e=new Error('database_operation_failed');Object.assign(e,{conflict:['P0001','23505'].includes(error.code)});throw e;}return data;
}
const store={
 async getTask(owner:string,id:string){const {data,error}=await admin.from('hana_tasks').select('id,owner_id,project,role,title,brief,status,parent_task_id').eq('id',id).eq('owner_id',owner).maybeSingle();if(error)throw Error('database_read_failed');return data;},
 claim:(o:string,t:string,r:string)=>rpc('hana_claim_task',{p_owner:o,p_task:t,p_request:r}),
 finish:(o:string,t:string,r:string,result:string|null,error:string|null)=>rpc('hana_finish_task',{p_owner:o,p_task:t,p_run:r,p_result:result,p_error:error}),
 review:(o:string,t:string,d:string,n:string)=>rpc('hana_review_task',{p_owner:o,p_task:t,p_decision:d,p_note:n}),
 handoff:(o:string,t:string,r:string)=>rpc('hana_handoff_task',{p_owner:o,p_task:t,p_request:r}),
 recover:(o:string,t:string)=>rpc('hana_recover_task',{p_owner:o,p_task:t}),
 requeue:(o:string,t:string)=>rpc('hana_requeue_task',{p_owner:o,p_task:t}),
};
Deno.serve(handler({
 authenticate:async(token:string)=>{const {data:{user},error}=await admin.auth.getUser(token);return error?null:user;},store,
 ready:()=>Boolean(apiKey),
 authorize:(user:{id:string;app_metadata?:Record<string,unknown>})=>user.app_metadata?.hana_office_access===true || (Deno.env.get('HANA_OWNER_IDS')||'').split(',').map(x=>x.trim()).filter(Boolean).includes(user.id),
 generate:async({instructions,input}:{instructions:string;input:string})=>{
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL')||'gpt-4.1-mini',instructions,input,max_output_tokens:1800})});
  if(!res.ok)throw Error('provider_failed');
  const data=await res.json();
  const output:string[]=[];
  for(const item of data.output||[])for(const part of item.content||[])if(part.type==='output_text' && typeof part.text==='string')output.push(part.text);
  return output.join('\n');
 }
}));
