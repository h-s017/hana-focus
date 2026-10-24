import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import {loginController,consumeCallback,authMessage} from './office-auth.mjs';
import {STATES,NEXT_ROLE} from './office-workflow.mjs';
import {mountMaterials} from './project-materials.mjs';
import {availableSlots} from './calendar-availability.mjs';
const host=document.getElementById('hana-office-root');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=createClient('https://ihmvziqisputjnjkuhvm.supabase.co','sb_publishable_xipXAHCwziguVpbr3DEN-w_AI6Cap3f',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let draftRequestId=crypto.randomUUID();
let disposeMaterials=null,materialsOwner=null;
let current=null,loading=false;const busy=new Set();let refreshVersion=0;
host.innerHTML=`<section><h2>登入與雲端工作</h2><label>電子郵件<input id="office-email" type="email" autocomplete="email"></label><button id="office-login">寄送登入連結</button><button id="office-logout" hidden>登出</button><p id="office-session" role="status" aria-live="polite">正在確認登入狀態…</p></section>
<section id="office-private" hidden><section id="office-materials"></section><h2>專案與任務</h2><p>內部雲端資料與原本本機工作板分開保存，不會覆蓋 HANA WORK／CHURCH WORK。本人核准不代表客戶核准或正式交付。</p><form id="office-form"><label>專案<input name="project" value="文慶雞" maxlength="100" required></label><label>角色<select name="role"><option>Project Manager</option><option>Brand Strategist</option><option>Creative Producer</option></select></label><label>標題<input name="title" maxlength="140" required></label><label>需求與來源<textarea name="brief" rows="5" maxlength="12000" required></textarea></label><label>建議期限<input name="due" type="datetime-local"></label><button id="office-add">儲存雲端任務</button></form><button id="office-refresh">重新整理</button><button id="office-bkc">載入文慶雞測試需求（不自動送出）</button><label>篩選<select id="office-filter"><option value="">全部</option><option value="review">待本人審核</option><option value="approved">本人核准・未交付</option><option value="failed">失敗</option></select></label><p id="office-notice" role="status" aria-live="polite"></p><div id="office-tasks"></div></section>
<section><h2>Google Calendar 與課程預約</h2><p>伺服端 OAuth／正式預約同步尚未啟用。以下只用合成事件驗證 Asia/Taipei 時段計算，不讀取或更動客戶預約，不寄送通知。</p><button id="office-calendar-preview">試算範例不可預約時段</button><pre id="office-calendar-result"></pre></section>`;
const $=id=>document.getElementById('office-'+id),message=s=>$('notice').textContent=s;
const controller=loginController({auth:db.auth,storage:localStorage,withLock:fn=>navigator.locks?navigator.locks.request('hana-office-login',fn):fn()});
function loggedOut(){disposeMaterials?.();disposeMaterials=null;materialsOwner=null;current=null;refreshVersion++;$('private').hidden=true;$('tasks').replaceChildren();$('logout').hidden=true;}
async function sync(){
 try{const {data:{session},error}=await db.auth.getSession();if(error)throw error;current=session;
 $('private').hidden=!session;$('logout').hidden=!session;
 $('session').textContent=session?'已登入：'+session.user.email:'未登入，請使用最新登入郵件。';
 if(session){if(materialsOwner!==session.user.id){disposeMaterials?.();disposeMaterials=mountMaterials($('materials'),{db,owner:session.user.id});materialsOwner=session.user.id;}await refresh();}else loggedOut();
 }catch{loggedOut();$('session').textContent='無法確認登入狀態，請重新登入。';}
}
$('login').onclick=async()=>{$('login').disabled=true;const result=await controller.send($('email').value);$('session').textContent=result.message;$('login').disabled=false;};
setInterval(()=>{const sec=Math.ceil(controller.remaining()/1000);if(!$('login').disabled)$('login').textContent=sec?'請等待 '+sec+' 秒':'寄送登入連結';},1000);
$('logout').onclick=async()=>{try{const {error}=await db.auth.signOut();if(error)throw error;loggedOut();$('session').textContent='已登出。';}catch{$('session').textContent='登出未成功，請重試；目前登入狀態尚未清除。';}};
$('form').addEventListener('input',()=>{draftRequestId=crypto.randomUUID();});
$('form').onsubmit=async e=>{e.preventDefault();if(!current||loading)return;loading=true;$('add').disabled=true;
 try{const f=new FormData(e.target),due=f.get('due');
 // datetime-local has no zone: interpret explicitly as Taipei, independent of the device timezone.
 const due_at=due?new Date(due+':00+08:00').toISOString():null;
 const data={owner_id:current.user.id,project:String(f.get('project')).trim(),title:String(f.get('title')).trim(),role:f.get('role'),brief:String(f.get('brief')).trim(),due_at,request_id:draftRequestId};
 if(!data.project||!data.title||!data.brief)throw Error('invalid');
 const {error}=await db.from('hana_tasks').insert(data);if(error)throw error;
 draftRequestId=crypto.randomUUID();message('任務已儲存；尚未執行或寄送。');await refresh();
 }catch{message('儲存未確認成功。請先重新整理檢查，避免重複新增；確認登入與資料庫版本。');}
 finally{loading=false;$('add').disabled=false;}
};
$('refresh').onclick=refresh;$('filter').onchange=refresh;
$('bkc').onclick=()=>{const f=$('form');f.elements.project.value='文慶雞';f.elements.role.value='Project Manager';f.elements.title.value='文慶雞｜策略→審核→設計規劃測試';f.elements.brief.value='AI測試草稿，非客戶核准資料。保留既有文慶雞識別。品牌紅 #A4655F／#BF3A34、圓形雙筷／BKC家徽、報價B／C包裝範圍皆待HANA核准。策略來源：https://docs.google.com/document/d/15aRA0TDcv0JAxJvQMh-vWDPwC9Pc-yWI71IaULnRvDA/edit\nNotion來源：https://app.notion.com/p/3fc9b41981ae8112bef6d0aa5b9616e3\n先產工作分解與待確認事項。策略本人審核後才交Creative Producer，再次核准後交PM彙整。G1–G5不得自動通過；未取得原檔不宣稱設計交付完成。';message('已載入需求，請核對後手動儲存。');};
const errors={ai_not_configured:'本版尚未啟用付費 AI；任務維持排隊中，可先使用 PM 規則式草稿。',office_access_required:'此帳號尚未取得AI OFFICE服務端授權。',state_conflict:'狀態已變更或請求重複，請重新整理。',provider_failed:'AI服務失敗，任務已記錄失敗，可人工重試。',provider_timeout:'AI服務逾時，任務已記錄失敗。',operation_failed:'操作未確認成功；請先重新整理檢查，不要連續重試。'};
async function action(task,kind,decision){if(!current||busy.has(task.id))return;busy.add(task.id);message('處理中，請勿重複點擊…');
 try{const {data,error}=await db.functions.invoke('hana-agent',{body:{task_id:task.id,action:kind,decision,request_id:crypto.randomUUID()}});
 if(error){let code;try{code=(await error.context?.json())?.error;}catch{}message(errors[code]||'服務未完成，請確認登入、後端版本或系統設定。');}
 else if(data?.error)message(errors[data.error]||'操作未完成，請重新整理。');else message(kind==='review'?'本人審核已記錄；未對外發布。':'操作已記錄，請確認下方狀態。');
 }catch{message('網路中斷，結果未知。請重新整理確認後再操作。');}finally{busy.delete(task.id);await refresh();}
}
async function refresh(){if(!current)return;const v=++refreshVersion,owner=current.user.id;try{
 const {data,error}=await db.from('hana_tasks').select('*').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100);if(error)throw error;
 if(v!==refreshVersion||!current||current.user.id!==owner)return;
 const {data:runs,error:runError}=await db.from('hana_task_runs').select('id,task_id,status,error_code,created_at').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100);
 const {data:reviews,error:reviewError}=await db.from('hana_reviews').select('task_id,decision,created_at').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100);
 if(v!==refreshVersion||!current||current.user.id!==owner)return;
 $('tasks').replaceChildren();
 if(runError||reviewError)message('部分執行或審核紀錄無法載入，請確認後端版本與權限；未代表沒有紀錄。');
 for(const t of data||[]){if($('filter').value&&$('filter').value!==t.status)continue;
 const el=document.createElement('article');el.innerHTML='<h3>'+escape(t.title)+'</h3><p>'+escape(t.project)+'｜'+escape(t.role)+'｜'+escape(STATES[t.status]||'未知狀態')+'</p><small>'+escape(new Date(t.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))+'</small>'+(t.due_at?'<p>期限：'+escape(new Date(t.due_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))+'</p>':'')+'<p>'+escape(t.brief)+'</p>'+(t.result?'<pre>'+escape(t.result)+'</pre>':'');
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.disabled=busy.has(t.id);b.onclick=fn;el.append(b);};
 if(['queued','failed'].includes(t.status))button(t.role==='Project Manager'?'產生PM進度草稿':'執行AI草稿',()=>action(t,'generate'));
 if(t.status==='review')for(const [text,d] of [['核准內部草稿','approved'],['退回修改','rejected']])button(text,()=>{if(confirm(text+'？此操作不代表客戶核准、不會對外發布。'))action(t,'review',d);});
 if(t.status==='rejected')button('重新排隊（不自動執行）',()=>action(t,'requeue'));
 if(t.status==='running' && Date.now()-Date.parse(t.updated_at)>600000)button('回收逾時任務',()=>action(t,'recover'));
 if(t.status==='approved' && !(t.role==='Project Manager'&&t.parent_task_id))button('建立交接草稿 → '+NEXT_ROLE[t.role],()=>action(t,'handoff'));
 const log=document.createElement('p');log.className='muted';log.textContent='執行紀錄：'+((runs||[]).filter(r=>r.task_id===t.id).map(r=>r.status+(r.error_code?' / '+r.error_code:'')).join('；')||'尚無已載入紀錄')+'｜本人審核：'+((reviews||[]).filter(r=>r.task_id===t.id).map(r=>r.decision).join('；')||'尚無已載入紀錄');el.append(log);$('tasks').append(el);
 }
 }catch{if(v===refreshVersion)message('無法載入任務，請確認登入與網路；未清除任何資料。');}}
$('calendar-preview').onclick=()=>{const result=availableSlots([{status:'confirmed',start:{dateTime:'2026-10-26T10:00:00+08:00'},end:{dateTime:'2026-10-26T11:00:00+08:00'}}],{start:'2026-10-26T09:00:00+08:00',end:'2026-10-26T12:00:00+08:00',durationMinutes:60});$('calendar-result').textContent='合成資料測試，非正式預約時段：\n'+result.map(s=>new Date(s.start).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})+'–'+new Date(s.end).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})).join('\n');};
db.auth.onAuthStateChange(()=>setTimeout(sync,0));
const callback=await consumeCallback({auth:db.auth,href:location.href,replace:path=>history.replaceState(null,'',path)});
await sync();if(callback.handled)$('session').textContent=callback.message;
