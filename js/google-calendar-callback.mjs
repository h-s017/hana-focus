// Remove short-lived Google codes before loading the Auth SDK or awaiting any work.
const callbackHref=location.href;history.replaceState(null,'',location.pathname);
const status=document.getElementById('google-callback-status');
try{
 const [{db},{finishGoogleConnection,googleMessage}]=await Promise.all([import('./office-client.mjs'),import('./google-connect.mjs')]);
 try{const result=await finishGoogleConnection({db,storage:sessionStorage,href:callbackHref});if(result.status!=='connected')throw Error('unconfirmed');status.textContent=(result.sync_authorized?'Google 日曆同步授權已保存。請返回工作台手動同步並核對結果；尚未執行任何日曆或課程更新。':'Google 唯讀連線已建立。請返回工作台，讀取來源並重算月曆，核對該月份行程；尚未修改預約或發布時段。')+(result.audit_recorded===false?'操作紀錄尚待確認，請管理員檢查。':'');}
 catch(error){status.textContent=googleMessage(error.code);}
}catch{status.textContent='無法載入連線工具，請返回工作台重新連接。';}
