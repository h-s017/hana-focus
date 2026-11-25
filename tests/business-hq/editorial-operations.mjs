import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
import {automationStore} from '../../supabase/functions/hana-automation/store.mjs';
import {editorialDelivery,checkEditorialSources} from '../../supabase/functions/hana-automation/editorial-delivery.mjs';
import {founderForDate,marketingForDate,scheduledKinds,sensoryMetadata} from '../../social-editor/operations-content.mjs';
import {sensoryLessons} from '../../social-editor/sensory-curriculum.mjs';
import {sensoryVisuals} from '../../social-editor/sensory-visual.mjs';

export async function testEditorialOperations({cfg,owner,other}){
 const date='2026-11-26',token=randomBytes(32).toString('hex');
 const {store,authenticate}=automationStore({url:cfg.url,service:cfg.service});
 const service=editorialDelivery({store,owner:owner.id,token,enabled:true,now:()=>new Date('2026-11-26T00:10:00Z'),verify:(user,kind,content)=>checkEditorialSources(user,kind,content)});
 const http=control({store,authenticate,readiness:()=>({}),editorial:service.account});
 const post=async (session,body)=>http(new Request(cfg.url,{method:'POST',headers:{Authorization:'Bearer '+session,'Content-Type':'application/json'},body:JSON.stringify({workspace:'work',...body})}));
 const worker=async (body,key=token)=>service.worker(new Request(cfg.url+'/editorial-worker',{method:'POST',headers:{'x-hana-editorial-worker':key},body:JSON.stringify(body)}));
 assert.equal((await worker({action:'history'},'disabled')).status,401);
 assert.deepEqual(scheduledKinds('2026-11-27'),['sensory','founder_story']);
 assert.deepEqual(['2026-11-26','2026-11-29','2026-12-02','2026-12-05'].map(day=>marketingForDate(day).category),['small_batch','team','kpia','overture']);
 const lesson=sensoryLessons[0];
 const contents={sensory:{...lesson,...sensoryMetadata(lesson),topic_id:lesson.id,visuals:sensoryVisuals(lesson),caption:'本期學習如何安排嗅覺線索及替代動線。'},service_marketing:marketingForDate(date),founder_story:founderForDate(date)};
 const rows=[];
 await pause(50);
 for(const kind of scheduledKinds(date)){
  const claim={action:'claim',kind,date};
  const requests=await Promise.all([worker(claim),worker(claim)]);
  const claims=await Promise.all(requests.map(response=>response.json()));
  assert.equal(claims.filter(candidate=>candidate.claimed).length,1,JSON.stringify(claims));
  const run=claims.find(candidate=>candidate.claimed);
  const response=await worker({action:'finish',kind,date,id:run.id,content:contents[kind],evidence:{verified:true,visualQA:true}});
  const row=await response.json();assert.equal(response.status,200,JSON.stringify(row));
  assert.equal(row.state,'partial');assert.equal(row.evidence.verified,false);assert.ok(row.missing.includes('verified_original_png'));
  if(kind==='service_marketing')assert.equal(row.evidence.serviceLinkVerified,true);
  rows.push({id:row.id,kind,state:row.state,missing:row.missing,source:row.evidence.service_url||null});
 }
 const snapshot=await post(owner.access_token,{action:'editorial_snapshot'});
 assert.equal(snapshot.status,200);assert.equal((await snapshot.json()).entries.length,3);
 assert.deepEqual((await (await post(other.access_token,{action:'editorial_snapshot'})).json()).entries,[]);
 assert.equal((await post(owner.access_token,{workspace:'church',action:'editorial_snapshot'})).status,409);
 assert.equal((await post(owner.access_token,{action:'editorial_decide',id:rows[0].id,decision:'approve'})).status,409);
 const retry=await post(owner.access_token,{action:'editorial_decide',id:rows[0].id,decision:'retry'});
 const newVersion=await retry.json();assert.equal(newVersion.version,2);assert.equal(newVersion.state,'scheduled');
 assert.equal((await post(owner.access_token,{action:'editorial_decide',id:rows[0].id,decision:'retry'})).status,409);
 await writeFile('test-artifacts/editorial-operations-evidence.json',JSON.stringify({date,environment:'isolated Auth, PostgREST and PostgreSQL',live_source_check:true,production_modified:false,rows,version_after_retry:newVersion.version},null,2));
 console.log('PASS HANA editorial: three independent identities, official service CTA checked, truthful missing media, authenticated readback, owner/workspace isolation and versioned retry.');
}
