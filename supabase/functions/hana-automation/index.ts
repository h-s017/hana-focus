import {automationStore} from './store.mjs';
import {microsoft,cipher} from './microsoft.mjs';
import {calendarPreview} from './calendar.mjs';
import {reservationReader} from './reservations.mjs';
import {bookingService} from './booking.mjs';
import {workService} from './work.mjs';
import {control} from './control.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const {store,authenticate}=automationStore({url:env('SUPABASE_URL'),service:env('SUPABASE_SERVICE_ROLE_KEY')});
const readiness=()=>({worker:env('HANA_AUTOMATION_ENABLED')!=='false',mode:'rules',paid_calls_enabled:false,microsoft:!!env('MICROSOFT_CLIENT_ID')&&!!env('HANA_CONNECTOR_ENCRYPTION_KEY'),calendar:!!env('GOOGLE_CLIENT_ID')&&!!env('GOOGLE_CLIENT_SECRET')&&!!env('GOOGLE_CALENDAR_REFRESH_TOKEN')&&!!env('GOOGLE_CALENDAR_OWNER_ID')&&!!env('HANA_CONNECTOR_ENCRYPTION_KEY')});
const connector=readiness().microsoft?microsoft({clientId:env('MICROSOFT_CLIENT_ID'),tenant:env('MICROSOFT_TENANT')||'consumers',store,encryption:cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'))}):null;
// HANA budget NT$0: no callable paid provider implementation in this release.
const calendar=readiness().calendar?calendarPreview({clientId:env('GOOGLE_CLIENT_ID'),clientSecret:env('GOOGLE_CLIENT_SECRET'),seedRefreshToken:env('GOOGLE_CALENDAR_REFRESH_TOKEN'),ownerId:env('GOOGLE_CALENDAR_OWNER_ID'),calendarId:env('GOOGLE_CALENDAR_ID')||'primary',store,encryption:cipher(env('HANA_CONNECTOR_ENCRYPTION_KEY'))}):null;
const reservations=reservationReader({token:env('RESERVATION_ADMIN_TOKEN'),store});
const controls=control({store,authenticate,connector,readiness,calendarPreview:calendar,booking:bookingService({store,reservations}),reservations,work:workService({store,reservations,calendarPreview:calendar})});
// This function performs its own per-request Auth validation; the NT$0 cron runs SQL locally.
// every user action validates the bearer with Supabase Auth and trusted app_metadata.
// Existing hana-agent retains verify_jwt=true and its paid-call switch remains off.
Deno.serve((req:Request)=>controls(req));
