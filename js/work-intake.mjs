const states={queued:'排隊中',running:'執行中',review:'待本人審核',approved:'本人已核准・未交付',rejected:'退回修改',completed:'唯讀查詢完成',needs_human:'需本人處理・尚未執行',needs_connection:'需完成連線或授權',failed:'執行失敗'};
const waits={paused:'專案已暫停，請至下方自動化設定恢復。',daily_limit:'已達今日執行上限，等候台北時間隔日。',next_tick:'等候每5分鐘背景排程；每位帳號一次執行一筆。'};
export function mountWorkIntake(host,{db,onOrders=()=>{},onChange=()=>{}}){
 let disposed=false,busy=false,generation=0,request=crypto.randomUUID();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const heading=el('h2','交辦給 Agent'),help=el('p','NT$0 免費工具模式。專案進度會自動排隊整理，結果進入待本人審核；查詢工具即時唯讀執行。僅支援下列完整指令，其他文字會保存為需本人處理。不要輸入密碼或金鑰。');
 const form=el('form'),project=el('input'),instruction=el('textarea');project.name='project';project.value='文慶雞';project.required=true;project.maxLength=100;instruction.name='instruction';instruction.required=true;instruction.maxLength=2000;instruction.rows=3;
 const label=(text,input)=>{const n=el('label',text);n.append(input);return n;};
 const examples=el('div');examples.setAttribute('aria-label','交辦範例');
 for(const text of ['整理專案進度','列出今日優先工作','查詢客戶預約明細','檢查未來7天預約衝突']){
  const b=el('button',text);b.type='button';b.onclick=()=>{instruction.value=text;request=crypto.randomUUID();instruction.focus();};examples.append(b);
 }
 const submit=el('button','交辦並執行');submit.type='submit';const reload=el('button','更新交辦結果');reload.type='button';
 const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const list=el('div');
 form.append(label('專案（進度只整理此專案；其他查詢為工作台範圍）',project),label('要做的事',instruction),submit);
 host.replaceChildren(heading,help,examples,form,reload,status,list);
 form.oninput=()=>{request=crypto.randomUUID();};
 function render(rows){
  list.replaceChildren();for(const row of rows){const article=el('article');article.append(el('h3',row.project+'｜'+row.instruction),el('p',states[row.status]||'狀態待確認'),el('small',new Date(row.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})));
   if(row.waiting_reason)article.append(el('p',waits[row.waiting_reason]||'排程狀態待確認'));
   article.append(el('pre',row.summary||'尚未取得結果'));if(row.status==='review')article.append(el('p','請至下方「專案與任務」查看結果並核准或退回。此進度報告不會自動建立策略交接。'));list.append(article);
  }
 }
 async function invoke(body){const {data,error}=await db.functions.invoke('hana-automation',{body});if(error||data?.error||!Array.isArray(data?.history))throw Error('request_unconfirmed');return data;}
 async function refresh(){if(disposed||busy)return;busy=true;reload.disabled=true;const v=++generation;
  try{const data=await invoke({action:'work_history'});if(disposed||v!==generation)return;render(data.history);onChange();status.textContent=data.history.length?'交辦結果已更新。':'尚無交辦紀錄。';}
  catch{if(!disposed&&v===generation){list.replaceChildren();status.textContent='無法載入交辦紀錄，請確認登入與後端版本；未代表沒有紀錄。';}}
  finally{busy=false;if(!disposed)reload.disabled=false;}
 }
 form.onsubmit=async e=>{e.preventDefault();if(disposed||busy)return;busy=true;submit.disabled=reload.disabled=true;const v=++generation;status.textContent='正在交辦，請勿重複送出…';
  // Private source results never enter receipts, localStorage, or URL state.
  onOrders(null);
  try{const data=await invoke({action:'assign_work',project:project.value,instruction:instruction.value,request_id:request});if(disposed||v!==generation)return;render(data.history);if(data.orders)onOrders(data.orders);status.textContent=data.duplicate?'此交辦已記錄，未重複執行。':'交辦已記錄，請查看每筆執行狀態。';onChange();}
  catch{if(!disposed&&v===generation)status.textContent='交辦結果未確認。請先更新交辦結果，使用相同內容重送不會重複執行；修改內容後會建立新的交辦。';}
  finally{busy=false;if(!disposed)submit.disabled=reload.disabled=false;}
 };
 reload.onclick=refresh;void refresh();
 // A visible tab refreshes results only; the server cron keeps running when this page is closed.
 const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);
 return ()=>{disposed=true;generation++;clearInterval(timer);host.replaceChildren();};
}
