import test from 'node:test';
import assert from 'node:assert/strict';
import {cipher} from '../../supabase/functions/hana-automation/microsoft.mjs';
import {canvaTokenManager} from '../../supabase/functions/hana-automation/canva-token.mjs';
import {planCanvaDailyImport,canvaImportClient,readCanvaImportJob,CANVA_PPTX_MIME} from '../../supabase/functions/hana-automation/canva-import.mjs';
const now=Date.parse('2026-10-26T05:00:00Z');
const encryption=cipher(Buffer.alloc(32,7).toString('base64'));
const initial=async(expiry=now+7200000)=>{
 const store={version:'v1',data:await encryption.seal('owner',{access_token:'VALID_ACCESS_1234',refresh_token:'VALID_REFRESH_1234',expires_at:expiry,scope:'design:content:write folder:write'})};
 return store;
};
const adapter=(state)=>({
 googleOwnerAllowed:async()=>true,
 credential:async()=>({ciphertext:state.data,version:state.version}),
 saveCredential:async(owner,kind,cipher,expected)=>{
  if(owner!=='owner'||kind!=='canva'||expected!==state.version)throw Error('cas_conflict');
  const value='v'+(Number(state.version.slice(1))+1);state.version=value;state.data=cipher;return value;
 }
});
const manager=(state,fetcher)=>canvaTokenManager({store:adapter(state),encryption,clientId:'CLIENT',clientSecret:'secret',ownerId:'owner',fetcher,now:()=>now});
test('valid access token needs no refresh provider calls',async()=>{
 const s=await initial();let calls=0;
 const result=await manager(s,()=>calls++).access('owner');
 assert.equal(result.token,'VALID_ACCESS_1234');
 assert.equal(result.refreshPerformed,false);assert.equal(calls,0);
});
test('expired token is CAS claimed and single use; refresh token never reaches browser',async()=>{
 const s=await initial(now+50000);const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});const claimed=await encryption.open('owner',s.data);
  assert.equal(claimed.refresh_state,'claimed');
  assert.equal(options.redirect,'error');
  assert.equal(options.body.get('grant_type'),'refresh_token');
  assert.equal(options.body.get('refresh_token'),'VALID_REFRESH_1234');
  return Response.json({access_token:'NEW_ACCESS_TOKEN',refresh_token:'NEW_REFRESH_TOKEN',token_type:'Bearer',expires_in:14400,scope:'design:content:write folder:write'});
 };
 const result=await manager(s,fetcher).access('owner');
 assert.equal(result.token,'NEW_ACCESS_TOKEN');
 assert.equal(result.refreshPerformed,true);
 assert.equal(calls.length,1);
 const saved=await encryption.open('owner',s.data);
 assert.equal(saved.refresh_token,'NEW_REFRESH_TOKEN');
 assert.equal(saved.refresh_state,undefined);
 assert.equal(s.version,'v3');
 assert.equal((await manager(s,fetcher).access('owner')).refreshPerformed,false);
 assert.equal(calls.length,1);
});
test('uncertain refresh fails closed without replaying one-use token',async()=>{
 const s=await initial(now+10000);let calls=0;
 const client=manager(s,async()=>{calls++;throw Error('private upstream data');});
 await assert.rejects(client.access('owner'),{code:'canva_reconnect_required'});
 await assert.rejects(client.access('owner'),{code:'canva_reconnect_required'});
 assert.equal(calls,1);
});
test('concurrent workers do not use the same refresh token twice',async()=>{
 const s=await initial(now+10000);let calls=0;
 const fetcher=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return Response.json({access_token:'TOKEN_AFTER_REFRESH',refresh_token:'NEW_REFRESH_TOKEN',token_type:'Bearer',expires_in:14400,scope:'design:content:write'});};
 const results=await Promise.allSettled([manager(s,fetcher).access('owner'),manager(s,fetcher).access('owner')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(calls,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'canva_refresh_in_progress');
});
test('wrong owner and malformed stored credential are refused before network',async()=>{
 const s=await initial();let n=0;
 await assert.rejects(manager(s,()=>n++).access('other'),{code:'canva_oauth_owner_required'});
 s.data=await encryption.seal('owner',{foo:'bar'});
 await assert.rejects(manager(s,()=>n++).access('owner'),{code:'canva_reconnect_required'});
 assert.equal(n,0);
});
const sha='a'.repeat(40),day='2026-10-26';
const plan=planCanvaDailyImport({date:day,commitSha:sha,title:'HANA Day 008｜前景與背景'});
test('URL import plan binds immutable commit and unchangeable public PPTX path',()=>{
 assert.equal(plan.url,'https://raw.githubusercontent.com/h-s017/hana-focus/'+sha+'/content/instagram/2026-10-26/canva-import.pptx');
 assert.equal(plan.mime_type,CANVA_PPTX_MIME);
 assert.equal(plan.external_writes,false);
 assert.throws(()=>planCanvaDailyImport({date:'2026-02-30',commitSha:sha,title:'valid'}),{code:'canva_source_invalid'});
 assert.throws(()=>planCanvaDailyImport({date:day,commitSha:'hana-focus-preview',title:'x'}),{code:'canva_source_invalid'});
});
test('import is never requested without explicit backend enable switch',async()=>{
 let calls=0;const api=canvaImportClient({accessToken:'CANVA_ACCESS_123',fetcher:async()=>{calls++;}});
 await assert.rejects(api.start(plan),{code:'canva_import_disabled'});
 await assert.rejects(api.start({...plan,url:'https://attacker.invalid/surprise.pptx'},{enabled:true}),{code:'canva_source_invalid'});
 assert.equal(calls,0);
});
test('Canva import posts official JSON schema and polls until verified completion',async()=>{
 const calls=[],jobId='d4cdff38-d67a-4228-befb-dc2ccc101010';
 const fetcher=async(url,options)=>{
  calls.push({url,options});assert.match(options.headers.Authorization,/Bearer /);
  if(options.method==='POST'){
   const payload=JSON.parse(options.body);
   assert.equal(payload.title,plan.title);assert.equal(payload.url,plan.url);assert.equal(payload.mime_type,CANVA_PPTX_MIME);
   return Response.json({job:{id:jobId,status:'in_progress'}});
  }
  assert.equal(url,'https://api.canva.com/rest/v1/url-imports/'+jobId);
  return Response.json({job:{id:jobId,status:'success',result:{designs:[{id:'DAHZE3YnNfA',page_count:6,urls:{edit_url:'https://www.canva.com/d/example123'}}]}}});
 };
 const api=canvaImportClient({accessToken:'CANVA_ACCESS_123',fetcher});
 const started=await api.start(plan,{enabled:true});
 assert.equal(started.status,'in_progress');assert.equal(started.canvaCreated,false);
 const finished=await api.check(jobId);
 assert.equal(finished.canvaCreated,true);assert.equal(finished.pagesConfirmed,true);
 assert.equal(finished.edit_link_expires_in_days,30);
 assert.equal(finished.instagramPublished,false);
 assert.equal(calls.length,2);
});
test('unverified designs and malformed/unsafe Canva output are never accepted as created',()=>{
 const id='abc-123';
 for(const data of [
  {job:{id,status:'success',result:{designs:[]}}},
  {job:{id,status:'success',result:{designs:[{id:'DAHZE3YnNfA',page_count:5}]}}},
  {job:{id,status:'success',result:{designs:[{id:'DAHZE3YnNfA',urls:{edit_url:'https://evil.com'}}]}}},
  {job:{id,status:'invalid'}}
 ])assert.throws(()=>readCanvaImportJob(data));
 assert.equal(readCanvaImportJob({job:{id,status:'failed'}}).canvaCreated,false);
});
