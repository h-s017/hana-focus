import {configuration,priorities} from './runtime.mjs';
const headers={'Access-Control-Allow-Origin':'https://h-s017.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const response=(body,status=200)=>Response.json(body,{status,headers});
export function control({authenticate,store,connector,readiness}) {
 return async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!=='https://h-s017.github.io')return response({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return response({error:'method_not_allowed'},405);
  let user;try{const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))throw Error();user=await authenticate(auth.slice(7));}catch{return response({error:'login_required'},401);}
  if(!user?.id||user.app_metadata?.hana_office_access!==true)return response({error:'office_access_required'},403);
  const owner=user.id;
  try{
   const text=await req.text();if(text.length>6000)return response({error:'invalid_body'},400);const body=JSON.parse(text);
   if(!body||typeof body!=='object')return response({error:'invalid_body'},400);
   const ready=readiness();
   if(body.action==='status')return response({readiness:ready,settings:await store.settings(owner),priorities:priorities(await store.tasks(owner)),events:await store.events(owner)});
   if(body.action==='configure'){
    const settings=configuration(body);
    if(settings.enabled&&!ready.worker)return response({error:'activation_required'},409);
    if(settings.source_read_allowed){if(!ready.microsoft)return response({error:'source_unavailable'},409);await connector.folders(owner,settings.source_item_id);}
    await store.configure(owner,settings);
    await store.event(owner,settings.project,null,null,settings.enabled?'human_enabled':'human_paused',{daily_limit:settings.daily_limit,source_read_allowed:settings.source_read_allowed});
    return response({status:settings.enabled?'enabled':'paused'});
   }
   if(body.action==='retry'){
    if(!/^[0-9a-f-]{36}$/i.test(body.task_id||''))return response({error:'invalid_task_id'},400);
    return response({status:await store.retry(owner,body.task_id)});
   }
   if(!ready.microsoft)return response({error:'source_unavailable'},409);
   if(body.action==='device_start')return response(await connector.start(owner));
   if(body.action==='device_finish')return response(await connector.finish(owner));
   if(body.action==='folders')return response(await connector.folders(owner,body.item_id||null));
   return response({error:'invalid_action'},400);
  }catch(error){
   const safe=['invalid_settings','invalid_folder','scope_required','folder_required','source_unavailable','source_expired','source_limit','source_denied'];
   return response({error:safe.includes(error.code)?error.code:'operation_unavailable'},409);
  }
 };
}
