import {notionTask} from '../../../js/focus-domain.mjs';
const fail=code=>Object.assign(Error(code),{code});
// This adapter cannot send edits to Notion. POST is restricted to read-only data-source queries.
export function notionSource({token,ownerId,fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 return async(owner,config,since=null)=>{
  if(!token||owner!==ownerId)throw fail('notion_authorization_required');
  const source=config?.data_source_id;if(!/^[0-9a-f-]{32,36}$/i.test(source||''))throw fail('notion_source_required');
  const projectPrefix=config.project_prefix;if(typeof projectPrefix!=='string'||!projectPrefix.trim())throw fail('notion_source_required');
  let cursor,rows=[],maxEdited=since||null;const seen=new Set();
  for(let page=0;page<10;page++){
   const filter={and:[{property:'任務',title:{contains:projectPrefix}},...(since?[{timestamp:'last_edited_time',last_edited_time:{on_or_after:since}}]:[])]};
   let response;
   for(let attempt=0;attempt<3;attempt++){
    response=await fetcher('https://api.notion.com/v1/data_sources/'+source+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify({page_size:100,filter,sorts:[{timestamp:'last_edited_time',direction:'ascending'}],...(cursor?{start_cursor:cursor}:{})}),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.status!==429)break;if(attempt===2)throw fail('notion_rate_limited');await pause(Math.min(3,Math.max(1,Number(response.headers.get('retry-after'))||1))*1000);
   }
   if(!response.ok)throw fail([401,403].includes(response.status)?'notion_authorization_required':'notion_unavailable');
   const text=await response.text();if(text.length>2000000)throw fail('notion_incomplete');let data;try{data=JSON.parse(text);}catch{throw fail('notion_incomplete');}
   if(!Array.isArray(data.results))throw fail('notion_incomplete');
   for(const value of data.results){if(value.archived||value.in_trash)continue;const task=notionTask(value,config.version);if(!task.title.includes(projectPrefix))throw fail('notion_scope_mismatch');rows.push(task);if(!maxEdited||task.source_edited_at>maxEdited)maxEdited=task.source_edited_at;}
   if(!data.has_more)return {tasks:rows,cursor:maxEdited,complete:true};cursor=data.next_cursor;if(typeof cursor!=='string'||seen.has(cursor))throw fail('notion_incomplete');seen.add(cursor);
  }
  throw fail('notion_incomplete');
 };
}
