import {automationStore} from './store.mjs';
import {tick,workerHandler} from './runtime.mjs';
import {microsoft,cipher} from './microsoft.mjs';
import {calendarPreview} from './calendar.mjs';
import {control} from './control.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const {store,authenticate}=automationStore({url:env('SUPABASE_URL'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
const readiness=()=>({worker:env('HANA_AUTOMATION_ENABLED')==='true'&&!!env('OPENAI_API_KEY')&&!!env('OPENAI_MODEL')&&env('HANA_WORKER_TOKEN').length>=32,microsoft:!!env('MICROSOFT_CLIENT_ID')&&!!env('HANA_CONNECTOR_ENCRYPTION_KEY'),paid_calls_enabled:env('HANA_AUTOMATION_ENABLED')==='true',calendar:!!env('GOOGLE_CLIENT_ID')&&!!env('GOOGLE_CLIENT_SECRET')&&!!env('GOOGLE_CALENDAR_REFRESH_TOKEN')&&!!env('GOOGLE_CALENDAR_OWNER_ID')&&!!env('HANA_CONNECTOR_ENCRYPTION_KEY')});
const connector=readiness().microsoft?microsoft({clientId:env('MICROSOFT_CLIENT_ID'),tenant:env('MICROSOFT_TENANT')||'consumers',store,encryption:cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'))}):null;
const generate=async({instructions,input}:{instructions:string;input:string})=>{
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:'Bearer '+env('OPENAI_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify({model:env('OPENAI_MODEL'),instructions,input,max_output_tokens:1800,store:false})});
 if(!response.ok)throw Error('provider_failed');
 const data=await response.json();if(data.status!=='completed')throw Error('provider_incomplete');
 return (data.output||[]).flatMap((item:{content?:Array<{type:string;text?:string}>})=>(item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text||'')).join('\n');
};
const worker=workerHandler({secret:env('HANA_WORKER_TOKEN'),enabled:()=>readiness().worker,tick:()=>tick({store,generate,sources:(owner:string,root:string)=>{if(!connector)throw Object.assign(Error('source_unavailable'),{code:'source_unavailable'});return connector.snapshot(owner,root);},enabled:readiness().worker,cap:Math.min(10,Math.max(1,Number(env('HANA_DAILY_RUN_CAP'))||3))})});
const calendar=readiness().calendar?calendarPreview({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption:cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'))}):null;
const controls=control({store,authenticate,connector,readiness,calendarPreview:calendar});
// Deploy THIS function with verify_jwt=false: worker uses a separate strong secret;
// every user action validates the bearer with Supabase Auth and trusted app_metadata.
// Existing hana-agent retains verify_jwt=true and its paid-call switch remains off.
Deno.serve((req:Request)=>req.headers.has('x-hana-worker-token')?worker(req):controls(req));
