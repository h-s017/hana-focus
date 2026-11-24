import {chromium,request} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const cfg=JSON.parse(await readFile('/tmp/hana-hq-local-env.json','utf8'));
const users=JSON.parse(await readFile('/tmp/hana-hq-local-users.json','utf8'));
const transport=await request.newContext({ignoreHTTPSErrors:false,...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const cache=new Map();
 // Actual pinned Supabase SDK over verified TLS; no mocked Auth, RPC or HQ API.
 await page.route('https://cdn.jsdelivr.net/**',async route=>{const url=route.request().url();if(!cache.has(url)){const r=await transport.get(url);assert.equal(r.status(),200);cache.set(url,{body:await r.body(),headers:r.headers(),status:r.status()});}await route.fulfill(cache.get(url));});
 await page.goto(cfg.url+'/workspace.html#work',{waitUntil:'domcontentloaded'});
 const signIn=()=>page.evaluate(async({email,password})=>{const {db}=await import('/js/office-client.mjs');const {error}=await db.auth.signInWithPassword({email,password});if(error)throw Error('Isolated real login failed');},{email:users.a.email,password:users.a.password});
 await signIn();
 const root=page.locator('#office-focus');await root.getByRole('heading',{name:'HANA BUSINESS HQ｜企業經營總部',exact:true}).waitFor();
 const daily=page.locator('#hana-daily-agenda');if(await daily.isVisible())await daily.getByRole('button',{name:'關閉今日待辦',exact:true}).click();
 await root.getByLabel('處理方式',{exact:true}).selectOption('sales-marketing');
 await root.locator('.hq-results').getByRole('heading',{name:'Mozilla',exact:true}).waitFor();
 const goal='瀏覽器實際持久化與審核驗證 '+randomUUID();
 await root.getByLabel('新增雲端工作',{exact:true}).fill(goal);
 await root.getByLabel('產業',{exact:true}).fill('Internet');await root.getByLabel('區域',{exact:true}).fill('全球');await root.getByLabel('希望提供的服務',{exact:true}).fill('品牌研究');
 await root.getByLabel('公司來源（每行：公司名稱 | 官網 | 來源網址）',{exact:true}).fill('Mozilla | https://www.mozilla.org/ | https://www.mozilla.org/en-US/about/');
 await root.getByRole('button',{name:'核對公司來源並建立商機草稿',exact:true}).click();
 const row=root.locator('.hq-run').filter({has:page.getByRole('heading',{name:goal,exact:true})});
 await row.getByText('狀態：待 HANA 審核',{exact:true}).waitFor({timeout:30000});
 assert.equal(await root.locator('.hq-opportunity').filter({has:page.getByRole('heading',{name:'Mozilla',exact:true})}).count(),1);
 const requestReceipt=await page.evaluate(()=>Object.entries(sessionStorage).find(([k])=>k.startsWith('hana-hq-request:'))?.[1]);assert.ok(requestReceipt);assert.ok(!requestReceipt.includes('Mozilla'));
 const csv=page.waitForEvent('download');await root.getByRole('button',{name:'匯出有來源商機 CSV',exact:true}).click();const dl=await csv;await dl.saveAs('test-artifacts/hq-browser-export.csv');
 const future=new Date(Date.now()+86400000*7+8*3600000).toISOString().slice(0,16);await root.getByLabel('下次追蹤：Mozilla',{exact:true}).fill(future);
 const saved=page.waitForResponse(r=>r.url().endsWith('/functions/v1/hana-automation')&&r.request().postDataJSON()?.action==='hq_followup');await root.locator('.hq-opportunity').filter({has:page.getByRole('heading',{name:'Mozilla',exact:true})}).getByRole('button',{name:'儲存追蹤日期',exact:true}).click();assert.equal((await saved).status(),200);
 for(const width of [320,390,820]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'HQ horizontal overflow '+width);}
 await page.setViewportSize({width:390,height:900});await page.screenshot({path:'test-artifacts/hq-real-browser-mobile.png',fullPage:true});
 await page.reload({waitUntil:'domcontentloaded'});await root.getByLabel('處理方式',{exact:true}).selectOption('sales-marketing');await root.locator('.hq-results').getByRole('heading',{name:'Mozilla',exact:true}).waitFor();
 assert.equal(await root.getByLabel('下次追蹤：Mozilla',{exact:true}).inputValue(),future);
 await row.getByText('狀態：待 HANA 審核',{exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await row.getByRole('button',{name:'退回這批草稿',exact:true}).click();await row.getByText('狀態：已退回',{exact:true}).waitFor();
 await row.getByRole('button',{name:'補齊來源或連線後重試',exact:true}).click();await row.getByText('狀態：待 HANA 審核',{exact:true}).waitFor({timeout:30000});
 page.once('dialog',d=>d.accept());await row.getByRole('button',{name:'核准這批內部草稿',exact:true}).click();await row.getByText('狀態：內部核准・未寄送',{exact:true}).waitFor();
 await page.locator('nav.tiles [data-view=church]').click();await root.getByRole('heading',{name:'教會工作',exact:true}).waitFor();assert.equal(await root.locator('.business-hq').isVisible(),false);assert.equal(await root.locator('.hq-results').isVisible(),false);assert.equal(await root.getByLabel('新增雲端工作',{exact:true}).inputValue(),'');
 await page.locator('nav.tiles [data-view=work]').click();await root.getByLabel('處理方式',{exact:true}).selectOption('sales-marketing');await root.locator('.hq-results').getByRole('heading',{name:'Mozilla',exact:true}).waitFor();
 await page.locator('#office-logout').click();await page.locator('#office-private').waitFor({state:'hidden'});assert.equal(await root.textContent(),'');assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.startsWith('hana-hq-request:'))),false);
 await signIn();await root.getByLabel('處理方式',{exact:true}).selectOption('sales-marketing');await root.locator('.hq-results').getByRole('heading',{name:'Mozilla',exact:true}).waitFor();await row.getByText('狀態：內部核准・未寄送',{exact:true}).waitFor();
 await page.setViewportSize({width:820,height:1000});await page.screenshot({path:'test-artifacts/hq-real-browser-desktop.png',fullPage:true});assert.deepEqual(errors,[]);
 await writeFile('test-artifacts/hq-real-browser.json',JSON.stringify({tested_at:new Date().toISOString(),auth:'real isolated Supabase Auth',persistence:'real PostgreSQL through PostgREST',business_api_mocked:false,viewports:[320,390,820],checks:['B2B intake','actual source read','single domain record','download','reload','reject and retry with history','approve without sending','Church isolation','logout cleanup','real re-login'],passed:true},null,2));
 console.log('PASS: real browser intake, source read, persisted reload/re-login, human review/retry/export, Church isolation and 320/390/820 layouts.');
}finally{await browser.close();await transport.dispose();}
