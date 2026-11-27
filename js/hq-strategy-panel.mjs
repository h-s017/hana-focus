const lines={education:'教育與體驗',product_development:'品牌與產品開發',core_product:'核心產品',unclassified:'待分類'};
const types={recognized:'認列',contracted:'已簽約',invoiced:'已開立發票',received:'已收款'};
const periods={daily:'今日',weekly:'本週',monthly:'本月',yearly:'本年度'};
const missing={cash_flow:'完整現金流',cash_balance:'現金餘額',accounts_receivable:'應收帳款',enrollment_conversion:'招生轉換率',
 on_time_delivery:'準時交付率',sampling_conversion:'打樣轉單率',repeat_purchase:'回購率',automation_rate:'自動化完成率',founder_dependence:'創辦人在場依賴'};
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function sum(rows,field){
 if(!rows.length||rows.some(record=>record[field]===null||record[field]===undefined))return null;
 return rows.reduce((total,record)=>total+BigInt(record[field]),0n);
}

function money(amount,currency){
 if(amount===null||amount===undefined)return '未知';
 const unit=currency==='JPY'?1n:100n;
 const value=BigInt(amount),abs=value<0n?-value:value;
 return currency+' '+(value<0n?'−':'')+(abs/unit).toLocaleString('zh-TW')+(unit===100n?'.'+String(abs%unit).padStart(2,'0'):'');
}

