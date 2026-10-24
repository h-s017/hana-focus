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
 for(const [name,label] of [['source_read_allowed','允許讀取選定 OneDrive 資料夾，並將其中可讀文字傳給 AI 服務產稿'],['enabled','啟用本專案背景執行（可能產生已核准的 API 用量費）']]){
  const input=element('input');input.type='checkbox';input.name=name;input.style.width='auto';const wrap=element('label',label);wrap.append(input);form.append(wrap);inputs[name]=input;
 }
 const folderLabel=element('p','尚未選擇可讀資料夾。保存素材連結不等於授權 Agent 讀檔。');
 const button=(text,fn)=>{const b=element('button',text);b.type='button';b.onclick=fn;return b;};
 const save=element('button','儲存自動化設定');form.append(folderLabel,save);
 const connect=button('連接 OneDrive（唯讀）',()=>operate(async()=>{const data=await invoke({action:'device_start'});status.textContent='請只在 Microsoft 官方登入頁輸入此代碼：'+data.user_code+'。登入完成後回來按「確認連線」。';const a=element('a','開啟 Microsoft 登入');a.href='https://microsoft.com/devicelogin';a.target='_blank';a.rel='noopener noreferrer';status.append(document.createTextNode(' '),a);}));
 const finish=button('確認連線',()=>operate(async()=>{const data=await invoke({action:'device_finish'});status.textContent=data.status==='connected'?'OneDrive 唯讀登入已完成，請選擇專案資料夾。':'Microsoft 尚未完成驗證，請至少等待 '+data.retry_after+' 秒後再確認。';}));
 const picker=element('div'),summary=element('div'),configs=element('div'),events=element('div');
 const browse=button('選擇 OneDrive 資料夾',()=>folders());
 const reload=button('更新 Agent 狀態',()=>load());
 host.replaceChildren(title,note,connect,finish,browse,picker,form,reload,status,summary,configs,events);
 const errors={activation_required:'服務端尚未核准啟用或缺少 AI 設定；沒有開始執行。',source_unavailable:'OneDrive 連線尚未設定或服務暫時無法使用。',source_expired:'OneDrive 授權已過期或取消，請重新連接。',source_denied:'無權讀取此來源；不會自動擴大 Microsoft 權限。',folder_required:'請先選擇資料夾。',scope_required:'請填寫本輪工作範圍。',invalid_settings:'請確認專案名稱、範圍及每日 1–6 次上限。'};
 async function invoke(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error){let code;try{code=(await error.context?.json())?.error;}catch{}throw Error(errors[code]||'自動化服務尚未部署或無法使用；原任務不受影響。');}if(data?.error)throw Error(errors[data.error]||'操作未完成，請重新整理確認。');return data;}
 async function operate(fn){if(disposed||busy)return;busy=true;save.disabled=true;try{await fn();}catch(error){if(!disposed)status.textContent=error.message;}finally{busy=false;if(!disposed)save.disabled=false;}}
 async function folders(id=null){await operate(async()=>{const data=await invoke({action:'folders',item_id:id});if(disposed)return;picker.replaceChildren(element('p','目前資料夾：'+data.current.name));picker.append(button('選用此資料夾',()=>{folder=data.current;folderLabel.textContent='選定資料夾：'+folder.name+'（尚未儲存授權）';}));if(id)picker.append(button('返回 OneDrive 根目錄',()=>folders()));for(const f of data.folders)picker.append(button('開啟 '+f.name,()=>folders(f.id)));if(data.limited)picker.append(element('p','僅顯示前 100 個項目，部分資料夾可能未列出。'));});}
 form.onsubmit=event=>{event.preventDefault();if(inputs.enabled.checked&&!confirm('啟用內部草稿背景執行？會使用已核准的 AI API 用量，成果仍逐角色待本人審核。'))return;
  void operate(async()=>{await invoke({action:'configure',project:inputs.project.value,scope_note:inputs.scope_note.value,daily_limit:Number(inputs.daily_limit.value),source_item_id:folder?.id||null,source_read_allowed:inputs.source_read_allowed.checked,enabled:inputs.enabled.checked});if(disposed)return;status.textContent=inputs.enabled.checked?'已儲存啟用設定；排程是否運作請查看執行紀錄。':'已儲存暫停設定；已送出的請求不會被撤回。';await load(false);});
 };
 async function load(announce=true){const v=++version;try{const data=await invoke({action:'status'});if(disposed||v!==version)return;
  if(announce)status.textContent=data.readiness.worker?'背景執行服務已就緒；各專案仍需啟用。':'背景執行目前關閉或設定未齊，不會呼叫 AI。';
  summary.replaceChildren(element('h3','今日最多三項優先工作（規則排序）'));for(const t of data.priorities){summary.append(element('p',t.project+'｜'+t.title+'｜'+t.status+(t.overdue?'｜已逾期':'')));if(t.status==='failed')summary.append(button('重新排隊：'+t.title,()=>operate(async()=>{if(!confirm('重新執行可能產生 API 用量。確認重試？'))return;await invoke({action:'retry',task_id:t.task_id});await load();})));}
  configs.replaceChildren(element('h3','專案自動化設定'));
  for(const setting of data.settings){const row=element('p',setting.project+'｜'+(setting.enabled?'已啟用':'暫停')+'｜每日最多 '+setting.daily_limit+' 次');row.append(button('載入設定',()=>{for(const name of ['project','scope_note','daily_limit'])inputs[name].value=setting[name];for(const name of ['enabled','source_read_allowed'])inputs[name].checked=setting[name];folder=setting.source_item_id?{id:setting.source_item_id,name:'已保存的專案資料夾'}:null;folderLabel.textContent=folder?'已選定專案資料夾；可重新瀏覽更換。':'尚未選定資料夾。';}));if(setting.enabled)row.append(button('暫停 '+setting.project,()=>operate(async()=>{await invoke({action:'configure',...setting,enabled:false,source_read_allowed:false});await load();})));configs.append(row);}
  events.replaceChildren(element('h3','最近執行紀錄'));for(const e of data.events)events.append(element('p',new Date(e.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'｜'+e.project+'｜'+e.code));
 }catch(error){if(!disposed&&v===version)status.textContent=error.message;}}
 void load();return ()=>{disposed=true;version++;host.replaceChildren();};
}
