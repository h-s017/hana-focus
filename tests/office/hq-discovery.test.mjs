import test from 'node:test';
import assert from 'node:assert/strict';
import {publicBusinessDiscovery} from '../../supabase/functions/hana-automation/hq-discovery.mjs';
import {businessHQ} from '../../supabase/functions/hana-automation/hq.mjs';
import {publicSourceReader} from '../../supabase/functions/hana-automation/hq-source.mjs';
import {control} from '../../supabase/functions/hana-automation/control.mjs';

const criteria={industry:'旅宿',region:'台北',services:'品牌香氛合作',limit:2};
const search={action:'hq_discover',workspace:'work',criteria};

test('discovery calls one fixed search endpoint, excludes known domains and returns unverified leads',async()=>{
 let searchCalls=0;
 const store={hqSnapshot:async owner=>{
  assert.equal(owner,'fixture-owner');
  return {opportunities:[{canonical_domain:'existing.org'}]};
 }};
 const discovery=publicBusinessDiscovery({enabled:true,apiKey:'fixture-key',fetcher:async (url,options)=>{
  searchCalls++;
  const target=new URL(url);
  assert.equal(target.origin,'https://api.search.brave.com');
  assert.equal(target.pathname,'/res/v1/web/search');
  assert.equal(target.searchParams.get('q'),'旅宿 台北');
  assert.equal(target.searchParams.get('search_lang'),'zh-hant');
  assert.equal(target.searchParams.get('count'),'6');
  assert.ok(!url.includes(criteria.services));
  assert.equal(options.headers['X-Subscription-Token'],'fixture-key');
  assert.equal(options.redirect,'error');
  return Response.json({web:{results:[
   {url:'https://existing.org',title:'Existing'},
   {url:'https://127.0.0.1/',title:'Loopback'},
   {url:'https://m.facebook.com/a',title:'Social page'},
   {url:'https://hotel-one.org/',title:'Hotel One'},
   {url:'https://www.hotel-one.org/about#location',title:'Hotel One – 台北旅宿',description:'<strong>台北旅宿</strong>介紹'},
   {url:'https://hotel-two.org/',title:'Hotel Two ｜ Booking',profile:{name:'Hotel Two'},description:'旅宿'},
  ]}});
 }});
 const sourceReader=publicSourceReader({allowedHosts:['hotel-one.org'],fetcher:()=>assert.fail('discovery must not fetch candidate websites')});
 const hq=businessHQ({store,sourceReader,discovery});
 assert.equal((await hq('fixture-owner',{workspace:'work',action:'hq_catalog'})).research.discovery,true);
 const result=await hq('fixture-owner',search);
 assert.equal(searchCalls,1);
 assert.equal(result.external_delivery,false);
 assert.deepEqual(result.candidates.map(x=>[x.company_name,x.verification,x.source_check_available]),[['Hotel One','unverified',true],['Hotel Two','unverified',false]]);
 assert.equal(result.candidates[0].source_url,'https://www.hotel-one.org/about');
 assert.match(result.candidates[0].approach,/品牌香氛合作/);
 assert.equal(result.candidates[0].excerpt,'台北旅宿 介紹');
 assert.ok(!JSON.stringify(result).includes('fixture-key'));
});

test('workspace, authorization, and input guards stop search before network and persistence',async()=>{
 const stop=()=>assert.fail('not called');
 const enabled=publicBusinessDiscovery({enabled:true,apiKey:'fixture-key',fetcher:stop});
 const disabled=publicBusinessDiscovery({enabled:false,apiKey:'fixture-key',fetcher:stop});
 const store={hqSnapshot:stop};
 const hq=businessHQ({store,discovery:enabled});
 assert.equal(disabled.available,false);
 await assert.rejects(businessHQ({store,discovery:disabled})('owner',search),/hq_discovery_not_configured/);
 await assert.rejects(hq('owner',{...search,workspace:'church'}),/hq_work_only/);
 await assert.rejects(hq('owner',{...search,criteria:{...criteria,limit:11}}),/hq_invalid_input/);
 const authenticate=async()=>({id:'fixture-owner',app_metadata:{},user_metadata:{hana_office_access:true}});
 const run=control({authenticate,businessHQ:hq});
 const req=token=>new Request('https://example.invalid',{method:'POST',headers:token?{authorization:'Bearer fixture'}:{},body:JSON.stringify(search)});
 assert.equal((await run(req())).status,401);
 assert.equal((await run(req(true))).status,403);
});

test('search differentiates empty results, rate limits and provider failures without returning private details',async()=>{
 const adapter=response=>publicBusinessDiscovery({enabled:true,apiKey:'fixture',fetcher:async()=>response});
 assert.deepEqual(await adapter(Response.json({type:'search'})).find(criteria),[]);
 await assert.rejects(adapter(new Response('raw provider credential',{status:429})).find(criteria),{code:'hq_discovery_rate_limited'});
 await assert.rejects(adapter(new Response('raw provider credential',{status:503})).find(criteria),{code:'hq_discovery_unavailable'});
 await assert.rejects(adapter(Response.json({unexpected:[]})).find(criteria),{code:'hq_discovery_unavailable'});
});
