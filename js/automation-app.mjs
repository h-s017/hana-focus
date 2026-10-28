import {mountBooking} from './booking-app.mjs';
export function mountAutomation(host,{db,owner}) {
 let disposed=false,busy=false,version=0,folder=null;
 const element=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 const title=element('h2','半自主 Agent｜內部工作');
 const note=element('p','啟用後可在關閉聊天時執行草稿；每個角色的成果仍需本人審核。這裡不會自動寄送、發布、付款或交付。尚未部署後端或未核准啟用時，不會執行。');
 const status=element('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const form=element('form'),inputs={};
 for(const [name,label,type] of [['project','專案名稱','text'],['scope_note','本次工作範圍（例如：只做沿革牆）','text'],['daily_limit','專案每日執行次數上限（1–6）','number']]){
  const input=element('input');input.name=name;input.type=type;input.required=true;
  if(name==='daily_limit'){input.min=1;input.max=6;input.value='3';}else input.maxLength=name==='project'?100:2000;
  const wrap=element('label',label);wrap.append(input);form.append(wrap);inputs[name]=input;
 }
 for(const [name,label] of [['source_read_allowed','授權讀取與專案同名的 OneDrive 資料夾；文字與照片只在另有 AI 預算時傳給服務產稿'],['enabled','啟用 PM 規則式背景整理（不呼叫付費 AI）']]){
  const input=element('input');input.type='checkbox';input.name=name;input.style.width='auto';const wrap=element('label',label);wrap.append(input);form.append(wrap);inputs[name]=input;
 }
 const folderLabel=element('p','尚未選擇可讀資料夾。保存素材連結不等於授權 Agent 讀檔。');
 const button=(text,fn)=>{const b=element('button',text);b.type='button';b.onclick=fn;return b;};
 const save=element('button','儲存自動化設定');form.append(folderLabel,save);
 const oneDrive=element('section');oneDrive.id='office-onedrive-connection';
 const connectionTitle=element('h3','OneDrive｜唯讀連線');
 const connectionStatus=element('p','尚未確認 OneDrive 連線。請先按「檢查 OneDrive 連線」。');
 connectionStatus.setAttribute('role','status');connectionStatus.setAttribute('aria-live','polite');
 const loginCode=element('strong');loginCode.id='office-onedrive-code';loginCode.hidden=true;
 const microsoftLink=element('a','開啟 Microsoft 官方授權頁');
 microsoftLink.href='https://microsoft.com/devicelogin';microsoftLink.target='_blank';microsoftLink.rel='noopener noreferrer';microsoftLink.hidden=true;
 const connect=button('連接 OneDrive（唯讀）',()=>operate(async()=>{
  loginCode.hidden=true;microsoftLink.hidden=true;
  const data=await invoke({action:'device_start'});
  if(typeof data.user_code!=='string'||!/^[A-Z0-9-]{4,20}$/.test(data.user_code))throw Error('Microsoft 尚未提供有效登入代碼，請重新檢查服務端設定。');
  loginCode.textContent='Microsoft 登入代碼：'+data.user_code;
  loginCode.hidden=false;microsoftLink.hidden=false;
  connectionStatus.textContent='已取得一次性代碼。請點下方 Microsoft 官方登入連結、輸入代碼，完成授權後返回按「確認連線」。';
 },{target:connectionStatus,message:'正在向 Microsoft 取得一次性登入代碼…'}));
 const finish=button('確認連線',()=>operate(async()=>{
  const data=await invoke({action:'device_finish'});
  if(data.status==='connected'){
   connectionStatus.textContent='OneDrive 唯讀授權憑證已安全儲存。下一步可選擇專案資料夾。';
   loginCode.hidden=true;microsoftLink.hidden=true;
  }else if(data.status==='pending'){
   connectionStatus.textContent='Microsoft 尚未完成授權；請確認登入頁已同意，約 '+Math.max(5,Number(data.retry_after)||5)+' 秒後重試。';
  }else throw Error('尚未確認 Microsoft 授權；沒有修改任何 OneDrive 檔案。');
 },{target:connectionStatus,message:'正在核對 Microsoft 授權結果…'}));
 const picker=element('div'),summary=element('div'),configs=element('div'),events=element('div');
 const browse=button('選擇 OneDrive 資料夾',()=>folders());
 const checkConnection=button('檢查 OneDrive 連線',()=>operate(async()=>{
  const data=await invoke({action:'microsoft_status'});
  connectionStatus.textContent=!data.configured?'OneDrive 服務端設定尚未完成：請核對 MICROSOFT_CLIENT_ID 與原有加密金鑰。':data.credentials_saved?'已儲存 OneDrive 唯讀授權憑證；若要驗證資料夾讀取，請點「選擇 OneDrive 資料夾」。':'Microsoft 服務端設定已就緒，但尚未授權 OneDrive。請點「連接 OneDrive（唯讀）」。';
 },{target:connectionStatus,message:'正在檢查 OneDrive 服務端設定與授權狀態…'}));
 const reload=button('更新 Agent 狀態',()=>load());
 oneDrive.append(connectionTitle,connectionStatus,connect,finish,checkConnection,loginCode,microsoftLink,browse,picker);
 host.replaceChildren(title,note,oneDrive,form,reload,status,summary,configs,events);
 const errors={activation_required:'服務端尚未核准啟用或缺少 AI 設定；沒有開始執行。',folder_project_mismatch:'資料夾名稱必須與專案名稱一致，請重新選取。',invalid_booking_change:'請核對時段、訂單編號與修改內容。',capacity_below_booked:'新名額不得低於已報名人數。',booking_source_unavailable:'原系統資料暫時無法讀取；正式預約未變更。',booking_source_unverified:'原訂單與付款狀態未核對，不能核准此草稿。',booking_source_changed:'原系統時段已有變更，請重新讀取並建立新草稿。',source_unavailable:'OneDrive 連線尚未設定或服務暫時無法使用。',source_expired:'OneDrive 授權已過期或取消，請重新連接。',source_denied:'無權讀取此來源；不會自動擴大 Microsoft 權限。',folder_required:'請先選擇資料夾。',calendar_authorization_required:'Google Calendar 服務端尚未取得唯讀授權；聊天連線不等同網站持續同步。',calendar_unavailable:'日曆讀取失敗，未修改任何預約時段。',calendar_incomplete:'日曆資料不完整，無法產出可用時段建議。',calendar_timezone_required:'來源日曆不是 Asia/Taipei，需先確認全日行程解讀。',reservation_unavailable:'預約系統資料無法讀取，正式網站未變動。',invalid_window:'請設定有效且不超過 31 天的日期範圍。',scope_required:'請填寫本輪工作範圍。',invalid_settings:'請確認專案名稱、範圍及每日 1–6 次上限。'};
 async function invoke(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error){let code;try{code=(await error.context?.json())?.error;}catch{}throw Error(errors[code]||'自動化服務尚未部署或無法使用；原任務不受影響。');}if(data?.error)throw Error(errors[data.error]||'操作未完成，請重新整理確認。');return data;}
 async function operate(fn,{target=status,message='正在處理請求…'}={}){
  if(disposed||busy)return;
  busy=true;
  for(const b of [save,connect,finish,browse,checkConnection])b.disabled=true;
  if(!disposed)target.textContent=message;
  try{await fn();}
  catch(error){if(!disposed)target.textContent=error?.message||'請求未完成，請檢查網路與服務端設定。';}
  finally{busy=false;if(!disposed)for(const b of [save,connect,finish,browse,checkConnection])b.disabled=false;}
 }
 async function folders(id=null){await operate(async()=>{const data=await invoke({action:'folders',item_id:id});if(disposed)return;picker.replaceChildren(element('p','目前資料夾：'+data.current.name));picker.append(button('選用此資料夾',()=>{folder=data.current;folderLabel.textContent='選定資料夾：'+folder.name+'（尚未儲存授權）';}));if(id)picker.append(button('返回 OneDrive 根目錄',()=>folders()));for(const f of data.folders)picker.append(button('開啟 '+f.name,()=>folders(f.id)));if(data.limited)picker.append(element('p','僅顯示前 100 個項目，部分資料夾可能未列出。'));connectionStatus.textContent='OneDrive 資料夾清單已載入，可選擇與專案同名的資料夾（不會修改檔案）。';},{target:connectionStatus,message:'正在從 Microsoft 讀取 OneDrive 資料夾…'});}
 form.onsubmit=event=>{event.preventDefault();if(inputs.enabled.checked&&!confirm('啟用免費 PM 規則式背景整理？策略、創意與照片理解不會自動呼叫付費 AI。'))return;
  void operate(async()=>{await invoke({action:'configure',project:inputs.project.value,scope_note:inputs.scope_note.value,daily_limit:Number(inputs.daily_limit.value),source_item_id:folder?.id||null,source_read_allowed:inputs.source_read_allowed.checked,enabled:inputs.enabled.checked});if(disposed)return;status.textContent=inputs.enabled.checked?'已儲存啟用設定；排程是否運作請查看執行紀錄。':'已儲存暫停設定；已送出的請求不會被撤回。';await load(false);});
 };
 async function load(announce=true){const v=++version;try{const data=await invoke({action:'status'});if(disposed||v!==version)return;
  if(announce)status.textContent=data.readiness.worker?'免費 PM 背景整理已就緒；AI API 預算 NT$0，各專案仍需啟用。':'背景執行目前關閉或設定未齊，不會呼叫 AI。';
  summary.replaceChildren(element('h3','今日最多三項優先工作（規則排序）'));for(const t of data.priorities){summary.append(element('p',t.project+'｜'+t.title+'｜'+t.status+(t.overdue?'｜已逾期':'')));if(t.status==='failed')summary.append(button('重新排隊：'+t.title,()=>operate(async()=>{if(!confirm('目前 NT$0 模式只會自動整理 PM 草稿。確認重新排隊？'))return;await invoke({action:'retry',task_id:t.task_id});await load();})));}
  configs.replaceChildren(element('h3','專案自動化設定'));
  for(const setting of data.settings){const row=element('p',setting.project+'｜'+(setting.enabled?'已啟用':'暫停')+'｜每日最多 '+setting.daily_limit+' 次');row.append(button('載入設定',()=>{for(const name of ['project','scope_note','daily_limit'])inputs[name].value=setting[name];for(const name of ['enabled','source_read_allowed'])inputs[name].checked=setting[name];folder=setting.source_item_id?{id:setting.source_item_id,name:'已保存的專案資料夾'}:null;folderLabel.textContent=folder?'已選定專案資料夾；可重新瀏覽更換。':'尚未選定資料夾。';}));if(setting.enabled)row.append(button('暫停 '+setting.project,()=>operate(async()=>{await invoke({action:'configure',...setting,enabled:false,source_read_allowed:false});await load();})));configs.append(row);}
  events.replaceChildren(element('h3','最近執行紀錄'));for(const e of data.events)events.append(element('p',new Date(e.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'｜'+e.project+'｜'+e.code));
 }catch(error){if(!disposed&&v===version)status.textContent=error.message;}}
 const calendar=element('section');calendar.append(element('h3','Google Calendar × 課程預約｜唯讀比較'));
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
 const start=element('input'),end=element('input');start.type=end.type='date';start.value=today;end.value=new Date(Date.parse(today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
 for(const [label,input] of [['開始日期',start],['結束日期（不包含當日）',end]]){const wrap=element('label',label);wrap.append(input);calendar.append(wrap);}
 const report=element('div');calendar.append(button('讀取日曆與預約時段（僅預覽）',()=>operate(async()=>{const data=await invoke({action:'calendar_preview',start:start.value+'T00:00:00+08:00',end:end.value+'T00:00:00+08:00'});if(disposed)return;report.replaceChildren(element('p','讀取 '+data.events_read+' 筆行程；合併為 '+data.busy_count+' 個忙碌區段。正式網站未變動。'));for(const change of data.changes)report.append(element('p',change.date+' '+change.time+'｜'+change.course+'｜'+(change.action==='PROPOSE_CLOSE'?'建議關閉，待本人核准':'已有報名，需人工協調')));for(const warning of data.warnings)report.append(element('p','需核對時段：'+warning.slot_id+'（'+warning.reason+'）'));status.textContent='唯讀比較完成；不會自動改期、寄送通知或更新網站。';})),report);host.append(calendar);
 const bookingHost=element('section');bookingHost.id='office-booking';host.append(bookingHost);const disposeBooking=mountBooking(bookingHost,{invoke});
 void load();return ()=>{disposeBooking();disposed=true;version++;host.replaceChildren();};
}
