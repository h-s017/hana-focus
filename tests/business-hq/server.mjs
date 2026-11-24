// Real service code, real local Auth/REST/PG. Only URLs target the isolated stack.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {automationStore} from '../../supabase/functions/hana-automation/store.mjs';
import {focusService} from '../../supabase/functions/hana-automation/focus.mjs';
import {businessHQ} from '../../supabase/functions/hana-automation/hq.mjs';
import {hqStore} from '../../supabase/functions/hana-automation/hq-store.mjs';
import {publicSourceReader} from '../../supabase/functions/hana-automation/hq-source.mjs';
import {control} from '../../supabase/functions/hana-automation/control.mjs';
const cfg=JSON.parse(await readFile('/tmp/hana-hq-local-env.json','utf8'));
const {authenticate,store}=automationStore({url:cfg.url,service:cfg.service});
const sourceReader=publicSourceReader({allowedHosts:(process.env.HANA_HQ_TEST_SOURCE_HOSTS||'www.mozilla.org').split(',').filter(Boolean)});
const hq=businessHQ({store:hqStore({url:cfg.url,service:cfg.service}),sourceReader});
const controls=control({authenticate,store,allowedOrigin:cfg.url,businessHQ:hq,focus:focusService({store}),readiness:()=>({mode:'rules',paid_calls_enabled:false})});
const root=path.resolve('.');
const types={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,cfg.url);let response;
  if(u.pathname.startsWith('/auth/v1/')||u.pathname.startsWith('/rest/v1/')){
   const target=u.pathname.startsWith('/auth/v1/')?cfg.auth+u.pathname.slice('/auth/v1'.length):cfg.rest+u.pathname.slice('/rest/v1'.length);
   const body=[];for await(const c of req)body.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];delete headers.connection;
   response=await fetch(target+u.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)});
  }else if(u.pathname==='/functions/v1/hana-automation'){
   const body=[];for await(const c of req)body.push(c);
   response=await controls(new Request(cfg.url+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)}));
  }else if(u.pathname==='/js/office-client.mjs'){
   response=new Response("import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';export const db=createClient("+JSON.stringify(cfg.url)+','+JSON.stringify(cfg.anon)+",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});",{headers:{'Content-Type':'text/javascript'}});
  }else{
   const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/workspace.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error('invalid_path');
   response=new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream'}});
  }
  res.statusCode=response.status;for(const [k,v] of response.headers)if(!['content-encoding','content-length','transfer-encoding'].includes(k))res.setHeader(k,v);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"local_test_service_unavailable"}');}
});
server.listen(4177,'127.0.0.1',()=>console.log('Isolated HANA test app listening on http://127.0.0.1:4177 (no hosted writes).'));
