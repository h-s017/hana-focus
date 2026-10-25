// Navigation changes visibility only. Existing modules retain their data and controls.
export function mountWorkspaceNavigation(host){
 const nav=document.createElement('nav');nav.className='workspace-nav';nav.setAttribute('aria-label','工作台主要功能');nav.hidden=true;
 const settings=document.createElement('section');settings.id='office-settings';settings.hidden=true;
 const heading=document.createElement('h2');heading.textContent='設定與進階工具';settings.append(heading);
 for(const id of ['office-automation','office-agent-archive']){const node=document.getElementById(id);if(node)settings.append(node);}
 document.getElementById('office-private').append(settings);
 const views=[['work','工作','office-focus'],['calendar','月曆','hana-month-calendar'],['orders','預約','office-orders'],['materials','素材','office-materials'],['settings','設定','office-settings']];
 let active='work',signedIn=false;
 const buttons=new Map();
 function select(key,{focus=false}={}){
  active=views.some(v=>v[0]===key)?key:'work';
  for(const [value,,id] of views){const panel=document.getElementById(id);if(panel)panel.hidden=signedIn?value!==active:id!=='hana-month-calendar';const b=buttons.get(value);b.setAttribute('aria-current',value===active?'page':'false');}
  if(focus){const panel=document.getElementById(views.find(v=>v[0]===active)[2]);panel?.setAttribute('tabindex','-1');panel?.focus({preventScroll:true});}
 }
 for(const [key,label,id] of views){const b=document.createElement('button');b.type='button';b.textContent=label;if(['orders','materials'].includes(key))b.setAttribute('data-business-only','');b.setAttribute('aria-controls',id);b.onclick=()=>select(key,{focus:true});buttons.set(key,b);nav.append(b);}
 host.querySelector('#office-private').before(nav);
 const change=()=>{if(document.documentElement.dataset.focusWorkspace==='church'&&['orders','materials'].includes(active))select('work');};
 window.addEventListener('hana-workspace-changed',change);
 return {setSession(value){signedIn=Boolean(value);nav.hidden=!signedIn;host.classList.toggle('is-signed-in',signedIn);if(!signedIn)active='work';select(active);}};
}
