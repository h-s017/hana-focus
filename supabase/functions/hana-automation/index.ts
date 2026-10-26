import {googleOAuth} from './google-oauth.mjs';
import {focusService} from './focus.mjs';
import {notionSource} from './notion-source.mjs';
import {reservationInventory} from './reservation-inventory.mjs';
import {monthlyService,monthlyWorker} from './monthly.mjs';
import {automationStore} from './store.mjs';
import {microsoft,cipher} from './microsoft.mjs';
import {calendarPreview,calendarSources} from './calendar.mjs';
import {reservationReader} from './reservations.mjs';
import {bookingService} from './booking.mjs';
import {control} from './control.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const {store,authenticate}=automationStore({url:env('SUPABASE_URL'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
let encryption=null;try{if(env('HANA_CONNECTOR_ENCRYPTION_KEY'))encryption=cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'));}catch{}
const googleConfigured=()=>!!env('GOOGLE_CLIENT_ID')&&!!env('GOOGLE_CLIENT_SECRET')&&!!env('GOOGLE_CALENDAR_OWNER_ID')&&!!encryption;
const readiness=()=>({worker:env('HANA_AUTOMATION_ENABLED')!=='false',mode:'rules',paid_calls_enabled:false,microsoft:!!env('MICROSOFT_CLIENT_ID')&&!!encryption,google_oauth:googleConfigured(),google_setup:{client_id:!!env('GOOGLE_CLIENT_ID'),client_secret:!!env('GOOGLE_CLIENT_SECRET'),owner:!!env('GOOGLE_CALENDAR_OWNER_ID'),encryption:!!encryption},calendar:googleConfigured()});
const connector=readiness().microsoft?microsoft({clientId:env('MICROSOFT_CLIENT_ID'),tenant:env('MICROSOFT_TENANT')||'consumers',store,encryption}):null;
// HANA budget NT$0: no callable paid provider implementation in this release.
const calendar=readiness().calendar?calendarPreview({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption}):null;
const reservations=reservationReader({token:env('RESERVATION_ADMIN_TOKEN'),store});
const monthlyOptions={maxWindowDays:32,clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption};
const monthly=monthlyService({store,readReservations:()=>reservationInventory(),readSources:readiness().calendar?calendarSources(monthlyOptions):null});
const worker=monthlyWorker({store,run:monthly,enabled:()=>env('HANA_MONTHLY_SCHEDULE_ENABLED')==='true',verify:async (token:string)=>{const secret=env('HANA_MONTHLY_WORKER_TOKEN');if(secret.length<32||token.length!==secret.length)return false;const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));const a=await hash(token),b=await hash(secret);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}});
const focus=focusService({store,readCalendar:readiness().calendar?calendarSources(monthlyOptions):null,notion:notionSource({token:env('NOTION_TOKEN'),ownerId:env('HANA_NOTION_OWNER_ID')})});
const google=googleOAuth({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),store,encryption});
const controls=control({googleOAuth:google,store,authenticate,connector,readiness,calendarPreview:calendar,booking:bookingService({store,reservations}),reservations,monthly,focus});
// This function performs its own per-request Auth validation; the NT$0 cron runs SQL locally.
// every user action validates the bearer with Supabase Auth and trusted app_metadata.
// Existing hana-agent retains verify_jwt=true and its paid-call switch remains off.
Deno.serve((req:Request)=>new URL(req.url).pathname.endsWith('/monthly-worker')?worker(req):controls(req));

