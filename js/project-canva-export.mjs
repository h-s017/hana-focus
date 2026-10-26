// HANA Focus — deterministic internal Canva source documents.
// Source scope and client approval are NEVER inferred from a project name or AI suggestions.
export const CANVA_FORMATS=Object.freeze(['A4直式','簡報16:9','使用者指定']);
const clean=(x,max=300)=>String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max);
const csvCell=value=>{
 let text=String(value??'');
 if(/^\s*[=+@]/.test(text)||/^\s*-(?!\d)/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
};
const safeName=s=>clean(s,40).replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-')||'project';
const state={todo:'未開始',in_progress:'進行中',waiting:'等待中',done:'內部工作完成'};
const safeList=(value)=>Array.isArray(value)?value.filter(x=>typeof x==='string').map(x=>clean(x,120)).filter(Boolean):[];
const shortList=(items,limit=5)=>items.length?items.slice(0,limit).join('；')+(items.length>limit?'（另有 '+(items.length-limit)+' 項，請看完整文件）':''):'尚無來源佐證';
export function createInternalCanvaPackage({project,version,tasks=[],documents=[],format='A4直式'}){
 if(!project||typeof project.name!=='string'||!project.name.trim()||!version||typeof version.label!=='string')throw Error('project_version_required');
 if(!CANVA_FORMATS.includes(format))throw Error('invalid_format');
 const inScope=tasks.filter(t=>t.project_id===project.id&&t.version_id===version.id&&t.scope_status==='in_scope');
 const pending=tasks.filter(t=>t.project_id===project.id&&t.version_id===version.id&&t.scope_status==='needs_review');
 const excluded=tasks.filter(t=>t.project_id===project.id&&t.version_id===version.id&&t.scope_status==='out_of_scope');
 const included=safeList(version.included_terms),omitted=safeList(version.excluded_terms);
 const clientApproved=version.contract?.client_approved===true;
 const notes=['文件僅供 HANA 內部編輯，不是客戶正式交付。',
  clientApproved?'來源版本註記為已核准，但此匯出未查驗核准憑證。':'未取得本版本客戶正式核准證據。',
  '任何空白或未核實資料不得自行補成事實。'];
 const pName=clean(project.name,100),label=clean(version.label,80);
 const pages=[
  {title:pName+'｜內部文件',body:'版本：'+label+'　｜　版型：'+format+'\n'+notes[0]},
  {title:'專案基準與版本',body:'專案：'+pName+'\n版本：'+label+'\n核准狀態：'+notes[1]},
  {title:'本次工作範圍',body:'原始範圍：'+shortList(included)+'\n已歸類範圍內任務：'+inScope.length+' 項'},
  {title:'本次工作與交付清單',body:shortList(inScope.map(t=>clean(t.title,80)),5)},
  {title:'排除與待確認事項',body:'排除：'+shortList(omitted)+'\n範圍外任務：'+excluded.length+' 項；待確認：'+pending.length+' 項'},
  {title:'來源與交付核對',body:'來源文件：'+documents.filter(d=>d.project_id===project.id).length+' 筆\n'+notes[2]}
 ];
 const fields={PROJECT:pName,VERSION:label,FORMAT:format,INTERNAL_ONLY:'TRUE'};
 pages.forEach((p,i)=>{const key='PAGE_'+String(i+1).padStart(2,'0');fields[key+'_TITLE']=p.title;fields[key+'_BODY']=p.body;});
 const csv='\uFEFF'+Object.keys(fields).map(csvCell).join(',')+'\r\n'+Object.values(fields).map(csvCell).join(',')+'\r\n';
 const lineList=(values)=>values.length?values.map(v=>'- '+v).join('\n'):'- 尚無來源資料';
 const taskLine=t=>'- '+clean(t.title,140)+'｜'+(state[t.work_state]||'狀態未確認')+'｜'+(t.source_system?clean(t.source_system,50):'來源未標註');
 const markdown=[
 '# '+pName+'｜內部 Canva 交付資料',
 '**文件性質：未對外交付的可修改內部稿**',
 '版型：'+format+'　／　版本：'+label,
 notes.map(n=>'- '+n).join('\n'),
 '## 本次納入的範圍',lineList(included),
 '## 本次排除的範圍',lineList(omitted),
 '## 納入本版本的工作',inScope.length?inScope.map(taskLine).join('\n'):'- 無已判定範圍內的任務',
 '## 範圍待確認',pending.length?pending.map(taskLine).join('\n'):'- 無',
 '## 保留備查（不納入交付）',excluded.length?excluded.map(taskLine).join('\n'):'- 無',
 '## 來源文件與證據', '現有來源文件共 '+documents.filter(d=>d.project_id===project.id).length+' 筆；原始頁面請從 HANA FOCUS「文件與來源」核對。',
 '## 交付限制','Canva CSV 只提供可填入六頁範本的文字；不代表已建立 Canva 設計或完成法律、製作、技術審核。'
 ].join('\n\n')+'\n';
 return {format,projectName:pName,version:label,pages,fields,csv,markdown,
   filenameBase:'hana-'+safeName(pName)+'-'+safeName(label)+'-internal',
   scope:{in_scope:inScope.length,out_of_scope:excluded.length,needs_review:pending.length},
   canvaCreated:false,clientDelivery:false};
}
