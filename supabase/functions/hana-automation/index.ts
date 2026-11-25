import {googleOAuth} from './google-oauth.mjs';
import {canvaOAuth} from './canva-oauth.mjs';
import {canvaApiClient} from './canva-import-api.mjs';
import {canvaImportRunner} from './canva-import-runner.mjs';
import {focusService} from './focus.mjs';
import {agentProvider} from './agent-provider.mjs';
import {notionSource} from './notion-source.mjs';
import {reservationInventory} from './reservation-inventory.mjs';
import {monthlyService,monthlyWorker} from './monthly.mjs';
import {automationStore} from './store.mjs';
import {microsoft,cipher} from './microsoft.mjs';
import {calendarPreview,calendarSources} from './calendar.mjs';
import {calendarSyncService} from './calendar-sync.mjs';
import {googleSyncApi,reservationSyncApi} from './calendar-sync-api.mjs';
import {reservationReader} from './reservations.mjs';
import {bookingService} from './booking.mjs';
import {control} from './control.mjs';
import {businessHQ} from './hq.mjs';
import {publicBusinessDiscovery} from './hq-discovery.mjs';
import {businessAnalysis} from './hq-analysis.mjs';
import {hqStore} from './hq-store.mjs';
import {publicSourceReader} from './hq-source.mjs';
import {proactiveHQ} from './hq-proactive.mjs';
import {nationwideResearch} from './hq-national-research.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const {store,authenticate}=automationStore({url:env('SUPABASE_URL'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
let encryption=null;try{if(env('HANA_CONNECTOR_ENCRYPTION_KEY'))encryption=cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'));}catch{}
const canvaConfigured=()=>!!env('CANVA_CLIENT_ID')&&!!env('CANVA_CLIENT_SECRET')&&!!env('CANVA_OWNER_ID')&&!!encryption;
const googleConfigured=()=>!!env('GOOGLE_CLIENT_ID')&&!!env('GOOGLE_CLIENT_SECRET')&&!!env('GOOGLE_CALENDAR_OWNER_ID')&&!!encryption;
const readiness=()=>({worker:env('HANA_AUTOMATION_ENABLED')!=='false',mode:'rules',paid_calls_enabled:false,microsoft:!!env('MICROSOFT_CLIENT_ID')&&!!encryption,google_oauth:googleConfigured(),google_setup:{client_id:!!env('GOOGLE_CLIENT_ID'),client_secret:!!env('GOOGLE_CLIENT_SECRET'),owner:!!env('GOOGLE_CALENDAR_OWNER_ID'),encryption:!!encryption},calendar:googleConfigured(),canva_oauth:canvaConfigured(),canva_setup:{client_id:!!env('CANVA_CLIENT_ID'),client_secret:!!env('CANVA_CLIENT_SECRET'),owner:!!env('CANVA_OWNER_ID'),encryption:!!encryption}});
const connector=readiness().microsoft?microsoft({clientId:env('MICROSOFT_CLIENT_ID'),tenant:env('MICROSOFT_TENANT')||'consumers',store,encryption}):null;
// Scheduled workers remain rules-only. The provider is available solely for explicit task requests.
const generate=agentProvider({enabled:env('HANA_ON_DEMAND_AI_ENABLED')==='true',apiKey:env('OPENAI_API_KEY'),model:env('OPENAI_MODEL')});
const calendar=readiness().calendar?calendarPreview({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption}):null;
const reservations=reservationReader({token:env('RESERVATION_ADMIN_TOKEN'),store,ownerId:env('GOOGLE_CALENDAR_OWNER_ID')});
const monthlyOptions={maxWindowDays:32,clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption};
const monthly=monthlyService({store,readReservations:()=>reservationInventory(),readSources:readiness().calendar?calendarSources(monthlyOptions):null});
const worker=monthlyWorker({store,run:monthly,enabled:()=>env('HANA_MONTHLY_SCHEDULE_ENABLED')==='true',verify:async (token:string)=>{const secret=env('HANA_MONTHLY_WORKER_TOKEN');if(secret.length<32||token.length!==secret.length)return false;const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));const a=await hash(token),b=await hash(secret);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}});
const focus=focusService({store,generate,readCalendarEvents:readiness().calendar?calendarSources({...monthlyOptions,includeDetails:true,includeReservations:false}):null,readCalendar:readiness().calendar?calendarSources({...monthlyOptions,includeReservations:false}):null,notion:notionSource({token:env('NOTION_TOKEN'),ownerId:env('HANA_NOTION_OWNER_ID')})});
const google=googleOAuth({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),store,encryption});
const canva=canvaOAuth({clientId:env('CANVA_CLIENT_ID'),clientSecret:env('CANVA_CLIENT_SECRET'),ownerId:env('CANVA_OWNER_ID'),store,encryption});
const syncEnabled=env('HANA_CALENDAR_SYNC_ENABLED')==='true';
const googleSync=syncEnabled?googleOAuth({...monthlyOptions,sync:true}):null;
const calendarSync=calendarSyncService({ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),store,enabled:syncEnabled,google:googleSyncApi(monthlyOptions),reservations:reservationSyncApi({token:env('RESERVATION_SYNC_TOKEN')})});
const businessStore=hqStore({url:env('SUPABASE_URL'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
const proactive=proactiveHQ({store:businessStore,research:nationwideResearch(),owner:env('HANA_HQ_WORKER_OWNER_ID'),
 enabled:env('HANA_HQ_SCHEDULE_ENABLED')==='true',secret:env('HANA_HQ_WORKER_TOKEN'),
 analyze:businessAnalysis(agentProvider({enabled:env('HANA_HQ_SCHEDULE_AI_ENABLED')==='true',apiKey:env('OPENAI_API_KEY'),model:env('HANA_HQ_ANALYSIS_MODEL')}))});
const hq=businessHQ({
 store:businessStore,
 sourceReader:publicSourceReader({allowedHosts:env('HANA_HQ_SOURCE_HOSTS').split(',').map(s=>s.trim()).filter(Boolean)}),
 discovery:publicBusinessDiscovery({enabled:env('HANA_HQ_DISCOVERY_ENABLED')==='true',apiKey:env('BRAVE_SEARCH_API_KEY')}),
 analyze:businessAnalysis(agentProvider({enabled:env('HANA_HQ_ANALYSIS_ENABLED')==='true',apiKey:env('OPENAI_API_KEY'),model:env('HANA_HQ_ANALYSIS_MODEL')})),
 recordDiscovery:async(owner,count)=>{await store.event(owner,'Business HQ',null,null,'hq_discovery_completed',{candidate_count:count,provider:'brave',external_delivery:false});},
});
const controls=control({businessHQ:(owner:string,body:{action:string})=>['hq_profile','hq_profile_save'].includes(body.action)?proactive.account(owner,body):hq(owner,body),googleSyncOAuth:googleSync,calendarSync,canvaOAuth:canva,googleOAuth:google,store,authenticate,connector,readiness,calendarPreview:calendar,booking:bookingService({store,reservations}),reservations,monthly,focus});
// This function performs its own per-request Auth validation; the NT$0 cron runs SQL locally.
// every user action validates the bearer with Supabase Auth and trusted app_metadata.
// Existing hana-agent retains verify_jwt=true and its paid-call switch remains off.
const canvaRunner=canvaImportRunner({
 ownerId:env('CANVA_OWNER_ID'),store,
 api:canvaApiClient({store,encryption,clientId:env('CANVA_CLIENT_ID'),clientSecret:env('CANVA_CLIENT_SECRET')})
});
async function canvaScheduledRequest(req:Request){
 const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 let allowed=false;
 try{allowed=await store.canvaWorkerAuthorized(req.headers.get('x-hana-canva-worker')||'');}catch{}
 if(!allowed)return respond({error:'unauthorized'},401);
 try{return respond(await canvaRunner());}
 catch(error){return respond({error:'canva_worker_unavailable'},503);}
}
Deno.serve((req:Request)=>{
 const route=new URL(req.url).pathname;
 if(route.endsWith('/monthly-worker'))return worker(req);
 if(route.endsWith('/canva-worker'))return canvaScheduledRequest(req);
 if(route.endsWith('/hq-worker'))return proactive.worker(req);
 return controls(req);
});


