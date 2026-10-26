import test from 'node:test';
import assert from 'node:assert/strict';
import {canvaOAuth,CANVA_CALLBACK,CANVA_SCOPES} from '../../supabase/functions/hana-automation/canva-oauth.mjs';
import {cipher} from '../../supabase/functions/hana-automation/microsoft.mjs';
import {beginCanvaConnection,finishCanvaConnection,CANVA_PENDING,canvaSetupDiagnostic} from '../../js/canva-connect.mjs';
const proof='b'.repeat(43),alien='c'.repeat(43);
const sha=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('base64url');
function fixture(opts={}){
 let clock=Date.parse('2026-10-26T04:00:00Z'),allowed=true,credential=opts.existing?{ciphertext:'kept',version:'older'}:null,authUrl;
 const rows=new Map(),calls=[],saves=[],encryption=cipher(Buffer.alloc(32,3).toString('base64'));
 const store={
  googleOwnerAllowed:async()=>allowed,
  canvaOauthRecentCount:async()=>opts.limit?5:rows.size,
  credential:async(owner,kind)=>kind==='canva'?credential:null,
  canvaOauthCreate:async(owner,id,details)=>rows.set(id,{owner,details,code:'canva_oauth_pending'}),
  canvaOauthGet:async(owner,id)=>{const row=rows.get(id);return row?.owner===owner&&row.code==='canva_oauth_pending'?structuredClone(row):null;},
  canvaOauthClaim:async(owner,id,h,e)=>{const row=rows.get(id);if(!row||row.owner!==owner||row.code!=='canva_oauth_pending'||row.details.state_hash!==h||row.details.expires_at!==e)return false;row.code='canva_oauth_claimed';row.details={};return true;},
  saveCredential:async(owner,kind,ciphertext,version)=>{if((credential?.version||null)!==version)throw Error('credential_changed');credential={ciphertext,version:'new'};saves.push({owner,kind,ciphertext});},
  event:async()=>{if(opts.auditFailure)throw Error('audit private');}
 };
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(opts.fail)throw Error('sensitive upstream failure');
  assert.equal(url,'https://api.canva.com/rest/v1/oauth/token');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'error');
  assert.match(options.headers.Authorization,/^Basic /);
  assert.equal(options.body.get('grant_type'),'authorization_code');
  assert.equal(options.body.get('redirect_uri'),CANVA_CALLBACK);
  assert.equal(await sha(options.body.get('code_verifier')),authUrl.searchParams.get('code_challenge'));
  return Response.json({access_token:'TOP-SECRET-ACCESS',refresh_token:opts.noRefresh?undefined:'TOP-SECRET-REFRESH',scope:opts.scope??CANVA_SCOPES,expires_in:14400,token_type:'Bearer'});
 };
 const service=canvaOAuth({clientId:'fixture-id',clientSecret:opts.noSecret?'':'PRIVATE-SECRET',ownerId:'owner',store,encryption,fetcher,now:()=>clock});
 const run=async(owner,body)=>{const r=await service(owner,body);if(r.authorization_url)authUrl=new URL(r.authorization_url);return r;};
 return {run,rows,calls,saves,encryption,credential:()=>credential,deny:()=>allowed=false,expire:()=>clock+=600001,
  async start(){return run('owner',{action:'canva_oauth_start',browser_proof:proof})},
  async finish(state,providedProof=proof){return run('owner',{action:'canva_oauth_finish',state,code:'onetime-code',browser_proof:providedProof})},
  changeCredential:()=>credential={version:'changed',ciphertext:'other'}};
}
test('start has Canva origin, strict PKCE, fixed redirect and no secret in result',async()=>{
 const f=fixture(),s=await f.start(),url=new URL(s.authorization_url);
 assert.equal(url.origin,'https://www.canva.com');
 assert.equal(url.pathname,'/api/oauth/authorize');
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.equal(url.searchParams.get('redirect_uri'),CANVA_CALLBACK);
 assert.equal(url.searchParams.get('scope'),CANVA_SCOPES);
 assert.equal(url.searchParams.get('response_type'),'code');
 assert.ok(!JSON.stringify(s).includes('PRIVATE'));
 assert.ok(!JSON.stringify([...f.rows.values()]).includes(proof));
 assert.equal(f.calls.length,0);
});
test('finish keeps credentials encrypted, only once, and does not launch imports',async()=>{
 const f=fixture(),s=await f.start(),result=await f.finish(s.state);
 assert.equal(result.status,'connected');
 assert.equal(result.canva_import_enabled,false);
 assert.equal(result.external_writes,false);
 assert.equal(f.saves.length,1);
 assert.equal(f.saves[0].kind,'canva');
 const stored=await f.encryption.open('owner',f.saves[0].ciphertext);
 assert.equal(stored.refresh_token,'TOP-SECRET-REFRESH');
 assert.equal(stored.scope,CANVA_SCOPES);
 assert.ok(!JSON.stringify(result).includes('TOP-SECRET'));
 await assert.rejects(f.finish(s.state),{code:'canva_oauth_expired'});
 assert.equal(f.calls.length,1);
});
test('foreign owner, missing secret and excessive retries fail before contacting Canva',async()=>{
 const a=fixture(),s=await a.start();
 await assert.rejects(a.run('outsider',{action:'canva_oauth_finish',state:s.state,code:'other',browser_proof:proof}),{code:'canva_oauth_owner_required'});
 a.deny();await assert.rejects(a.finish(s.state),{code:'canva_oauth_owner_required'});
 await assert.rejects(fixture({noSecret:true}).start(),{code:'canva_oauth_setup_required'});
 await assert.rejects(fixture({limit:true}).start(),{code:'canva_oauth_rate_limited'});
 assert.equal(a.calls.length,0);
});
test('expired or tampered state and wrong browser proof are rejected',async()=>{
 const f=fixture(),s=await f.start();
 await assert.rejects(f.finish(s.state,alien),{code:'canva_oauth_browser_required'});
 await assert.rejects(f.finish(s.state.slice(0,37)+'z'.repeat(43)),{code:'canva_oauth_expired'});
 f.expire();await assert.rejects(f.finish(s.state),{code:'canva_oauth_expired'});
 assert.equal(f.calls.length,0);
});
test('rejected consent scope or missing refresh token does not replace existing secret',async()=>{
 for(const opt of [{scope:'design:meta:read'},{noRefresh:true}]){
  const f=fixture(opt),s=await f.start();
  await assert.rejects(f.finish(s.state));
  assert.equal(f.saves.length,0);
 }
});
test('failed upstream consumes code, cannot be retried and reveals no upstream details',async()=>{
 const f=fixture({fail:true}),s=await f.start();
 await assert.rejects(f.finish(s.state),e=>e.code==='canva_oauth_upstream_failed'&&!e.message.includes('sensitive'));
 await assert.rejects(f.finish(s.state),{code:'canva_oauth_expired'});
 assert.equal(f.saves.length,0);
});
test('simultaneous claims accept exactly one and concurrent reconnect preserves new credentials',async()=>{
 const f=fixture(),s=await f.start(),states=await Promise.allSettled([f.finish(s.state),f.finish(s.state)]);
 assert.equal(states.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(f.calls.length,1);
 const another=fixture({existing:true}),t=await another.start();another.changeCredential();
 await assert.rejects(another.finish(t.state),/credential_changed/);
 assert.equal(another.credential().version,'changed');
});
const storage=()=>{const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)||null,removeItem:k=>m.delete(k)};};
test('browser stores binding proof only, validates redirect, expires cleanly',async()=>{
 const f=fixture(),st=storage(),clock=Date.parse('2026-10-26T04:00:00Z');let redir;
 const db={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},
  functions:{invoke:async(_,request)=>{try{return {data:await f.run('owner',request.body)};}catch(e){return {data:{error:e.code}};}}}};
 await beginCanvaConnection({db,storage:st,navigate:url=>redir=url,now:()=>clock});
 assert.equal(new URL(redir).origin,'https://www.canva.com');
 assert.equal(st.getItem(CANVA_PENDING).includes('TOP-SECRET'),false);
 const state=new URL(redir).searchParams.get('state');
 const result=await finishCanvaConnection({db,storage:st,href:CANVA_CALLBACK+'?state='+encodeURIComponent(state)+'&code=short-lived',now:()=>clock});
 assert.equal(result.status,'connected');assert.equal(st.getItem(CANVA_PENDING),null);
});
test('browser refuses untrusted redirect host and never navigates',async()=>{
 const st=storage();let nav=false;
 await assert.rejects(beginCanvaConnection({db:{functions:{invoke:async()=>({data:{state:'abc',authorization_url:'https://attack.invalid',expires_at:Date.now()+20000}})}},storage:st,navigate:()=>nav=true}));
 assert.equal(nav,false);assert.equal(st.getItem(CANVA_PENDING),null);
});
test('browser forged state is blocked before request and OAuth status is truthfully nonpublishing',async()=>{
 const f=fixture(),state=await f.run('owner',{action:'canva_oauth_status'});
 assert.equal(state.configured,true);
 assert.equal(state.credentials_saved,false);
 assert.equal(state.external_writes,false);
 const st=storage();
 await assert.rejects(finishCanvaConnection({db:{},storage:st,href:CANVA_CALLBACK+'?state=forged&code=code'}),{code:'canva_oauth_browser_required'});
});

