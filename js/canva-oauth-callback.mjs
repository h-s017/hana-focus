// Remove one-time Canva authorization parameters before importing libraries or making requests.
const callbackHref=location.href;
history.replaceState(null,'',location.pathname);
const status=document.getElementById('canva-callback-status');
try{
 const [{db},{finishCanvaConnection,canvaMessage}]=await Promise.all([
  import('./office-client.mjs'),import('./canva-connect.mjs')
 ]);
 try{
  const result=await finishCanvaConnection({db,storage:sessionStorage,href:callbackHref});
  if(result.status!=='connected')throw Error('unconfirmed');
  status.textContent='Canva 授權已完成，安全憑證已保存於 HANA AI OFFICE 服務端。每日 Canva 自動產圖尚未啟用，請回到工作台測試連線。'+(result.audit_recorded===false?' 操作稽核尚待確認。':'');
 }catch(error){status.textContent=canvaMessage(error.code);}
}catch{status.textContent='Canva 連線程序尚未完成；請返回 HANA FOCUS 設定頁檢查後端授權。';}
