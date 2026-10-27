import {pmIntakePlan} from './work-intake.mjs';
export const WORK_STATES=['todo','in_progress','waiting','done'];
export const AGENT_ROLES=['Project Manager','Brand Strategist','Creative Producer'];
const notional={'未開始':'todo','進行中':'in_progress','等待中':'waiting','完成':'done'};
const localStates={'待規劃':'todo','進行中':'in_progress','準備文稿中':'in_progress','等待本人決策':'waiting','等待回覆':'waiting','等待本人審核':'waiting','暫停':'waiting','已完成':'done','AI 初稿準備':'todo'};
export const normalizeTitle=value=>String(value||'').normalize('NFKC').replace(/[\s｜|【】\[\]：:、，,／/]/g,'').toLocaleLowerCase();
export function scopeFor(title,version){
 const name=normalizeTitle(title),excluded=version?.excluded_terms||[],included=version?.included_terms||[];
 if(excluded.some(x=>name.includes(normalizeTitle(x))))return 'out_of_scope';
 if(included.some(x=>name.includes(normalizeTitle(x))))return 'in_scope';return 'needs_review';
}
export function canonicalFor(title){return /沿革牆/.test(title)?'history_wall':null;}
export function notionTask(page,version){
 const p=page.properties||{},text=x=>Array.isArray(x)?x.map(v=>v.plain_text||v.text?.content||'').join(''):'';
 const title=text(p['任務']?.title),source=p['狀態']?.select?.name||p['狀態']?.status?.name;
 if(!/^[0-9a-f-]{32,36}$/i.test(page.id||'')||!title||title.length>140||!notional[source]||!Number.isFinite(Date.parse(page.last_edited_time)))throw Error('invalid_notion_task');
 return {external_id:page.id.replace(/-/g,'').toLowerCase(),title,brief:text(p['備註']?.rich_text).slice(0,12000),work_state:notional[source],priority:({'P1':1,'P2':2,'P3':3})[p['優先度']?.select?.name]||2,assigned_role:'HANA',scope_status:scopeFor(title,version),canonical_key:canonicalFor(title),source_url:'https://www.notion.so/'+page.id.replace(/-/g,''),source_edited_at:page.last_edited_time,source_system:'notion'};
}
export function localTask(t,workspace,device){
 if(!t||typeof t.id!=='string'||!t.id||typeof t.title!=='string'||!t.title.trim()||t.title.length>140||typeof t.project!=='string'||t.project.length>100||!localStates[t.status])throw Error('invalid_local_task');
 if(!['work','church'].includes(workspace)||!device)throw Error('invalid_workspace');
 return {external_id:device+':'+workspace+':'+t.id,title:t.title.trim(),project:t.project,brief:'原工作類型：'+String(t.role||'')+'；原狀態：'+t.status,work_state:localStates[t.status],priority:[1,2,3].includes(Number(t.importance))?4-Number(t.importance):2,assigned_role:String(t.role||'HANA'),scope_status:'needs_review',source_system:'local',source_payload:structuredClone(t),workspace,due_at:t.due?new Date(t.due+'T23:59:59+08:00').toISOString():null};
}
export function focusSummary(tasks,now=Date.now()){
 const active=tasks.filter(t=>t.scope_status==='in_scope'&&t.is_current!==false&&!t.parent_task_id);
 const due=t=>Date.parse(t.due_at)||Infinity;
 return {total:active.length,done:active.filter(t=>t.work_state==='done').length,excluded:tasks.filter(t=>t.scope_status==='out_of_scope').length,needsScopeReview:tasks.filter(t=>t.scope_status==='needs_review').length,top3:active.filter(t=>t.work_state!=='done').sort((a,b)=>(a.priority||2)-(b.priority||2)||due(a)-due(b)).slice(0,3),overdue:active.filter(t=>t.work_state!=='done'&&due(t)<now).map(t=>t.id),dependencyConflicts:active.filter(t=>(t.dependencies||[]).some(id=>!active.some(p=>p.id===id&&p.work_state==='done'))).map(t=>t.id)};
}
export function roleTool(role,{project,version,tasks,documents,priorVersions=[],task}){
 if(!AGENT_ROLES.includes(role))throw Error('invalid_role');const summary=focusSummary(tasks),cite=documents.map(d=>({id:d.id||d.external_id,url:d.source_url,version:d.content_hash}));
 const header='免費工具分析草稿（非生成式AI）｜'+role+'\n待 HANA 內部審核；不代表客戶核准、正式完稿或交付。\n';
 let result;
 if(role==='Project Manager')result={...(task?pmIntakePlan(task):{action:'verified_task_analysis'}),project:project.name,version:version.label,summary:{...summary,top3:summary.top3.map(t=>({id:t.id,title:t.title,work_state:t.work_state,priority:t.priority,due_at:t.due_at||null}))}};
 if(role==='Brand Strategist'){
  const source=documents.map(d=>d.content||'').join('\n');result={action:'source_and_version_comparison',sourceCount:documents.length,versionChanges:priorVersions.map(v=>({from:v.label,to:version.label,scopeChanged:JSON.stringify({contract:v.contract,included:v.included_terms,excluded:v.excluded_terms})!==JSON.stringify({contract:version.contract,included:version.included_terms,excluded:version.excluded_terms})})),historyDraft:documents.flatMap(d=>(d.content||'').split('\n').filter(line=>/1979|2002|2026|雞婆|第二代/.test(line)).slice(0,8).map(line=>({quote:line.slice(0,600),source:d.source_url,verification:'needs_verification'}))).slice(0,12),historyChecks:{background1979Present:source.includes('1979'),founding2002Present:source.includes('2002'),requiresHumanVerification:['文東記合作形式','雞婆雞飯時期年份','舊Logo及歷史圖片授權']},note:'只核對已連結來源與版本差異，未執行外部史料研究；來源提及不等於史實已考證。'};
 }
 if(role==='Creative Producer')result={action:'scope_and_design_spec_check',deliverableTasks:tasks.filter(t=>t.scope_status==='in_scope'&&t.is_current!==false&&!t.parent_task_id).map(t=>({title:t.title,work_state:t.work_state})),requirements:['須取得並核對既有施工圖及長向立面圖；本工具未讀取原圖','保留二丁掛與桌椅配置高度，不改牆面設計','缺現場尺寸、素材或權利證明時列待確認'],toolExecution:'尚未串接或執行設計工具；此結果是規格核對草稿，不是設計成品。'};
 return header+JSON.stringify({...result,sources:cite,externalWrites:false,paidApiCalls:0},null,2);
}