export function mountHQStrategy(invoke){
 const el=(tag,text)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;};
 const panel=el('section'),report=el('div'),status=el('p'),setup=el('details'),period=el('select');
 const button=(label,action)=>{const item=el('button',label);item.type='button';item.onclick=action;return item;};
 panel.hidden=true;panel.style.overflowWrap='anywhere';status.setAttribute('role','status');period.setAttribute('aria-label','經營報告期間');
 for(const [key,label] of Object.entries(periods)){const option=el('option',label);option.value=key;period.append(option);}
 const controls=el('label','經營報告期間');controls.append(period);
 const input=label=>{const file=el('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label',label);return file;};
 const strategyFile=input('私有策略 JSON'),factFile=input('已核對的財務紀錄 JSON');
 const profileStatus=el('p');
 let visible=false,sequence=0,profile=null,profileReadable=false;
 const commitProfile=button('核准並保存新策略版本',()=>upload(strategyFile,'hq_strategy_approve'));
 const commitFact=button('確認來源並登錄財務紀錄',()=>upload(factFile,'hq_strategy_fact'));
 setup.append(el('summary','私有企業策略與財務來源'),profileStatus,
  el('label','選擇策略版本 JSON'),strategyFile,commitProfile,el('label','選擇已核對的單筆財務紀錄 JSON'),factFile,commitFact);
 panel.append(el('h2','企業經營總覽'),controls,status,report,setup);
 const call=body=>invoke({...body,workspace:'work'});

 async function upload(file,action){
  if(!visible||!profileReadable||!file.files?.[0])return;
  const selection=file.files[0],request=sequence;
  if(selection.size>25000){status.textContent='檔案超出匯入大小限制。';return;}
  const savingStrategy=action==='hq_strategy_approve';
  if(!confirm(savingStrategy?'核准這一份內部策略設定？舊版本保留。':'確認已核對來源及分類？這筆紀錄會計入相應期間。'))return;
  try{
   const value=JSON.parse(await selection.text());
   if(!visible||request!==sequence)return;
   const payload=savingStrategy?{profile:value,expected_revision:profile?.revision??0}:{fact:value};
   await call({action,confirmed:true,...payload});
   file.value='';
   if(visible)await load();
  }catch(error){
   if(visible)status.textContent=error.code==='hq_strategy_conflict'?'資料已有不同版本。請重新讀取並核對檔案。':'保存未確認。請檢查來源、分類與檔案格式。';
  }
 }

 function show(value){
  report.replaceChildren(el('p',value.start+' 至 '+value.through+'（台北）｜已登錄及核對的資料'));
  const amounts=value.financial_rows,crm=value.crm_rows;
  const currencies=[...new Set(amounts.map(row=>row.currency))];
  for(const [line,label] of Object.entries(lines)){
   const open=crm.find(row=>row.business_line===line);
   if(line==='unclassified'&&!open)continue;
   const card=el('section');
   card.append(el('h3',profile?.payload?.business_lines?.[line]?.label||label));
   card.append(el('p','本期新增商機 '+(open?.opened??0)+'｜目前已成交 '+(open?.now_won??0)));
   for(const currency of currencies){
    const related=amounts.filter(row=>row.business_line===line&&row.currency===currency);
    if(!related.length)continue;
    for(const [type,name] of Object.entries(types)){
     const selected=related.filter(row=>row.event_type===type);
     if(!selected.length)continue;
     const total=sum(selected,'amount_minor'),cost=sum(selected,'cost_minor');
     card.append(el('p',name+' '+money(total,currency)+(type==='recognized'?'｜登錄毛利 '+money(cost===null?null:total-cost,currency):'')));
     if(type==='recognized'&&line==='core_product'&&profile?.payload?.core_unit){
      const quantity=sum(selected,'quantity_milli');
      const display=quantity===null?'未知':(quantity/1000n).toLocaleString('zh-TW')+(quantity%1000n?'.'+String(quantity%1000n).padStart(3,'0'):'')+' '+profile.payload.core_unit;
      card.append(el('p','已登錄銷售量 '+display+'｜每單位登錄毛利 '+money(cost!==null&&quantity>0n?(total-cost)*1000n/quantity:null,currency)));
     }
    }
   }
   if(line!=='unclassified'&&!amounts.some(row=>row.business_line===line&&row.event_type==='recognized'))card.append(el('p','營收實績未知'));
   report.append(card);
  }
  if(value.currency){
   report.append(el('p','年度核心產品認列 '+money(value.annual_core_actual_minor,value.currency)+'｜挑戰目標 '+money(value.annual_core_target_minor,value.currency)));
  }
  const mix=el('details');mix.append(el('summary','認列營收市場與通路'));
  for(const currency of currencies){
   const recognized=amounts.filter(row=>row.currency===currency&&row.event_type==='recognized');
   if(!recognized.length)continue;
   for(const market of ['B2B','B2G','B2C'])mix.append(el('p',market+' '+money(sum(recognized.filter(row=>row.market===market),'amount_minor'),currency)));
   mix.append(el('p','合作通路（已計入所屬市場） '+money(sum(recognized.filter(row=>row.channel==='partner'),'amount_minor'),currency)));
  }
  if(!amounts.some(row=>row.event_type==='recognized'))mix.append(el('p','尚無認列資料。'));
  report.append(mix);
  const decisions=el('ol');
  if(!profile)decisions.append(el('li','核准私有策略版本及可用的研究範圍。'));
  if(!amounts.length)decisions.append(el('li','核對要接入的交易與成本來源。'));
  const due=crm.reduce((total,row)=>total+row.followups_due,0);
  if(due)decisions.append(el('li','審核本期新增商機中已到期的 '+due+' 項跟進。'));
  report.append(el('h3','優先經營決策'),decisions.childElementCount?decisions:el('p','目前資料未顯示需要升級處理的事項。'));
  report.append(el('p','待接入資料：'+value.unmeasured.map(key=>missing[key]||key).join('、')));
 }

 async function load(){
  if(!visible)return;
  const request=++sequence;status.textContent='讀取企業策略與經營資料…';
  const [strategy,results]=await Promise.allSettled([
   call({action:'hq_strategy_snapshot'}),call({action:'hq_strategy_report',through:day(),period:period.value})
  ]);
  if(!visible||request!==sequence)return;
  profileReadable=strategy.status==='fulfilled'&&Object.hasOwn(strategy.value||{},'profile');
  profile=profileReadable?strategy.value.profile:null;
  profileStatus.textContent=profile?'已核准版本 '+profile.revision+'，生效日 '+profile.payload.effective_from:profileReadable?'策略尚待本人匯入並核准。':'私有策略無法讀取。';
  commitProfile.disabled=commitFact.disabled=!profileReadable;
  if(results.status==='fulfilled'&&Array.isArray(results.value?.financial_rows)){status.textContent='已讀取經營報告。';show(results.value);}
  else{status.textContent='經營資料尚未接通或暫時無法讀取。';report.replaceChildren();}
 }
 period.onchange=()=>void load();
 return {element:panel,setVisible(value){
  if(visible===value)return;
  visible=value;panel.hidden=!visible;
  if(visible)void load();
  else{sequence++;profile=null;profileReadable=false;report.replaceChildren();profileStatus.textContent='';strategyFile.value=factFile.value='';}
 },dispose(){this.setVisible(false);panel.remove();}};
}
