import {handler} from './core.mjs';
import {databaseAdapter} from './store.mjs';
// Native HTTP adapter: no runtime npm dependency or credential in the public bundle.
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const apiKey=Deno.env.get('OPENAI_API_KEY');
const {authenticate,store}=databaseAdapter({url,service});
Deno.serve(handler({
 authenticate,store,
 // HANA approved release: paid AI is disabled even if a server key already exists.
 ready:()=>false,
 authorize:(user:{id:string;app_metadata?:Record<string,unknown>})=>user.app_metadata?.hana_office_access===true || (Deno.env.get('HANA_OWNER_IDS')||'').split(',').map(x=>x.trim()).filter(Boolean).includes(user.id),
 generate:async({instructions,input}:{instructions:string;input:string})=>{
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('OPENAI_MODEL')||'gpt-4.1-mini',instructions,input,max_output_tokens:1800})});
  if(!res.ok)throw Error('provider_failed');
  const data=await res.json();const output:string[]=[];
  for(const item of data.output||[])for(const part of item.content||[])if(part.type==='output_text' && typeof part.text==='string')output.push(part.text);
  return output.join('\n');
 }
}));
