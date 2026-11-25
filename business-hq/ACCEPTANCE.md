# HANA BUSINESS HQ 驗收紀錄

## 第二輪與正式環境

| 項目 | 版本與驗收狀態 |
|---|---|
| GitHub Pages | [PR #54](https://github.com/h-s017/hana-focus/pull/54) 已發布。正式介面顯示「尋找商機」，按鈕由服務端可用狀態控制。[發布紀錄](https://github.com/h-s017/hana-focus/actions/runs/45422028210) |
| 正式 Edge | 依第二輪獨立驗收，`hana-automation` v31 未包含 `hq-discovery.mjs`。本次可確認端點拒絕未登入請求。部署連接器未提供有效的專案連線，因此尚未更新或以管理權限重新讀取版本。 |
| 商務流程 | 既有規則式流程可批次選入候選、送出來源查核並保存 CRM。生成式分析為逐批選用。只使用通過白名單及公司名稱查核的公開頁面，並核對模型所引原文。具體需求仍列為待訪談假設。 |
| 紀錄與審核 | 搜尋完成只留下供應商與候選筆數。建檔記錄來源、引文、內容雜湊、分析成果與人工審核。CRM 的 AI 草稿及分析報告可分別從商機和執行紀錄回讀。原有一般工作列表沿用舊版摘要，AI 報告位於 Business HQ。 |
| 技能接通 | 「業務與行銷」有建檔和審核流程，其搜尋、公開來源與生成式分析各自顯示設定狀態。其他六項只有文件。已設定代表工具有足夠設定啟動，成功與否以執行紀錄為準。 |
| 真實端到端 | 正式環境尚未用授權帳號跑完搜尋、分析、儲存、審核及重新登入回讀。隔離測試使用真實 Auth、資料庫及公開來源。新的模型回應是明確標示的測試資料。 |

### 搜尋和模型費用

- Brave Search 每 1,000 次為 USD 5，Search 方案每月提供 USD 5 額度，約 1,000 次。$0 預付仍有信用卡驗證。使用前需由帳號持有人確認適用條款、關閉自動儲值並核准以免費額度為上限。工作台單次搜尋發出一個供應商請求，搜尋摘要只用於畫面預覽。保存候選網址前也需確認適用的結果儲存權利。[Brave 價格](https://brave.com/search/api/) · [Brave 額度說明](https://api-dashboard.search.brave.com/documentation/resources/help-feedback)
- 免金鑰選項可用既有人工來源流程，或在指定產業、地區使用 OpenStreetMap 的公開資料作為補充名單。公共查詢資源有限，資料覆蓋及公司官網完整度需另驗證。第一階段未接上這個替代來源。[OpenStreetMap 公用查詢限制](https://wiki.openstreetmap.org/wiki/Overpass_API)
- 生成式執行層沿用 Responses API，在一個請求中產生當批個別分析與提案。只傳已核對的公開摘錄與產業、區域及服務條件。模型費用依所選模型和輸入／輸出 token 數計算，需另外核准。來源未核對時保持待查。模型錯誤時保留已查核的來源，執行紀錄標示失敗。[結構化輸出](https://developers.openai.com/api/docs/guides/structured-outputs) · [OpenAI API 價格](https://openai.com/api/pricing/)

### 正式驗收條件

1. 恢復 `hana-ai-office` 既有專案部署權限。先比對現行正式檔案，再部署已審核的 Edge 並讀回版本與執行檔。正式更新可先維持搜尋和模型停用。
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
