# HANA BUSINESS HQ P0.1 驗收紀錄

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
- 原有社群／日曆／預約回歸保留；不是重新測試真實付款、SMTP 投遞或正式外部寫入。
- 其餘六項技能未接通、沒有公司自動搜尋、沒有生成式 AI、沒有自動寄信或追蹤排程；對外服務／客戶需求／企業適配仍由 HANA 核對。
- 尚未做正式環境 migration／Edge／Pages 發布，以及正式上線後的指定帳號 smoke test。須依 RELEASE.md 另取得核准，不能標記為已部署。
- P0.2 報價整合保持待辦；本階段程式及測試交給 ChatGPT 做商業功能驗收後再決定。
