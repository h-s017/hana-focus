import test from 'node:test';import assert from 'node:assert/strict';
import {automationStore} from '../../supabase/functions/hana-automation/store.mjs';
test('private intake readiness fails closed and metadata reads stay on the configured service origin',async()=>{
 const calls=[];let publicBucket=false;
 const {store}=automationStore({url:'https://fixture.supabase.invalid',service:'fixture-service-only',fetcher:async(url,options)=>{
  calls.push({url,options});if(url.includes('/bucket/'))return Response.json({id:'hana-work-intake',public:publicBucket});
  return Response.json([{name:'hash.png',metadata:{size:4,mimetype:'image/png'}}]);
 }});
 assert.equal(await store.intakeReady(),true);publicBucket=true;assert.equal(await store.intakeReady(),false);
 const rows=await store.intakeFiles('owner','project','request');assert.equal(rows[0].metadata.size,4);
 assert.ok(calls.every(c=>c.url.startsWith('https://fixture.supabase.invalid/storage/v1/')));assert.equal(calls.at(-1).options.headers.Authorization,'Bearer fixture-service-only');assert.equal(JSON.parse(calls.at(-1).options.body).prefix,'owner/project/request');
 const unavailable=automationStore({url:'https://fixture.supabase.invalid',service:'fixture-service-only',fetcher:async()=>new Response('PRIVATE UPSTREAM',{status:503})}).store;
 assert.equal(await unavailable.intakeReady(),false);await assert.rejects(unavailable.intakeFiles('a','b','c'),error=>error.code==='intake_storage_unavailable'&&!error.message.includes('PRIVATE'));
});
