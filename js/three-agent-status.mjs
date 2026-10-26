// HANA AI OFFICE V3: status is evidence-based, not an inferred authorization.
export const THREE_AGENTS=Object.freeze([
 {id:'social',name:'社群小編',english:'Social Editor',folder:'https://www.canva.com/folder/FAHZDAV1GWk'},
 {id:'secretary',name:'AI 秘書',english:'Secretary'},
 {id:'pm',name:'專案經理',english:'Project Manager',folder:'https://www.canva.com/folder/FAHZDEUQEKc'}
]);
const safeCanva=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='www.canva.com'||u.hostname==='canva.com')?u.href:null;}catch{return null;}};
export function taipeiDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function socialStatus(manifest,day=taipeiDate()){
 if(!manifest||typeof manifest!=='object')return {state:'unverified',detail:'尚未取得每日執行紀錄。',editUrl:null};
 const editUrl=safeCanva(manifest.canvaEditUrl);
 const slides=Number.isInteger(manifest.slideCount)?manifest.slideCount:0;
 if(manifest.date!==day)return {state:'stale',detail:'最新紀錄：'+String(manifest.date||'日期未知')+'，今天的工作尚未確認。',editUrl:null};
 if(manifest.canvaCreated===true&&slides>=5&&slides<=8&&editUrl)return {state:'delivered_internal',detail:'已記錄 Canva 內部稿（'+slides+' 頁）；不代表已發布 Instagram。',editUrl};
 if(manifest.status==='needs-lesson')return {state:'blocked',detail:'排程已有執行，但尚未產生今天的課程內容或 Canva 設計。',editUrl:null};
 if(manifest.status==='editorial_ready'&&manifest.plannedSlideCount===6)return {state:'copy_ready',detail:'今日 6 頁文案、貼文與 Canva 匯入欄位已由排程產出；圖片及 Canva 可編輯設計尚未建立。',editUrl:null};
 return {state:'incomplete',detail:'已有每日紀錄，但未確認 5–8 頁可編輯 Canva 成品。',editUrl:null};
}
export function secretaryStatus(status){
 if(!status||typeof status!=='object')return {state:'unverified',detail:'後端狀態無法驗證；預約未作任何更動。'};
 if(status.readiness?.calendar===true)return {state:'read_only',detail:'日曆連線資料已設定，還要實際讀取才能確認。查看下方撞期檢查結果；不會修改預約或發通知。'};
 return {state:'needs_connection',detail:'先到「日曆設定」連接 Google，才能檢查撞期。尚未修改任何預約。'};
}
export function pmStatus(snapshot){
 if(!snapshot||!Array.isArray(snapshot.projects)||!Array.isArray(snapshot.tasks))return {state:'unverified',detail:'無法讀取雲端專案清單，未確認有任何交付。'};
 const workProjects=snapshot.projects.filter(p=>p.workspace==='work');
 return {state:'planning',detail:'已讀取 '+workProjects.length+' 個工作專案。你可以交辦工作、查看進度；有專案資料不代表工具正在執行。'};
}
