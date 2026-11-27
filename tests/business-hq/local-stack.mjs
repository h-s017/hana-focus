// Isolated real PostgreSQL + Supabase Auth + PostgREST. No hosted project access.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,createHmac} from 'node:crypto';
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4e6});
const root=new URL('../../',import.meta.url).pathname;
const configFile='/tmp/hana-hq-local-env.json';
let config;try{config=JSON.parse(await readFile(configFile,'utf8'));}catch{
 const secret=randomBytes(32).toString('hex'),password=randomBytes(24).toString('hex');
 const token=role=>{const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),head=enc({alg:'HS256',typ:'JWT'}),body=enc({role,iss:'supabase-local-hq',aud:'authenticated',exp:Math.floor(Date.now()/1000)+86400});return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');};
 config={secret,password,anon:token('anon'),service:token('service_role'),url:'http://127.0.0.1:4177',auth:'http://127.0.0.1:59999',rest:'http://127.0.0.1:55433'};
 await writeFile(configFile,JSON.stringify(config),{mode:0o600});
}
function exists(kind,name){try{docker([kind,'inspect',name]);return true;}catch{return false;}}
if(!exists('network','hana-hq-test'))docker(['network','create','hana-hq-test']);
async function envFile(name,values){const file='/tmp/hana-hq-'+name+'.env';await writeFile(file,Object.entries(values).map(([k,v])=>k+'='+v).join('\n'),{mode:0o600});return file;}
async function ensure(name,image,port,vars,args=[]){
 if(exists('container',name)){docker(['start',name]);return;}
 const env=await envFile(name,vars);
 docker(['run','-d','--name',name,'--network','hana-hq-test','-p','127.0.0.1:'+port,'--env-file',env,image,...args]);
}
await ensure('hana-hq-test-pg','postgres:17-alpine','55432:5432',{POSTGRES_PASSWORD:config.password,POSTGRES_DB:'hana_hq_test'});
// The image's temporary init server accepts Unix sockets before POSTGRES_DB
// exists. Wait for TCP, which is enabled only on the final initialized server.
let pgReady=false;
for(let i=0;i<60;i++){try{docker(['exec','hana-hq-test-pg','pg_isready','-h','127.0.0.1','-U','postgres','-d','hana_hq_test']);pgReady=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
if(!pgReady)throw Error('Isolated PostgreSQL did not finish initialization.');
const sql=value=>docker(['exec','-i','hana-hq-test-pg','psql','-U','postgres','-d','hana_hq_test','-v','ON_ERROR_STOP=1'],value);
const installed=sql("select to_regclass('public.hana_tasks') is not null;").includes(' t');
sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create role authenticator login noinherit password '${config.password}';end if;end $$;
alter role postgres in database hana_hq_test set search_path=auth,public;
grant anon,authenticated,service_role to authenticator;create schema if not exists auth;create extension if not exists pgcrypto;`);
await ensure('hana-hq-test-auth','public.ecr.aws/supabase/gotrue:v2.198.0','59999:9999',{
 GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:config.url,
 GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:'postgres://postgres:'+config.password+'@hana-hq-test-pg:5432/hana_hq_test',
 GOTRUE_SITE_URL:config.url,GOTRUE_JWT_SECRET:config.secret,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'true'
});
let healthy=false;
for(let i=0;i<60;i++){try{healthy=(await fetch(config.auth+'/health')).ok;if(healthy)break;}catch{}await new Promise(r=>setTimeout(r,500));}
if(!healthy)throw Error('Isolated Auth did not become healthy; inspect local Docker logs (no hosted service used).');
sql(`create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
grant usage on schema public,auth to anon,authenticated,service_role;`);
const storagePort=59998;
await ensure('hana-hq-test-storage','supabase/storage-api:v1.98.6',storagePort+':5000',{
 ANON_KEY:config.anon,SERVICE_KEY:config.service,AUTH_JWT_SECRET:config.secret,
 DATABASE_URL:'postgres://postgres:'+config.password+'@hana-hq-test-pg:5432/hana_hq_test',
 DB_INSTALL_ROLES:'true',
 STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/var/lib/storage',FILE_SIZE_LIMIT:'8388608',
 GLOBAL_S3_BUCKET:'hana-isolated',TENANT_ID:'hana-isolated',REGION:'local',
 STORAGE_PUBLIC_URL:config.url,REQUEST_ALLOW_X_FORWARDED_PATH:'true',ENABLE_IMAGE_TRANSFORMATION:'false'
});
config.storage='http://127.0.0.1:'+storagePort;
let storageReady=false;
for(let i=0;i<60;i++){
 try{storageReady=(await fetch(config.storage+'/status')).ok;if(storageReady)break;}catch{}
 await new Promise(r=>setTimeout(r,500));
}
if(!storageReady)throw Error('Isolated Storage did not become healthy; inspect local Docker logs (no hosted service used).');
await writeFile(configFile,JSON.stringify(config),{mode:0o600});
if(!installed){
 const fixture=await readFile(root+'tests/office/db-fixture.sql','utf8');sql(fixture.slice(fixture.indexOf('create table public.hana_tasks')));
 for(const file of ['supabase/schema/hana-office-review.sql','supabase/schema/hana-automation.sql','supabase/schema/hana-project-materials.sql','supabase/schema/hana-booking-changes.sql','supabase/schema/hana-free-worker.sql','supabase/schema/hana-monthly-calendar.sql','supabase/migrations/20261025173059_focus_central_workspace.sql','supabase/migrations/20261104180000_intake_receipts.sql'])sql(await readFile(root+file,'utf8'));
}
const migration=await readFile(root+'supabase/migrations/20261124114411_business_hq_phase1.sql','utf8');sql('begin;'+migration+'commit;');sql('begin;'+migration+'commit;');
const proactive=await readFile(root+'supabase/migrations/20261125181132_business_hq_proactive.sql','utf8');sql('begin;'+proactive+'commit;');sql('begin;'+proactive+'commit;');
const editorial=await readFile(root+'supabase/migrations/20261125202952_hana_editorial_delivery_history.sql','utf8');sql('begin;'+editorial+'commit;');sql('begin;'+editorial+'commit;');
const strategy=await readFile(root+'supabase/migrations/20261126182953_hana_hq_private_strategy.sql','utf8');sql('begin;'+strategy+'commit;');sql('begin;'+strategy+'commit;');
await ensure('hana-hq-test-rest','public.ecr.aws/supabase/postgrest:v16.6','55433:3000',{
 PGRST_DB_URI:'postgres://authenticator:'+config.password+'@hana-hq-test-pg:5432/hana_hq_test',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:config.secret
});
sql("notify pgrst,'reload schema';");
let restReady=false;
for(let i=0;i<60;i++){try{restReady=(await fetch(config.rest+'/',{headers:{Authorization:'Bearer '+config.anon}})).ok;if(restReady)break;}catch{}await new Promise(r=>setTimeout(r,500));}
if(!restReady)throw Error('Isolated PostgREST schema cache did not become ready.');
await mkdir(root+'test-artifacts',{recursive:true});
await writeFile(root+'test-artifacts/hq-local-stack.json',JSON.stringify({database:'PostgreSQL 17',auth:'Supabase GoTrue v2.198.0',rest:'PostgREST v16.6',storage:'Supabase Storage v1.98.6',production_accessed:false,cron_installed:false,migration_applied_twice:true},null,2));
console.log('PASS: real isolated PostgreSQL/Auth/REST/Storage ready; additive migration applied twice. Credentials remain in /tmp only.');
