import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import path from 'node:path';
const browser=await chromium.launch({headless:true});const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.setFixedTime(new Date('2026-10-25T12:00:00+08:00'));
const mock=`import {createMonthlyDraft,applyMonthlyOverrides,monthlyDiff} from 'https://h-s017.github.io/hana-focus/js/monthly-calendar.mjs';const key='test-office-session',tasks=[];let callback=()=>{};const get=()=>JSON.parse(localStorage.getItem(key)||'null');export function createClient(){return {auth:{getSession:async()=>({data:{session:get()},error:null}),onAuthStateChange:fn=>callback=fn,setSession:async()=>{localStorage.setItem(key,JSON.stringify({user:{id:'10000000-0000-4000-8000-000000000001',email:'hana@example.invalid'}}));callback();return {error:null}},signInWithOtp:async()=>{localStorage.setItem('test-mail-count',String(Number(localStorage.getItem('test-mail-count')||0)+1));return {error:null}},signOut:async()=>{localStorage.removeItem(key);callback();return {error:null}}},from:table=>{const q={upsert:async value=>{if(localStorage.getItem('test-materials-fail'))return {error:{message:'fixture error'}};const rows=JSON.parse(localStorage.getItem('test-materials')||'[]');const at=rows.findIndex(x=>x.owner_id===value.owner_id&&x.project===value.project);if(at<0)rows.push(value);else rows[at]=value;localStorage.setItem('test-materials',JSON.stringify(rows));return {error:null}},select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,then:fn=>Promise.resolve(fn({data:table==='hana_tasks'?tasks:table==='hana_project_materials'?JSON.parse(localStorage.getItem('test-materials')||'[]'):[],error:null})),insert:async value=>{tasks.push({...value,id:'20000000-0000-4000-8000-'+String(tasks.length+1).padStart(12,'0'),status:'queued',created_at:new Date().toISOString()});return {error:null}}};return q},functions:{invoke:async(name,{body})=>{if(name==='hana-automation'){
 if(body.action.startsWith('monthly_')){
  const map=JSON.parse(localStorage.getItem('test-monthly-records')||'{}'),old=map[body.month]||null;
  if(body.action==='monthly_load')return {data:{record:old,scheduleEnabled:false},error:null};
  if(body.action==='monthly_review'){old.state=body.decision==='approved'?'approved_internal':'rejected';localStorage.setItem('test-monthly-records',JSON.stringify(map));return {data:{record:old},error:null};}
  const online=!localStorage.getItem('test-monthly-offline'),policy=body.policy||old?.policy||{},overrides=body.overrides||old?.overrides||{};
  const generated=applyMonthlyOverrides(createMonthlyDraft({month:body.month,policy,events:[],slots:[],sources:{calendar:online,reservation:online}}),overrides);generated.sourceStatus={calendar:online?'verified':'needs_connection',reservation:online?'verified':'unverified'};generated.checkedAt=new Date().toISOString();generated.policyConfigured=!!Object.keys(policy).length;generated.changedDates=monthlyDiff(old?.generated,generated);
  const record={month:body.month,revision:(old?.revision||0)+1,policy,overrides,generated,state:online&&generated.policyConfigured?'pending':'unverified'};map[body.month]=record;localStorage.setItem('test-monthly-records',JSON.stringify(map));return {data:{record,changedDates:generated.changedDates},error:null};
 }
 const settings=JSON.parse(localStorage.getItem('test-automation-settings')||'[]');if(body.action==='reservation_details'){if(localStorage.getItem('test-order-error'))return {data:{error:'reservation_connection_required'},error:null};return {data:{orders:[{id:'ORDER-FIXTURE',name:'Fixture Customer',email:'fixture@example.invalid',phone:'0000000000',course:'Fixture Course',status:'PAID',quantity:2,amount:2000,sessions:'2026-11-02 13:00–15:00'}],next_cursor:null,read_only:true,external_writes:false},error:null};}if(body.action==='booking_list')return {data:{changes:JSON.parse(localStorage.getItem('test-booking-changes')||'[]')},error:null};if(body.action==='booking_slots')return {data:{slots:[{id:'slot1',date:'2026-11-02',time:'13:00–15:00',status:'開放',capacity:4,booked:2,course:'fixture'}]},error:null};if(body.action==='booking_save'){const list=JSON.parse(localStorage.getItem('test-booking-changes')||'[]');if(!list.find(x=>x.id===body.request_id))list.push({id:body.request_id,target:body.target,target_id:body.target_id,proposal:body.patch,source_verified:body.target==='slot',state:'pending'});localStorage.setItem('test-booking-changes',JSON.stringify(list));return {data:{status:'pending'},error:null};}if(body.action==='booking_review'){const list=JSON.parse(localStorage.getItem('test-booking-changes')||'[]');list.find(x=>x.id===body.change_id).state=body.decision;localStorage.setItem('test-booking-changes',JSON.stringify(list));return {data:{status:body.decision},error:null};}if(body.action==='status')return {data:{readiness:{worker:true,microsoft:true},settings,priorities:[],events:[]},error:null};if(body.action==='configure'){localStorage.setItem('test-automation-settings',JSON.stringify([{...body,action:undefined}]));return {data:{status:body.enabled?'enabled':'paused'},error:null};}if(body.action==='device_start')return {data:{user_code:'MOCK-CODE'},error:null};if(body.action==='device_finish')return {data:{status:'connected'},error:null};if(body.action==='calendar_preview')return {data:{events_read:1,busy_count:1,changes:[{date:'2026-10-26',time:'13:00–15:00',course:'fixture',action:'PROPOSE_CLOSE'}],warnings:[]},error:null};if(body.action==='folders')return {data:{current:{id:'folder1',name:'fixture'},folders:[],limited:false},error:null};}const t=tasks.find(x=>x.id===body.task_id);if(body.action==='generate'){t.status='review';t.result='AI 草稿，待HANA核准，非正式交付';}if(body.action==='review')t.status=body.decision;if(body.action==='handoff')tasks.push({...t,id:'20000000-0000-4000-8000-'+String(tasks.length+1).padStart(12,'0'),role:({'Project Manager':'Brand Strategist','Brand Strategist':'Creative Producer','Creative Producer':'Project Manager'})[t.role],status:'queued',parent_task_id:t.id,result:null});return {data:{status:t.status},error:null}}}}}`;
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='esm.sh')return route.fulfill({contentType:'application/javascript',body:mock});if(url.hostname!=='h-s017.github.io')return route.abort();let rel=decodeURIComponent(url.pathname).replace(/^\/hana-focus\//,'');if(!rel)rel='index.html';if(rel.includes('..'))return route.abort();try{const body=await readFile(path.resolve(rel));const type=rel.endsWith('.mjs')?'application/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.html')?'text/html':'application/octet-stream';await route.fulfill({contentType:type,body});}catch{await route.fulfill({status:204,body:''})}});
try{
 await page.goto('https://h-s017.github.io/hana-focus/workspace.html');await page.locator('#office-email').fill('hana@example.invalid');await page.locator('#office-login').click();await page.locator('#office-session').filter({hasText:'寄送請求已受理'}).waitFor();await page.locator('#office-login').click();assert.equal(await page.evaluate(()=>localStorage.getItem('test-mail-count')),'1');
 await page.evaluate(()=>localStorage.setItem('hana-focus-workspace-v2-church','legacy-kept'));
 await page.goto('https://h-s017.github.io/hana-focus/ai-office.html#access_token=fixture&refresh_token=fixture2');await page.locator('#office-private').waitFor({state:'visible'});assert.ok(!page.url().includes('token='));
 const ordersPanel=page.locator('#office-orders');
 assert.equal(await ordersPanel.locator('article').count(),0);
 await ordersPanel.getByRole('button',{name:'讀取／重新整理預約明細',exact:true}).click();
 await ordersPanel.getByText('Fixture Customer｜Fixture Course｜已付款',{exact:true}).waitFor();
 await ordersPanel.locator('summary').click();
 await ordersPanel.getByText('Email：fixture@example.invalid',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>String(v).includes('Fixture Customer'))),false);
 await page.evaluate(()=>localStorage.setItem('test-order-error','1'));
 await ordersPanel.getByRole('button',{name:'讀取／重新整理預約明細',exact:true}).click();
 await ordersPanel.getByRole('status').filter({hasText:'服務端管理連線尚未設定'}).waitFor();
 assert.equal(await ordersPanel.locator('article').count(),0);
 await page.evaluate(()=>localStorage.removeItem('test-order-error'));
 const automation=page.locator('#office-automation');
 assert.equal(await automation.locator('input[name=enabled]').isChecked(),false);
 assert.equal(await automation.locator('input[name=source_read_allowed]').isChecked(),false);
 await automation.locator('input[name=project]').fill('文慶雞');
 await automation.locator('input[name=scope_note]').fill('只有沿革牆');
 await automation.getByRole('button',{name:'連接 OneDrive（唯讀）',exact:true}).click();
 await automation.getByRole('status').filter({hasText:'MOCK-CODE'}).waitFor();
 await automation.getByRole('button',{name:'確認連線',exact:true}).click();
 await automation.getByRole('button',{name:'選擇 OneDrive 資料夾',exact:true}).click();
 await automation.getByRole('button',{name:'選用此資料夾',exact:true}).click();
 await automation.locator('input[name=source_read_allowed]').check();
 await automation.locator('input[name=enabled]').check();
 page.once('dialog',d=>d.accept());
 await automation.getByRole('button',{name:'儲存自動化設定',exact:true}).click();
 await automation.getByRole('button',{name:'暫停 文慶雞',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-automation-settings'))[0].scope_note),'只有沿革牆');
 await automation.getByRole('button',{name:'暫停 文慶雞',exact:true}).click();
 await automation.getByText('文慶雞｜暫停｜每日最多 3 次',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-automation-settings'))[0].enabled),false);
 await automation.getByRole('button',{name:'讀取日曆與預約時段（僅預覽）',exact:true}).click();
 await automation.getByText('2026-10-26 13:00–15:00｜fixture｜建議關閉，待本人核准',{exact:true}).waitFor();
 const booking=page.locator('#office-booking');
 await booking.getByRole('button',{name:'讀取原系統可預約時段',exact:true}).click();
 await booking.locator('input[name=capacity]').fill('3');
 await booking.getByRole('button',{name:'儲存時段修改草稿',exact:true}).click();
 await booking.getByRole('button',{name:'核准修改建議（不套用）',exact:true}).waitFor();
 page.once('dialog',d=>d.accept());
 await booking.getByRole('button',{name:'核准修改建議（不套用）',exact:true}).click();
 await booking.getByText('審核：approved｜已讀取時段資料',{exact:true}).waitFor();
 await booking.locator('input[name=order]').fill('ORDER-TEST');
 await booking.locator('select[name=action]').selectOption('cancel');
 await booking.getByRole('button',{name:'儲存客戶預約修改草稿',exact:true}).click();
 await booking.getByText('審核：pending｜原訂單待查核',{exact:true}).waitFor();
 assert.equal(await booking.getByRole('button',{name:'核准修改建議（不套用）',exact:true}).isDisabled(),true);
 const materials=page.locator('#office-materials');
 await materials.locator('input[name=project]').fill('文慶雞');
 await materials.locator('input[name=folder_url]').fill('https://1drv.ms.attacker.invalid/f/x');
 await materials.getByRole('button',{name:'儲存素材連結',exact:true}).click();
 await materials.getByRole('status').filter({hasText:'只接受 OneDrive'}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('test-materials')),null);
 await materials.locator('input[name=folder_url]').fill('https://1drv.ms/f/fixture');
 await materials.getByRole('button',{name:'儲存素材連結',exact:true}).click();
 await materials.getByRole('link').waitFor();
 assert.equal(await materials.getByRole('link').getAttribute('href'),'https://1drv.ms/f/fixture');
 await materials.getByRole('button',{name:'編輯連結'}).click();
 await materials.locator('input[name=folder_url]').fill('https://onedrive.live.com/?id=updated');
 await materials.getByRole('button',{name:'儲存素材連結',exact:true}).click();
 await materials.getByRole('status').filter({hasText:'素材連結已儲存'}).waitFor();
 assert.equal(await materials.getByRole('link').getAttribute('href'),'https://onedrive.live.com/?id=updated');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-materials')).length),1);
 await page.evaluate(()=>localStorage.setItem('test-materials-fail','1'));
 await materials.getByRole('button',{name:'儲存素材連結',exact:true}).click();
 await materials.getByRole('status').filter({hasText:'儲存未確認成功'}).waitFor();
 await page.evaluate(()=>localStorage.removeItem('test-materials-fail'));
 await page.locator('#office-bkc').click();await page.locator('#office-add').click();await page.locator('#office-tasks article').waitFor();
 for(let i=0;i<4;i++){const article=page.locator('#office-tasks article').nth(i);await article.getByRole('button',{name:i===0||i===3?'產生PM進度草稿':'執行AI草稿',exact:true}).click();await article.getByRole('button',{name:'核准內部草稿',exact:true}).waitFor();page.once('dialog',d=>d.accept());await article.getByRole('button',{name:'核准內部草稿',exact:true}).click();if(i<3)await article.getByRole('button',{name:/建立交接草稿/}).click();}
 assert.equal(await page.locator('#office-tasks article').count(),4);
 for(const width of [320,390,820]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);}
 await mkdir('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/office-workflow.png',fullPage:true});await page.reload();await page.locator('#office-private').waitFor({state:'visible'});
 assert.equal(await page.locator('#office-materials a').getAttribute('href'),'https://onedrive.live.com/?id=updated');
 assert.equal(await page.evaluate(()=>localStorage.getItem('hana-focus-workspace-v2-church')),'legacy-kept');await page.locator('#office-logout').click();await page.locator('#office-private').waitFor({state:'hidden'});assert.equal(await page.locator('#office-tasks article').count(),0);assert.equal(await page.locator('#office-materials a').count(),0);assert.equal(await page.locator('#office-automation button').count(),0);assert.equal(await page.locator('#office-orders').textContent(),'');assert.deepEqual(errors,[]);

 // Open a new document before the callback; changing only the current page hash does not rerun module init.
 await page.goto('https://h-s017.github.io/hana-focus/workspace.html');
 // Re-login through the existing callback; private monthly records are API fixtures only.
 await page.goto('https://h-s017.github.io/hana-focus/ai-office.html#access_token=fixture&refresh_token=fixture2');await page.locator('#office-private').waitFor({state:'visible'});
 await page.goto('https://h-s017.github.io/hana-focus/workspace.html');
 const calendar=page.locator('#hana-month-calendar');
 await calendar.getByRole('status').filter({hasText:'已載入草稿'}).waitFor();
 assert.ok(await calendar.evaluate(e=>e.compareDocumentPosition(document.querySelector('nav.tiles'))&Node.DOCUMENT_POSITION_FOLLOWING));
 await calendar.getByRole('button',{name:'下月',exact:true}).click();await calendar.getByRole('status').filter({hasText:'已載入草稿'}).waitFor();
 assert.equal(await calendar.locator('.month-day').count(),30);
 await calendar.locator('summary').click();await calendar.locator('[name=weekdays]').fill('0,1,2,3,4,5,6');await calendar.locator('[name=start]').fill('10:00');await calendar.locator('[name=end]').fill('12:00');await calendar.locator('[name=duration]').fill('60');
 await calendar.getByRole('button',{name:'確認規則並重算',exact:true}).click();await calendar.getByRole('status').filter({hasText:'草稿已更新'}).waitFor();
 await calendar.locator('.month-day').nth(1).click();await calendar.getByRole('button',{name:'本草稿手動關閉此日',exact:true}).click();await calendar.getByRole('status').filter({hasText:'草稿已更新'}).waitFor();
 await calendar.getByRole('button',{name:'讀取來源並重算草稿',exact:true}).click();await calendar.getByRole('status').filter({hasText:'草稿已更新'}).waitFor();
 await calendar.getByRole('button',{name:'移除本草稿的手動關閉',exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await calendar.getByRole('button',{name:'核准此版本（不發布）',exact:true}).click();await calendar.getByRole('status').filter({hasText:'本人審核已記錄'}).waitFor();await calendar.getByText(/內部核准・未發布/).waitFor();
 await page.evaluate(()=>localStorage.setItem('test-monthly-offline','1'));await calendar.getByRole('button',{name:'讀取來源並重算草稿',exact:true}).click();await calendar.getByRole('status').filter({hasText:'來源未驗證，不可發布'}).waitFor();
 assert.equal(await calendar.getByRole('button',{name:'核准此版本（不發布）',exact:true}).isDisabled(),true);
 for(const width of [320,390,820]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'monthly overflow '+width);}
 await page.screenshot({path:'test-artifacts/monthly-calendar-mobile.png',fullPage:true});
 await page.reload();await page.locator('#office-private').waitFor({state:'visible'});await calendar.getByRole('button',{name:'下月',exact:true}).click();await calendar.getByRole('status').filter({hasText:'已載入草稿'}).waitFor();await calendar.locator('.month-day').nth(1).click();await calendar.getByRole('button',{name:'移除本草稿的手動關閉',exact:true}).waitFor();
 await page.locator('#office-logout').click();await page.locator('#office-private').waitFor({state:'hidden'});await calendar.getByText('尚未登入；未讀取私人行程。',{exact:true}).waitFor();assert.ok(!(await calendar.textContent()).includes('內部核准・未發布'));await page.evaluate(()=>localStorage.removeItem('test-monthly-offline'));
 console.log('PASS: monthly calendar before module grid; month switching, explicit policy, preserved manual override, review reset, missing-source gate, reload/logout and 320/390/820 layouts.');
 const workspaceFixtures=await page.evaluate(()=>{
  const task=(id,title,project)=>({id,title,project,role:'行政',status:'進行中',importance:'2',owner:'yes',due:''});
  const work=JSON.stringify({tasks:[task('work-fixture','商務任務保留','旗袍合作')],ideas:['商務構想保留']});
  const church=JSON.stringify({tasks:[task('church-fixture','教會任務保留','主領')],ideas:['教會構想保留']});
  localStorage.setItem('hana-focus-workspace-v2-work',work);localStorage.setItem('hana-focus-workspace-v2-church',church);
  for(const key of ['hana-focus-v2-migrated','hana-focus-work-items-20261020-v1','hana-focus-qipao-campaign-20261024-v1'])localStorage.setItem(key,'1');
  localStorage.setItem('hana-focus-active-workspace','church');return {work,church};
 });
 await page.setViewportSize({width:390,height:844});await page.goto('https://h-s017.github.io/hana-focus/index.html');
 assert.equal(await page.locator('[data-workspace=work]').count(),4);
 for(const node of await page.locator('[data-workspace=work]').all())assert.equal(await node.isVisible(),false);
 await page.locator('#all').getByText('教會任務保留',{exact:true}).waitFor();assert.equal(await page.locator('#all').getByText('商務任務保留',{exact:true}).count(),0);
 await page.screenshot({path:'test-artifacts/workspace-church.png',fullPage:true});
 await page.locator('#workBtn').click();for(const node of await page.locator('[data-workspace=work]').all())assert.equal(await node.isVisible(),true);
 await page.locator('#all').getByText('商務任務保留',{exact:true}).waitFor();assert.equal(await page.locator('#all').getByText('教會任務保留',{exact:true}).count(),0);
 await page.screenshot({path:'test-artifacts/workspace-work.png',fullPage:true});
 await page.reload();assert.equal(await page.locator('section[data-workspace=work]').first().isVisible(),true);
 await page.locator('#churchBtn').click();await page.reload();
 for(const node of await page.locator('[data-workspace=work]').all())assert.equal(await node.isVisible(),false);
 assert.deepEqual(await page.evaluate(()=>({work:localStorage.getItem('hana-focus-workspace-v2-work'),church:localStorage.getItem('hana-focus-workspace-v2-church')})),workspaceFixtures);
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'church workspace overflow '+width);}
 assert.deepEqual(errors,[]);
 console.log('PASS: commercial modules stay in HANA WORK; switch/reload preserve work and church tasks and ideas.');
 console.log('PASS: mocked browser login/callback/reload/logout, four-agent review handoffs, preserved legacy storage, responsive 320/390/820. No external emails, API or calendar writes.');
}finally{await browser.close()}

