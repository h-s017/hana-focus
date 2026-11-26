import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {crc32,deflateSync} from 'node:zlib';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
import {automationStore} from '../../supabase/functions/hana-automation/store.mjs';
import {editorialDelivery,checkEditorialSources} from '../../supabase/functions/hana-automation/editorial-delivery.mjs';
import {editorialMedia} from '../../supabase/functions/hana-automation/editorial-media.mjs';
import {founderForDate,marketingForDate,scheduledKinds,sensoryMetadata} from '../../social-editor/operations-content.mjs';
import {sensoryLessons} from '../../social-editor/sensory-curriculum.mjs';
import {sensoryVisuals} from '../../social-editor/sensory-visual.mjs';

function pngFixture(width,height,value=0){
 const chunk=(type,data)=>{
  const payload=Buffer.concat([Buffer.from(type),data]),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(payload));
  return Buffer.concat([length,payload,checksum]);
 };
 const header=Buffer.alloc(13);
 header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;
 const rows=Buffer.alloc((width+1)*height,value);
 for(let i=0;i<height;i++)rows[i*(width+1)]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

export async function testEditorialOperations({cfg,owner,other}){
 const date='2026-11-26',token=randomBytes(32).toString('hex');
 const {store,authenticate}=automationStore({url:cfg.url,service:cfg.service});
 const media=editorialMedia({url:cfg.url,service:cfg.service});
 const service=editorialDelivery({store,owner:owner.id,token,enabled:true,media,now:()=>new Date('2026-11-26T00:10:00Z'),verify:(user,kind,content)=>checkEditorialSources(user,kind,content)});
 const http=control({store,authenticate,readiness:()=>({}),editorial:service.account});
 const post=async (session,body)=>http(new Request(cfg.url,{method:'POST',headers:{Authorization:'Bearer '+session,'Content-Type':'application/json'},body:JSON.stringify({workspace:'work',...body})}));
 const worker=async (body,key=token)=>service.worker(new Request(cfg.url+'/editorial-worker',{method:'POST',headers:{'x-hana-editorial-worker':key},body:JSON.stringify(body)}));
 const upload=(id,slot,bytes,key=token)=>service.worker(new Request(cfg.url+'/editorial-worker?'+new URLSearchParams({id,asset:slot}),{
  method:'POST',headers:{'x-hana-editorial-worker':key,'Content-Type':'image/png'},body:bytes
 }));
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
  if(kind==='founder_story'){
   const photo=pngFixture(1080,1920,42),story=pngFixture(1080,1920,84);
   const invalidCrc=Buffer.from(photo);invalidCrc[44]^=1;
   assert.equal((await upload(run.id,'photo-1',photo,'invalid')).status,401);
   assert.equal((await upload(run.id,'photo-7',photo)).status,400);
   assert.equal((await upload(run.id,'photo-1',pngFixture(1080,1350))).status,400);
   // Mutate IDAT data so the dimensions remain correct and a checksum fails.
   assert.equal((await upload(run.id,'photo-1',invalidCrc)).status,400);
   const first=await upload(run.id,'photo-1',photo);
   const receipt=await first.json();
   assert.equal(first.status,200,JSON.stringify(receipt));
   assert.equal(receipt.readback,true);
   assert.equal((await (await upload(run.id,'photo-1',photo)).json()).sha256,receipt.sha256);
   assert.equal((await upload(run.id,'photo-1',story)).status,409);
   assert.equal((await upload(run.id,'story',story)).status,200);
  }
  const response=await worker({action:'finish',kind,date,id:run.id,content:contents[kind],evidence:{verified:true,visualQA:true}});
  const row=await response.json();assert.equal(response.status,200,JSON.stringify(row));
  assert.equal(row.state,'partial');assert.equal(row.evidence.verified,false);assert.ok(row.missing.includes('verified_original_png'));
  if(kind==='service_marketing')assert.equal(row.evidence.serviceLinkVerified,true);
  if(kind==='founder_story'){
   const expected=pngFixture(1080,1920,42);
   assert.deepEqual(row.evidence.mediaReceipts.map(asset=>asset.slot),['photo-1','story']);
   assert.equal(row.evidence.mediaReadFailures,undefined);
   const asset={action:'editorial_asset',id:run.id,slot:'photo-1'};
   assert.equal((await post(other.access_token,asset)).status,409);
   assert.equal((await post(owner.access_token,{...asset,workspace:'church'})).status,409);
   const direct=cfg.url+'/storage/v1/object/authenticated/hana-editorial-private/'+owner.id+'/'+run.id+'/photo-1.png';
   assert.ok(!(await fetch(direct,{headers:{Authorization:'Bearer '+owner.access_token}})).ok);
   const receipt=await post(owner.access_token,asset);
   const signed=await receipt.json();
   assert.equal(receipt.status,200,JSON.stringify(signed));
   assert.equal(signed.expires_in,120);
   const saved=await fetch(signed.url);
   assert.equal(saved.status,200);
   assert.deepEqual(Buffer.from(await saved.arrayBuffer()),expected);
   assert.equal((await upload(run.id,'photo-1',expected)).status,409);
  }
  rows.push({id:row.id,kind,state:row.state,missing:row.missing,source:row.evidence.service_url||null,media:row.evidence.mediaReceipts});
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
 console.log('PASS HANA editorial: three task identities, live CTA, private PNG persisted and read back from Storage, scoped preview, overwrite rejected, missing original/Canva evidence enforced, versioned retry.');
}
