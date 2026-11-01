import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const db=createClient("https://uzqaodfmnrjrsbvxhlmh.supabase.co","sb_publishable_3ukkjs-QtgauXjmOrcDAVg_XBWzh2rd",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'hana-focus-newsletter-cms-admin'}});
const $=id=>document.getElementById(id);
const show=(id,visible)=>{$(id).hidden=!visible;};
const say=text=>{$('status').textContent=text;};
const sourceLabels={'course-intake':'課前問卷','student-registration':'學員工具註冊','website-subscription':'官網訂閱'};
const dateLabel=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});};
let offset=0,seq=0,factorId=null,authorized=false,busy=false;
function clearList(){seq++;$('subscriber-rows').replaceChildren();$('total-note').textContent='尚未載入';$('page-note').textContent='';$('empty-note').hidden=true;show('subscribers-panel',false);authorized=false;}
function resetView(){clearList();show('login-panel',false);show('mfa-panel',false);show('logout-btn',false);show('mfa-form',false);show('enroll-mfa',false);show('mfa-qr',false);$('mfa-qr').removeAttribute('src');$('mfa-code').value='';factorId=null;}
function cell(tr,value){const td=document.createElement('td');td.textContent=String(value??'—');tr.append(td);}
function render(data){
 const items=Array.isArray(data?.items)?data.items:[];
 const total=Number(data?.total);
 if(!Number.isInteger(total)||total<0)throw new Error('invalid_data');
 const tbody=$('subscriber-rows');tbody.replaceChildren();
 for(const item of items){const tr=document.createElement('tr');cell(tr,item.name);cell(tr,item.email);cell(tr,sourceLabels[item.source]||item.source||'其他');cell(tr,dateLabel(item.created_at));tbody.append(tr);}
 $('total-note').textContent='符合條件的訂閱紀錄：'+total+' 筆';
 $('page-note').textContent=total?('顯示第 '+(offset+1)+'–'+(offset+items.length)+' 筆，共 '+total+' 筆'):'沒有符合條件的資料';
 $('empty-note').hidden=items.length>0;
 $('prev-btn').disabled=offset===0;
 $('next-btn').disabled=offset+items.length>=total||items.length===0;
}
async function load(){
 if(!authorized||busy)return;
 const ticket=++seq;busy=true;
 for(const id of ['refresh-btn','prev-btn','next-btn'])$(id).disabled=true;
 say('正在安全讀取訂閱紀錄…');
 try{
  const {data,error}=await db.rpc('newsletter_admin_list',{p_query:$('subscriber-search').value.trim(),p_source:$('subscriber-source').value,p_offset:offset,p_limit:50});
  if(error)throw error;
  if(ticket!==seq||!authorized)return;
  render(data);
  say('訂閱名單已更新。');
 }catch{
  if(ticket!==seq)return;
  clearList();say('名單讀取失敗。請確認官網管理員資格與雙因素驗證，或稍後重新整理。');
  await init().catch(()=>{});
 }finally{
  busy=false;
  $('refresh-btn').disabled=false;
 }
}
async function verifyAccess(){
 const {data:{user},error:userError}=await db.auth.getUser();
 if(userError||!user){resetView();show('login-panel',true);say('請以官網管理員帳戶登入。');return;}
 const {data:access,error:accessError}=await db.rpc('student_access_status');
 if(accessError||!access?.admin){resetView();show('logout-btn',true);say('此帳號沒有官網管理員權限，無法查看訂閱名單。');return;}
 show('logout-btn',true);
 const {data:aal,error:aalError}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aalError)throw aalError;
 if(aal.currentLevel==='aal2'){
  show('login-panel',false);show('mfa-panel',false);authorized=true;show('subscribers-panel',true);
  await load();return;
 }
 clearList();show('login-panel',false);show('mfa-panel',true);
 const {data:factors,error:factorError}=await db.auth.mfa.listFactors();if(factorError)throw factorError;
 const verified=(factors?.totp||[]).find(x=>x.status==='verified');factorId=verified?.id||null;
 show('enroll-mfa',!factorId);show('mfa-form',!!factorId);
 say('請完成官網管理員雙因素驗證。');
}
let initRunning=false;
async function init(){if(initRunning)return;initRunning=true;try{await verifyAccess();}catch{resetView();show('login-panel',true);say('目前無法確認登入或管理員權限，請重新登入。');}finally{initRunning=false;}}
$('login-form').onsubmit=async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 say('正在驗證管理員帳號…');
 try{
  const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
  $('login-password').value='';if(error)throw error;
  await init();
 }catch{say('登入未完成，請檢查 Email、密碼及網路。');}
 finally{button.disabled=false;}
};
$('enroll-mfa').onclick=async()=>{
 const button=$('enroll-mfa');button.disabled=true;
 try{const {data,error}=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'HANA FOCUS 氣味通信管理'});if(error)throw error;factorId=data.id;$('mfa-qr').src=data.totp.qr_code;show('mfa-qr',true);show('mfa-form',true);say('請使用驗證器掃描 QR code，並輸入當前六位數驗證碼。');}
 catch{say('雙因素驗證器設定未完成，請重試。');button.disabled=false;}
};
$('mfa-form').onsubmit=async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{const code=$('mfa-code').value;if(!factorId||!/^[0-9]{6}$/.test(code))throw new Error('invalid-code');const {data:challenge,error:challengeError}=await db.auth.mfa.challenge({factorId});if(challengeError)throw challengeError;
 const {error}=await db.auth.mfa.verify({factorId,challengeId:challenge.id,code});if(error)throw error;
 $('mfa-code').value='';await init();
 }catch{say('驗證未通過，請輸入驗證器目前顯示的六位數。');$('mfa-code').value='';}
 finally{button.disabled=false;}
};
$('filter-form').onsubmit=event=>{event.preventDefault();offset=0;void load();};
$('subscriber-source').onchange=()=>{offset=0;void load();};
$('refresh-btn').onclick=()=>void load();
$('prev-btn').onclick=()=>{offset=Math.max(0,offset-50);void load();};
$('next-btn').onclick=()=>{offset+=50;void load();};
$('logout-btn').onclick=async()=>{
 clearList();try{const {error}=await db.auth.signOut();if(error)throw error;resetView();show('login-panel',true);say('已登出官網管理員。');}
 catch{resetView();show('login-panel',true);say('登出未確認成功，請關閉共用裝置上的瀏覽器並再次嘗試。');}
};
db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){resetView();show('login-panel',true);say('已登出，請重新登入。');}});
void init();