test('Canva readiness names exact missing secrets without revealing values',()=>{
 const d=canvaSetupDiagnostic({canva_setup:{client_id:true,client_secret:true,owner:true,encryption:false}});
 assert.deepEqual(d.missing,['HANA_CONNECTOR_ENCRYPTION_KEY']);
 assert.equal(d.complete,false);
 assert.match(d.message,/32 bytes Base64/);
 assert.ok(!d.message.includes('private-secret-value'));
});
test('Canva readiness reports other missing fields and refuses unverified state',()=>{
 const all=canvaSetupDiagnostic({canva_setup:{client_id:true,client_secret:true,owner:true,encryption:true}});
 assert.equal(all.complete,true);
 assert.deepEqual(all.missing,[]);
 assert.match(all.message,/OAuth/);
 const none=canvaSetupDiagnostic({});
 assert.equal(none.complete,false);
 const some=canvaSetupDiagnostic({canva_setup:{client_id:false,client_secret:true,owner:false,encryption:true}});
 assert.deepEqual(some.missing,['CANVA_CLIENT_ID','CANVA_OWNER_ID']);
});

test('Canva authorization errors are classified without leaking external descriptions',async()=>{
 const f=fixture(),clock=Date.parse('2026-10-26T04:00:00Z'),started=await f.start();
 const state=started.state,proofValue='b'.repeat(43);
 for(const [external,expected] of [
  ['invalid_request','canva_oauth_provider_invalid_request'],
  ['invalid_scope','canva_oauth_provider_invalid_scope'],
  ['access_denied','canva_oauth_provider_access_denied'],
  ['unauthorized_client','canva_oauth_provider_unauthorized_client'],
  ['invalid_client','canva_oauth_provider_invalid_client'],
  ['temporarily_unavailable','canva_oauth_provider_unavailable'],
  ['unexpected_value','canva_oauth_invalid']
 ]){
  const mem=storage();mem.setItem(CANVA_PENDING,JSON.stringify({proof:proofValue,state,expires_at:clock+600000}));
  const db={auth:{getSession:async()=>{throw Error('provider rejection must not exchange code');}},
   functions:{invoke:async()=>{throw Error('provider rejection must not request backend');}}};
  const href=CANVA_CALLBACK+'?state='+encodeURIComponent(state)+'&error='+external+'&error_description='+encodeURIComponent('PRIVATE ERROR DETAIL');
  await assert.rejects(finishCanvaConnection({db,storage:mem,href,now:()=>clock}),e=>e.code===expected&&!e.message.includes('PRIVATE'));
  assert.equal(mem.getItem(CANVA_PENDING),null);
 }
});
test('Canva error callback with mismatched state does not show attacker-supplied error code',async()=>{
 const st=storage(),clock=Date.parse('2026-10-26T04:00:00Z');
 st.setItem(CANVA_PENDING,JSON.stringify({proof:'b'.repeat(43),state:'original',expires_at:clock+600000}));
 await assert.rejects(finishCanvaConnection({db:{},storage:st,href:CANVA_CALLBACK+'?state=attacker&error=invalid_scope',now:()=>clock}),{code:'canva_oauth_browser_required'});
});


