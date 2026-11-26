# HANA BUSINESS HQ 驗收紀錄

## 主動式商務開發

每日研究是 Business HQ 的主要入口。服務定位、ICP、提供的服務、可查核合作訊號、搜尋縣市、每日上限與台北執行時間保存在既有 Supabase 專案的資料表。預設全臺（含離島）每日 08:00，初始設定暫停。可改選單一縣市，手動搜尋與建檔仍可展開使用。

資料來源為交通部觀光署的[全臺旅館民宿名錄](https://data.gov.tw/dataset/7780)及[觀光活動資料](https://data.gov.tw/dataset/7778)，依政府資料開放授權條款第 1 版使用。每日串流讀取全國名錄，統計實際取得的縣市，優先從不同縣市挑選高適配候選。候選需有公開登記證號及合作訊號，名稱須與觀光署個別詳情頁相符。官方活動保留來源、區域與日期。資料請求使用固定政府網址，無須金鑰，ICP 留在系統內。提案由 HANA 人工審核。

資料庫每日只允許同一帳號、同一台北日期申領一次，並在同一個交易保存每日報告、去重後的 CRM 候選及各自的審核任務。資料停留在內部待審核；次日追蹤時間只作為工作提醒。報告記錄實際來源、掃描與查核數、推薦順序、建檔 ID、結果與每項失敗原因。逾時工作保留失敗紀錄，不覆寫人工審核。

隔離驗收使用壁鐘定時器、真實政府端點、Supabase Auth、PostgREST 與 PostgreSQL。`hq-proactive-schedule.json` 記錄定時請求、報告、商機與審核任務 ID，涵蓋暫停、重複觸發、帳號隔離與重新登入回讀。旅宿試點使用規則式草稿。正式參數要求跨產業企業搜尋、可查核來源和生成式分析。缺少任一項時，正式 worker 會保存受阻原因，不寫入規則式候選。七個服務方向依官方活動訊號及最近七日的研究紀錄調整。

正式核准後，先部署 additive migrations 與 Edge，讀回版本並核對 worker 預設停用。確認 ICP、來源範圍和模型用量後，設定指定 owner、專用 worker token、Vault 同名值，以及 `HANA_HQ_SCHEDULE_DISCOVERY_ENABLED` 和 `HANA_HQ_SCHEDULE_AI_ENABLED` 所需的服務端憑證。`ops/enable-business-hq-proactive-cron.sql` 須另行核准。從 Cron 與資料庫讀回首次正式執行，核對 `daily_run_id`、`opportunity_id`、`task_id`、來源和審核狀態。回復時先暫停 Cron 或將 `HANA_HQ_SCHEDULE_ENABLED` 設為 `false`。可回復上一版 Edge 與 Pages，保留資料及稽核紀錄。

Brave Search 每千次 US$5，官方列有每月 US$5 的 Search 抵用額度。申請時仍需驗卡，可將預收額設為 US$0。必須先確認來源保存條款。全臺旅宿與觀光活動仍可直接讀取政府資料，跨產業覆蓋需依實測結果確認。[Brave 定價](https://brave.com/search/api/) [Brave 抵用額與驗卡](https://api-dashboard.search.brave.com/documentation/resources/help-feedback)

## Social Editor V2.1

GitHub 的 Social Editor 排程在台北時間 08:10 準備到期內容。微課、創業者限動各自每日執行，服務文章每三天執行，四個主題每十二天一輪。只有正式分支在明確啟用後使用專用 token 寫入既有 Supabase 審核紀錄。每日稿件保留於審核帳號，原有公開素材保留，執行回條只含狀態與日期。單日同類版本有唯一識別，部分完成與失敗可排入重試，正式發布需另行核准。

三種稿件的隔離驗收覆蓋實際 Supabase Auth、PostgREST、PostgreSQL、官網 CTA 查核、版本重試和帳號隔離。人工驗收另有實際生成 PNG 與三個 Canva 設計，已讀回頁面尺寸及照片、文字圖層。[整合驗收](https://github.com/h-s017/hana-focus/actions/runs/45717019797)

素材由既有 Edge Function 上傳至同專案的私有 Storage bucket。每一版本有獨立目錄和固定檔位。Edge 驗證 PNG 結構、尺寸及 SHA-256，從 Storage 讀回後寫入該版本的素材紀錄。相同內容可確認重送，已存在的檔案不可覆蓋。登入的擁有人可從 HANA FOCUS 取得 120 秒預覽網址。私有預覽和寫入由 `HANA_EDITORIAL_PRIVATE_MEDIA_ENABLED` 保護，停用時保留素材。

已有素材的流程可從 `HANA_EDITORIAL_MEDIA_ROOT/YYYY-MM-DD/<kind>/v<version>/` 提供 `manifest.json` 的 `topic_id` 及同目錄的 `photo-1.png` 等檔案。微課可在核准圖片服務與額度後由 `HANA_SOCIAL_PRIVATE_IMAGE_APPROVED` 啟動既有產圖器，素材留在私有流程。檔案讀回只證明所存檔案，原創、視覺品質與 Canva 圖層需獨立核實。正式服務目前未開啟。

| 驗收 | 本次證據 |
| --- | --- |
| SOC-01、SYS-01 | GitHub 預設分支為 `hana-focus-preview`。隔離環境已驗證任務時程及資料庫寫入。正式排程未啟用，端到端一致性仍待驗收。 |
| SOC-02 至 SOC-05 | 人工試作已產出七頁內容、七張獨立 1080×1350 PNG、當期色票、七頁可編輯 Canva。每頁讀回一個照片圖層及六個可編輯文字圖層。尚待排程連續產出與 HANA 審核。 |
| SOC-06、STORY-04 | 隔離審核入口可讀回實際稿件及缺件狀態。圖片、Canva 與正式 HANA FOCUS 同步仍待驗收。 |
| BIZ-01、BIZ-02、BIZ-04 | 隔離定時觸發 `115490d6-d1d0-43e2-8384-83516fa18baf`，讀取全臺 22 個縣市，保存 3 筆待審核旅宿與追蹤任務，收錄 5 則官方活動。重新登入回讀、重複時鐘觸發與帳號隔離通過。範圍為旅宿試點。 |
| BIZ-03 | 跨產業來源及生成式個別提案需要授權後進行真實測試。隔離旅宿試點的草稿使用規則。 |
| MKT-01、MKT-02 | 四主題、十二日循環及分類已經測試。正式每三天定時記錄尚待驗收。 |
| MKT-03 | 人工試作已有小量香氛正文、主視覺、可編輯 Canva 與官網 CTA，官網入口由隔離流程驗證。自動素材保存待接通。 |
| STORY-01 至 STORY-03 | 每日獨立任務識別已測試。人工試作有原創繁中短文、單張 1080×1920 PNG 及可編輯 Canva。正式自動交付待驗收。 |
| SYS-02、SYS-03 | 隔離測試涵蓋缺件、同日併發去重、版本重試與跨帳號隔離。 |
| SYS-04、SYS-05 | 320／390／820 px 審核畫面及既有工作台回歸已在受控瀏覽器測試。以現有正式版本服務一般使用者。 |
| SYS-06 | 受控測試的對外寄送數為 0，正式啟用與社群發布保持停用。 |

人工 Canva 讀回 ID：微課 `DAHb9PqIkns`、創業者限動 `DAHb9G4wH_k`、服務文章 `DAHb9kn2aUA`。生成檔案與圖層紀錄留存在此次工作區的驗收包。

## 第二輪與正式環境

| 項目 | 版本與驗收狀態 |
|---|---|
| GitHub Pages | 第二輪由 [PR #55](https://github.com/h-s017/hana-focus/pull/55) 同步發布。正式資產以 `business-hq-review2-20261126` 識別。[Pages 部署紀錄](https://github.com/h-s017/hana-focus/deployments/github-pages) |
| 正式 Edge | 2026-11-26 已恢復既有 `hana-ai-office` 部署存取，確認 v31 缺少 `hq-discovery.mjs`，更新至 `hana-automation` v32。從 Supabase 管理端讀回 34 個檔案，比對內容一致，包含 `hq-discovery.mjs` 與 `hq-analysis.mjs`。部署雜湊為 `4df4799bfae10ed068797289347f016b6a389908d727c94561e1736ea32c8e08`。正式端點拒絕未登入請求（`401 login_required`）。 |
| 商務流程 | 既有規則式流程可批次選入候選、送出來源查核並保存 CRM。生成式分析為逐批選用。只使用通過白名單及公司名稱查核的公開頁面，並核對模型所引原文。具體需求仍列為待訪談假設。 |
| 紀錄與審核 | 搜尋完成只留下供應商與候選筆數。建檔記錄來源、引文、內容雜湊、分析成果與人工審核。CRM 的 AI 草稿及分析報告可分別從商機和執行紀錄回讀。原有一般工作列表沿用舊版摘要，AI 報告位於 Business HQ。 |
| 技能接通 | 「業務與行銷」有建檔和審核流程，其搜尋、公開來源與生成式分析各自顯示設定狀態。其他六項只有文件。已設定代表工具有足夠設定啟動，成功與否以執行紀錄為準。 |
| 真實端到端 | 正式搜尋與生成式分析維持停用。正式搜尋、分析、儲存、審核及重新登入回讀待驗收。[隔離測試](https://github.com/h-s017/hana-focus/actions/runs/45668141868/job/139395789972) 使用真實 Auth、資料庫及公開來源，搜尋與模型回應使用標示的測試資料。 |

### 搜尋和模型費用

- Brave Search 每 1,000 次為 USD 5，Search 方案每月提供 USD 5 額度，約 1,000 次。$0 預付仍有信用卡驗證。使用前需由帳號持有人確認適用條款、關閉自動儲值並核准以免費額度為上限。工作台單次搜尋發出一個供應商請求，搜尋摘要只用於畫面預覽。保存候選網址前也需確認適用的結果儲存權利。[Brave 價格](https://brave.com/search/api/) · [Brave 額度說明](https://api-dashboard.search.brave.com/documentation/resources/help-feedback)
- 免金鑰選項可用既有人工來源流程，或在指定產業、地區使用 OpenStreetMap 的公開資料作為補充名單。公共查詢資源有限，資料覆蓋及公司官網完整度需另驗證。第一階段未接上這個替代來源。[OpenStreetMap 公用查詢限制](https://wiki.openstreetmap.org/wiki/Overpass_API)
- 生成式執行層沿用 Responses API，在一個請求中產生當批個別分析與提案。只傳已核對的公開摘錄與產業、區域及服務條件。模型費用依所選模型和輸入／輸出 token 數計算，需另外核准。來源未核對時保持待查。模型錯誤時保留已查核的來源，執行紀錄標示失敗。[結構化輸出](https://developers.openai.com/api/docs/guides/structured-outputs) · [OpenAI API 價格](https://openai.com/api/pricing/)

### 正式驗收條件

1. `hana-ai-office` 既有專案部署權限已恢復，Edge v32 版本與執行檔已讀回比對。正式發布時維持搜尋和模型停用。
2. 確認 Brave 帳號、儲存條款與免費額度後，於 Supabase Secrets 設定 `BRAVE_SEARCH_API_KEY` 和 `HANA_HQ_DISCOVERY_ENABLED=true`。模型另需核准 `HANA_HQ_ANALYSIS_MODEL` 與用量，再安全設定 `OPENAI_API_KEY` 及 `HANA_HQ_ANALYSIS_ENABLED=true`。正式來源白名單仍以 `HANA_HQ_SOURCE_HOSTS` 管理。
3. 以指定的授權帳號尋找一批候選，人工選入測試樣本，核對實際搜尋筆數、公開來源、模型引文與 CRM 草稿。內部審核後重新登入讀回相同紀錄並核對無重複保存。將測試樣本明確標示為測試，保留資料供驗收。

## P0.1 歷史隔離驗收

日期：2026-11-24（Asia/Taipei）。範圍為開發分支與隔離測試環境，不是正式網站驗收或發布。正式環境及付費 API 未修改。機器可讀的本機證據見 [evidence/local-acceptance.json](evidence/local-acceptance.json)；每次 PR CI 另以實際 head 重跑，不拿本機報告代替 CI。

## 測試環境與證據區分

- 真實整合：PostgreSQL 17、Supabase GoTrue v2.198.0、PostgREST v16.6，真實 Auth 密碼登入、JWT、RLS、SQL/RPC、持久化、瀏覽器及公開網頁 HTTP。使用與 Edge 相同的 control/service/store 程式，僅 HTTP 啟動器改為本機 Node；實際 Edge adapter 另由 Deno type check 檢查，未部署 Edge。
- 真實公司來源：`https://www.mozilla.org/en-US/about/`。Mozilla 僅為公開頁面查核樣本，**不是 HANA 客戶、推薦商機或已發生聯絡**。查核日、摘錄及 SHA-256 實際保存於隔離資料庫；不為測試寫入正式 CRM。
- 真實瀏覽器採原 pinned Supabase SDK；僅將 CDN JavaScript 經 TLS 驗證的下載轉送給瀏覽器，沒有 mock Auth／HQ／REST API。合成帳號只用 `.invalid`，秘密留在 /tmp，不上傳。
- 既有 office/browser、focus-browser 是受控 mock 回歸；Node 工具錯誤及合成 SQL fixtures 是離線邊界測試。這些測試不能證明正式 SMTP、Google、付款或 Canva 的外部連線成功。

## T01–T10

| ID | 本次結果 | 執行及可檢視證據 |
|---|---|---|
| T01 | 通過：實際 HTTPS 讀取公司來源，保存日期／摘錄／hash，生成有來源的規則式草稿 | tests/business-hq/integration.mjs；hq-real-integration.json；未核對來源不會 qualified |
| T02 | 通過：缺來源 blocked；人工內容維持 unverified／identified，沒有分數或草稿；未接入技能 blocked | 真實 API＋PostgreSQL；工具不可用及外部指令文本另有離線邊界測試 |
| T03 | 通過：真實 run 保存 sales-marketing、1.0.0、實際 MD hash；修改暫存副本版本後 hash 改變，舊 request 不接受換版 | integration.mjs、business-hq.test.mjs、business-hq-rls.sql、build --check；未修改正式技能版本 |
| T04 | 通過：重送同 request 一筆 run，三個並行請求一個 attempt，相同 owner/domain 一筆商機 | 真實 API／SQL；保存既有核准內容，不用新 run 覆蓋 |
| T05 | 通過：不同 owner 不能讀寫、user_metadata 無法升權、direct RPC 被拒、教會不顯示商務資料 | 真實 JWT／RLS＋瀏覽器工作區切換；SQL fixture 補充服務端 fence |
| T06 | 通過：核准／退回使用既有 reviews，退回後可重試並保留審核歷史；內部核准仍未聯絡 | 真實瀏覽器與 SQL；沒有寄送／對外交付路徑 |
| T07 | 通過：真實 DB 保存，刷新、登出及密碼重新登入後同筆資料與追蹤日期可讀 | hq-real-browser.json、截圖與下載 CSV；無 Auth／持久化 mock |
| T08 | 通過：真實 HTTP 1ms deadline 逾時記錄 failed，以同 request 重試成功、attempt=2，保留失敗歷史 | integration.mjs；SQL 驗證舊 attempt token 不能寫入；畫面提供明確重試 |
| T09 | 通過開發回歸：39 個 Node 測試檔、既有 SQL 回滾／RLS、既有登入／任務／日曆／訂單／社群行為及 320/390/820 寬度 | Node／受控瀏覽器／Python 社群測試；真實 HQ 瀏覽器亦無溢出。正式外部服務不在本次實測範圍 |
| T10 | 通過：真實保存的有來源商機與規則式提案可匯出，CSV 防公式注入；未對外發送 | API export 驗證＋瀏覽器實際 download；不表示客戶已核准或收到 |

## 重現命令

不需要正式秘密、正式帳號或付費方案。Node 24、Docker、Python3 及 Playwright；需能下載測試鏡像與讀取上述公開來源。

```bash
node scripts/build-business-skills.mjs --check
for file in tests/office/*.test.mjs; do node "$file"; done
for file in js/*.mjs supabase/functions/hana-agent/*.mjs supabase/functions/hana-automation/*.mjs; do node --check "$file"; done
node scripts/build-office-site.mjs

# 舊行為受控回歸（mock）
node tests/office/browser.mjs
node tests/office/focus-browser.mjs
python tests/office/social_visual_test.py

# 真實隔離整合；在另一個 terminal 啟動 server 後再跑測試
node tests/business-hq/local-stack.mjs
node tests/business-hq/server.mjs
# 另一個 terminal
node tests/business-hq/integration.mjs
node tests/business-hq/browser.mjs
```

資料庫完整回歸：對**一次性空白 PostgreSQL 17 測試資料庫**執行 `psql -v ON_ERROR_STOP=1 -f tests/office/db-run.sql`，腳本最後驗證 rollback；不得指向正式資料庫。新 migration 套兩次驗證可重複部署。

CI `.github/workflows/office-validation.yml` 五個工作涵蓋 Node／mock 瀏覽器、Deno Edge、PostgreSQL 完整回歸、真實 HQ 隔離整合、社群 editable PPTX。沒有 deploy／merge／cron 步驟。CI 的 `office-test-evidence`、`business-hq-real-evidence` 提供最新報告、手機／桌面截圖；`hana-office-review-site` 為靜態檔案包，須搭配驗收後端，不能當已接通網站。

本機若使用預先安裝的瀏覽器，可設定 PLAYWRIGHT_BROWSERS_PATH；在受控代理環境可能需 NODE_USE_ENV_PROXY=1 並排除 localhost。不關閉 TLS 驗證。

## 修正及仍未完成

- 真實測試修正：今日待辦 dialog 的操作順序、非同步導航等待、未接通／錯誤快照的 fail-closed 處理、封存工具在 #agents 的可見性。沒有刪除功能來通過測試。
- CI 揭露並修正：Playwright 1.56.1 與 Ubuntu 26.04 不相容，瀏覽器 jobs 固定 Ubuntu 24.04；Edge 來源設定增加明確型別；PostgreSQL 初始暫存 socket server 尚未建立測試 DB 的啟動競態改以最終 TCP server readiness 判斷，並等待 PostgREST schema cache。
- 發布前審查修正：第一次缺來源的 identified 商機，補上真實網址後可由新 request 升級原商機並連至新的審核任務；原 blocked run 保留。已查核或已核准紀錄不會被其他 request 重新歸屬。真實隔離整合增加 T02-corrected-source 與已核准紀錄保護測試。
- 原有社群／日曆／預約回歸保留；不是重新測試真實付款、SMTP 投遞或正式外部寫入。
- 其餘六項技能未接通、沒有公司自動搜尋、沒有生成式 AI、沒有自動寄信或追蹤排程；對外服務／客戶需求／企業適配仍由 HANA 核對。
- P0.1 當時的隔離測試未包含正式發布。後續正式發布及仍待驗收項目見頁首的第二輪狀態。
- P0.2 報價整合保持待辦；本階段程式及測試交給 ChatGPT 做商業功能驗收後再決定。
