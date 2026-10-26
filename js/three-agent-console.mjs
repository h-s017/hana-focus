import {THREE_AGENTS,taipeiDate,socialStatus,secretaryStatus,pmStatus} from './three-agent-status.mjs';
const STATE_LABELS={copy_ready:'已產生六頁文案',unverified:'未驗證',stale:'尚未確認今日執行',blocked:'缺少生成內容',incomplete:'尚未交付 Canva',delivered_internal:'已建立 Canva 內部稿',needs_connection:'需完成日曆授權',read_only:'僅具唯讀基礎',planning:'有現有專案資料'};
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node;};
const link=(title,url)=>{const a=element('a',title);a.href=url;if(url.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}return a;};
export function mountThreeAgentConsole(host,{db,request=fetch,now=()=>new Date()}={}){
 let disposed=false,revision=0;
 host.className='hana-agent-console';
 const intro=element('p','這是同一套 HANA FOCUS 的三個角色。內部工作無須逐項核准，但尚未接通的功能不會顯示成成功。');
 intro.className='hana-agent-intro';
 const grid=element('div');grid.className='hana-agents-grid';
 const cards=new Map();
 for(const agent of THREE_AGENTS){
  const article=element('article');article.className='hana-agent-card';
  article.append(element('h3',agent.name),element('p',agent.english));
  const state=element('p','正在讀取…');state.className='hana-agent-state';state.setAttribute('role','status');
  const detail=element('p','尚未確認服務狀態。');detail.className='hana-agent-detail';
  const actions=element('div');actions.className='hana-agent-actions';
  if(agent.id==='social'){
   actions.append(link('開啟 Canva 微課資料夾',agent.folder),link('查看 GitHub 每日排程','https://github.com/h-s017/hana-focus/actions/workflows/social-editor.yml'));
  }else if(agent.id==='secretary'){
   actions.append(link('日曆設定','#settings'),link('課程月曆','#calendar'),link('預約明細','#orders'));
  }else{
   actions.append(link('管理品牌專案','#projects'),link('Canva 內部交付資料夾',agent.folder));
  }
  article.append(state,detail,actions);grid.append(article);cards.set(agent.id,{state,detail,actions});
 }
 const refresh=element('button','重新確認三個 Agent 的執行狀態');refresh.type='button';
 const notice=element('p');notice.className='hana-agent-intro';notice.setAttribute('aria-live','polite');
 host.replaceChildren(intro,grid,refresh,notice);
 function render(id,value){
  const c=cards.get(id);if(!c||disposed)return;
  c.state.textContent=STATE_LABELS[value.state]||'尚未確認';c.state.dataset.state=value.state;
  c.detail.textContent=value.detail;
  const existing=c.actions.querySelector('[data-canva-result]');
  if(existing)existing.remove();
  if(id==='social'&&value.editUrl){const result=link('編輯今日 Canva 成果',value.editUrl);result.dataset.canvaResult='';c.actions.prepend(result);}
  if(id==='social'&&value.state==='copy_ready'){
   const today=taipeiDate(now());const result=link('查看今日 Canva 匯入資料','https://github.com/h-s017/hana-focus/blob/hana-focus-preview/content/instagram/'+today+'/canva-autofill.csv');result.dataset.canvaResult='';c.actions.prepend(result);
  }
 }
 async function load(){
  if(disposed)return;const v=++revision;refresh.disabled=true;notice.textContent='正在核對 GitHub、Google 設定與雲端專案資料…';
  const jobs=await Promise.allSettled([
   request('./content/instagram/latest.json',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('manifest_missing');return socialStatus(await response.json(),taipeiDate(now()));}),
   db.functions.invoke('hana-automation',{body:{action:'status'}}).then(({data,error})=>{if(error||data?.error)throw Error('secretary_unavailable');return secretaryStatus(data);}),
   db.functions.invoke('hana-automation',{body:{action:'focus_snapshot'}}).then(({data,error})=>{if(error||data?.error)throw Error('pm_unavailable');return pmStatus(data);})
  ]);
  if(disposed||v!==revision)return;
  for(let i=0;i<THREE_AGENTS.length;i++){
   const result=jobs[i];render(THREE_AGENTS[i].id,result.status==='fulfilled'?result.value:{state:'unverified',detail:'來源目前無法驗證；不代表已執行或已交付。'});
  }
  refresh.disabled=false;notice.textContent='最後檢查：'+now().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'（僅讀取，沒有變更預約或文件）';
 }
 refresh.onclick=()=>void load();
 return {load,dispose(){disposed=true;revision++;host.replaceChildren();}};
}
