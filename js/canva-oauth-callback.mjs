// Canva Connect OAuth code returns here. Clean the URL synchronously before any imports,
// scripts or network traffic that might disclose an authorization code.
const query=new URLSearchParams(location.search);
const error=query.get('error');
const authorized=query.has('code')&&query.has('state');
history.replaceState(null,'',location.pathname);
const status=document.getElementById('canva-callback-status');
if(error){
 status.textContent='Canva 授權未成功或已取消。請返回 HANA FOCUS 重新連線。';
}else if(authorized){
 // Fail closed until the OAuth PKCE backend, one-time state verification and
 // encrypted refresh-token storage are deployed and tested end-to-end.
 status.textContent='已收到 Canva 的授權返回，但 HANA AI OFFICE 的安全授權交換服務尚未正式啟用。這次尚未完成連線；請返回工作台，待服務端設定完成後重新授權。';
}else{
 status.textContent='HANA AI OFFICE 的 Canva 授權回呼頁面已可存取；尚未進行授權。請從工作台開始連線，不要直接在此頁貼入代碼。';
}
