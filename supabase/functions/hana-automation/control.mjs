import {configuration,priorities} from './runtime.mjs';
const headers={'Access-Control-Allow-Origin':'https://h-s017.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const response=(body,status=200)=>Response.json(body,{status,headers});
export function control({authenticate,store,connector,readiness,calendarPreview,booking,reservations,monthly,focus,googleOAuth,canvaOAuth}) {
 return async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!=='https://h-s017.github.io')return response({error:'origin_not_allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return response({error:'method_not_allowed'},405);
  let user;try{const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))throw Error();user=await authenticate(auth.slice(7));}catch{return response({error:'login_required'},401);}
  if(!user?.id||user.app_metadata?.hana_office_access!==true)return response({error:'office_access_required'},403);
  const owner=user.id;
  try{
   const text=await req.text();if(text.length>600000)return response({error:'invalid_body'},400);const body=JSON.parse(text);
   if(!body||typeof body!=='object')return response({error:'invalid_body'},400);
   if(body.action?.startsWith('focus_')){if(!focus)return response({error:'focus_unavailable'},409);return response(await focus(owner,body));}
   if(text.length>6000)return response({error:'invalid_body'},400);
   const ready=readiness();
   if(['canva_oauth_start','canva_oauth_finish','canva_oauth_status'].includes(body.action)){if(!canvaOAuth)return response({error:'canva_oauth_setup_required'},409);return response(await canvaOAuth(owner,body));}
   if(['google_oauth_start','google_oauth_finish'].includes(body.action)){if(!googleOAuth)return response({error:'google_oauth_setup_required'},409);return response(await googleOAuth(owner,body));}
   if(['monthly_load','monthly_generate','monthly_review'].includes(body.action)){if(!monthly)return response({error:'monthly_unavailable'},409);return response(await monthly(owner,body));}
   if(body.action==='reservation_details'){if(!reservations)return response({error:'reservation_connection_required'},409);return response(await reservations.list(user,body.cursor||null));}
   if(['booking_list','booking_slots','booking_save','booking_review'].includes(body.action)){if(!booking)return response({error:'booking_source_unavailable'},409);return response(await booking(owner,body,user));}
   if(body.action==='status')return response({readiness:ready,settings:await store.settings(owner),priorities:priorities(await store.tasks(owner)),events:await store.events(owner)});
   if(body.action==='calendar_preview'){if(!ready.calendar||!calendarPreview)return response({error:'calendar_authorization_required'},409);try{return response(await calendarPreview(owner,body.start,body.end));}catch(error){try{await store.event(owner,'課程預約',null,null,'calendar_preview_failed',{external_writes:false});}catch{}throw error;}}
   if(body.action==='configure'){
    const settings=configuration(body);
    if(settings.enabled&&!ready.worker)return response({error:'activation_required'},409);
    if(settings.source_read_allowed){if(!ready.microsoft)return response({error:'source_unavailable'},409);const folder=await connector.folders(owner,settings.source_item_id);if(folder.current.name.trim().normalize('NFC')!==settings.project.trim().normalize('NFC'))throw Object.assign(Error('folder_project_mismatch'),{code:'folder_project_mismatch'});}
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
   const safe=['canva_oauth_setup_required','canva_oauth_owner_required','canva_oauth_browser_required','canva_oauth_rate_limited','canva_oauth_invalid','canva_oauth_expired','canva_oauth_upstream_failed','canva_oauth_scope_required','canva_oauth_refresh_required','google_oauth_setup_required','google_oauth_owner_required','google_oauth_browser_required','google_oauth_rate_limited','google_oauth_invalid','google_oauth_expired','google_oauth_upstream_failed','google_oauth_scope_required','google_oauth_refresh_required','invalid_focus_request','invalid_focus_bundle','scope_or_version_required','project_required','backup_checksum_mismatch','invalid_backup','local_batch_too_large','notion_authorization_required','notion_source_required','notion_rate_limited','notion_incomplete','notion_scope_mismatch','notion_unavailable','focus_tool_failed','invalid_monthly','monthly_conflict','monthly_unavailable','invalid_settings','invalid_folder','scope_required','folder_required','source_unavailable','source_expired','source_limit','source_denied','calendar_authorization_required','calendar_unavailable','calendar_incomplete','calendar_timezone_required','reservation_unavailable','invalid_window','folder_project_mismatch','invalid_booking_change','capacity_below_booked','booking_source_unavailable','booking_source_unverified','booking_source_changed','reservation_read_access_required','reservation_connection_required','reservation_read_unavailable','reservation_read_incomplete','invalid_reservation_cursor'];
   return response({error:safe.includes(error.code)?error.code:'operation_unavailable'},error.code==='reservation_read_access_required'?403:409);
  }
 };
}

