import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {proactiveHQ,taoyuanResearch} from '../../supabase/functions/hana-automation/hq-proactive.mjs';
import {hqStore} from '../../supabase/functions/hana-automation/hq-store.mjs';

const cfg=JSON.parse(await readFile('/tmp/hana-hq-local-env.json','utf8'));
const headers=token=>({Authorization:'Bearer '+token,'Content-Type':'application/json',apikey:token});
async function post(path,token,body){
 const response=await fetch(cfg.url+path,{method:'POST',headers:headers(token),body:JSON.stringify(body)});
 const data=await response.json();
 assert.ok(response.ok,`${path}: ${JSON.stringify(data)}`);
 return data;
}
async function account(){
 const email='schedule-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('hex');
 const {id}=await post('/auth/v1/admin/users',cfg.service,{email,password,email_confirm:true,app_metadata:{hana_office_access:true}});
 return {id,email,password};
}
const login=async account=>(await post('/auth/v1/token?grant_type=password',cfg.anon,{email:account.email,password:account.password})).access_token;
const call=(session,action,fields={})=>post('/functions/v1/hana-automation',session,{action,workspace:'work',...fields});
const a=await account(),b=await account(),session=await login(a),other=await login(b);
const profile={positioning:'隔離驗收：旅宿體驗的香氛設計',ideal_customer:'提供旅客體驗的桃園旅宿',offer:'住宿體驗的香氛工作坊',district:'',signals:'餐廳、會議、旅客、體驗、住宿',daily_limit:2,run_at:'00:00',enabled:false};
assert.equal((await call(session,'hq_profile_save',{profile})).profile.positioning,profile.positioning);
assert.equal((await call(other,'hq_profile')).profile,null);
assert.equal((await call(session,'hq_snapshot')).opportunities.length,0);
const denied=await fetch(cfg.url+'/rest/v1/hana_hq_daily_runs',{headers:headers(session)});
assert.ok([401,403].includes(denied.status));

const store=hqStore({url:cfg.url,service:cfg.service}),secret=randomBytes(32).toString('hex');
let providerRequests=0;
const research=taoyuanResearch({fetcher:async(url,options)=>{providerRequests++;return fetch(url,options);}});
const worker=proactiveHQ({store,research,owner:a.id,enabled:true,secret});
const server=createServer(async(req,res)=>{
 const response=await worker.worker(new Request('http://127.0.0.1/hq-worker',{method:req.method,headers:req.headers}));
 res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/hq-worker';
const ticks=[];
let pending=false;
const tick=async()=>{
 if(pending)return;
 pending=true;
 try{const r=await fetch(url,{method:'POST',headers:{'x-hana-hq-worker':secret}});ticks.push({at:new Date().toISOString(),http:r.status,result:await r.json()});}
 finally{pending=false;}
};
// A wall-clock timer, independent of the authenticated UI and the report polling loop.
const timer=setInterval(()=>void tick().catch(error=>ticks.push({error:error.name})),1000);
try{
 assert.equal((await fetch(url,{method:'POST'})).status,401);
 await wait(1300);
 assert.equal((await call(session,'hq_profile')).runs.length,0);
 assert.equal(providerRequests,0);
 await call(session,'hq_profile_save',{profile:{...profile,enabled:true}});
 let result;
 for(let i=0;i<100;i++){
  await wait(700);
  result=(await call(session,'hq_profile')).runs[0];
  if(result&&result.status!=='running')break;
 }
 assert.ok(result&&['completed','partial'].includes(result.status),JSON.stringify(result?.report));
 assert.equal(new Date(result.scheduled_for).toISOString().slice(11,16),'16:00');
 assert.ok(result.report.records_scanned>0&&result.report.market.length>0,JSON.stringify(result.report));
 assert.ok(result.report.saved.length>0,JSON.stringify(result.report));
 assert.equal(result.report.external_messages_sent,0);
 const successfulRequests=providerRequests;
 await wait(2300);
 assert.equal(providerRequests,successfulRequests);
 assert.ok(ticks.some(t=>t.result?.status==='not_due'));
 assert.equal((await call(session,'hq_profile')).runs.length,1);
 const signedInAgain=await login(a);
 const crm=await call(signedInAgain,'hq_snapshot');
 const persisted=(await call(signedInAgain,'hq_profile')).runs[0];
 assert.equal(persisted.id,result.id);
 assert.deepEqual((await call(other,'hq_profile')).runs,[]);
 assert.equal((await call(other,'hq_snapshot')).opportunities.length,0);
 for(const item of persisted.report.saved){
  const lead=crm.opportunities.find(lead=>lead.id===item.opportunity_id);
  const run=crm.runs.find(run=>run.task_id===item.task_id);
  assert.ok(lead&&run);
  assert.equal(lead.stage,'proposal_draft');
  assert.equal(run.skill_state,'review');
  assert.equal(lead.linked_task_id,item.task_id);
  assert.equal(lead.fit_score,item.fit_score);
  assert.ok(lead.next_followup_at&&lead.draft.includes(lead.company_name)&&lead.evidence[0].verified);
  assert.match(lead.source_url,/^https:\/\/travel\.tycg\.gov\.tw\/zh-tw\/accommodation\/detail\/\d+$/);
 }
 assert.equal(crm.opportunities.length,persisted.report.saved.length);
 await writeFile('test-artifacts/hq-proactive-schedule.json',JSON.stringify({environment:'isolated Postgres, Auth and PostgREST; wall-clock timer; live Taoyuan public API',production_modified:false,provider_requests:providerRequests,ticks,run:persisted,opportunities:crm.opportunities.map(({company_name,id,linked_task_id,next_followup_at,evidence,stage})=>({company_name,id,linked_task_id,next_followup_at,evidence,stage}))},null,2));
 console.log(`PASS HQ proactive: timer run ${persisted.id}, ${persisted.report.saved.length} real listings saved, ${persisted.report.market.length} market items, ${providerRequests} public requests. Authenticated readback and repeated-tick deduplication passed.`);
}finally{clearInterval(timer);await new Promise(resolve=>server.close(resolve));}
