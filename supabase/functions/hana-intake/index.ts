import {intakeHandler} from './core.mjs';
const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rest(path:string,body:unknown,method='POST'){
 const r=await fetch(base+'/rest/v1/'+path,{method,signal:AbortSignal.timeout(15000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('database');return r.json();
}
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const store={claim:(body:unknown)=>rest('rpc/hana_intake_claim',body),async finish(id:string,lease:string,patch:unknown){const rows=await rest('hana_intake_receipts?'+new URLSearchParams({id:'eq.'+id,lease_token:'eq.'+lease}),{...patch as object,updated_at:new Date().toISOString()},'PATCH');if(rows.length!==1)throw Error('lease');}};
Deno.serve(intakeHandler({store,hash,ownerId:Deno.env.get('GOOGLE_CALENDAR_OWNER_ID')}));