test('browser accepts both documented case spellings of Canva PKCE S256',async()=>{
 for(const method of ['s256','S256']){
  const f=fixture(),st=storage(),clock=Date.parse('2026-10-26T04:00:00Z');
  let destination='';
  const db={functions:{invoke:async(_,{body})=>{
   const data=await f.run('owner',body);
   const url=new URL(data.authorization_url);
   url.searchParams.set('code_challenge_method',method);
   return {data:{...data,authorization_url:url.href}};
  }}};
  const r=await beginCanvaConnection({db,storage:st,navigate:url=>destination=url,now:()=>clock});
  assert.equal(r.status,'redirecting');
  assert.equal(new URL(destination).searchParams.get('code_challenge_method'),method);
  assert.ok(st.getItem(CANVA_PENDING));
 }
});
test('browser rejects a mismatched Canva PKCE method before navigating',async()=>{
 const f=fixture(),st=storage(),clock=Date.parse('2026-10-26T04:00:00Z');
 let traveled=false;
 const db={functions:{invoke:async(_,{body})=>{
  const data=await f.run('owner',body);
  const url=new URL(data.authorization_url);url.searchParams.set('code_challenge_method','plain');
  return {data:{...data,authorization_url:url.href}};
 }}};
 await assert.rejects(
  beginCanvaConnection({db,storage:st,navigate:()=>{traveled=true;},now:()=>clock}),
  {code:'canva_oauth_client_version_mismatch'}
 );
 assert.equal(traveled,false);
 assert.equal(st.getItem(CANVA_PENDING),null);
});
