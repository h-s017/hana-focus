# P0.1 發布與保留資料的回復

本 PR 只供開發及商業驗收。**未合併、未部署正式網站／Edge、未改正式 secrets、未套正式 migration、未啟用 cron、未對外發送。** 不要因 CI 通過就直接切換正式版。

## 驗收環境

在本機或 CI Docker 隔離環境執行 `tests/business-hq/local-stack.mjs`，使用既有 schema 的測試副本、真實 PostgreSQL／Auth／REST，帳號為隨機 `.invalid` 合成帳號。憑證只存在 `/tmp/hana-hq-*.json`／`.env`，不可上傳；`test-artifacts/` 僅含去除憑證的報告與合成帳號畫面。測試不存取正式客戶資料，不另建雲端 Supabase。

## 正式發布前需要 HANA 的一次核准

1. 核對 PR 的確切 commit、Actions 全部工作與 T01–T10 證據，通過商業驗收；單獨核准合併及網站／Edge 發布。現在沒有執行這些操作。
2. 在既有 Supabase 建立平台可用的備份／schema 記錄，確認可還原方式；核准套用單一 additive migration `20261124114411_business_hq_phase1.sql`。保留舊表／資料，不能重跑整份 schema 建置或 reset。
3. 如要真實讀取公司來源，由管理員在安全服務端設定 `HANA_HQ_SOURCE_HOSTS`，用逗號分隔已核准的公開 hostname。這不是 API key；勿放 IP、wildcard、私人網址或帶憑證的 URL。不要將所有網域任意開放。既有 Supabase service role 由 Edge 注入，前端不持有。
4. 不需要新付費資源或 AI API key。若未核准來源設定，保留 blocked／人工來源未查核模式即可。生成服務、搜尋供應商、正式報價、寄信、社群發送及新排程均不在本次發布範圍。

## 核准後的最小發布順序（僅說明，未執行）

- 記錄正式網站／Edge 目前版本與 DB migration 清單；另存原有授權設定，不把秘密輸出至日誌。
- 在既有專案套用此單一 migration，再部署經驗收的 `hana-automation` 及 `hana-agent`（後者包含拒絕舊路徑執行 HQ 任務的防護）。不可任意 reset、drop 或另建同名業務資料庫。
- 確認 `node scripts/build-business-skills.mjs --check`，根目錄 `node scripts/build-office-site.mjs` 產出 `public-site/`。依原 Pages 的人工授權流程發佈，不能只更新 docs/。
- 使用 HANA 指定且有權限的測試帳號驗證保存、來源、退回重試、刷新／重新登入、work/church 隔離；測試資料明確標示，不匯入真實客戶資料作 smoke test。
- 原 Google／預約／社群設定沿用；本次不測試對外發送、日曆寫入、扣款或交付。

## 回復

先回復前端顯示或暫停 HQ 呼叫，保留新增資料及稽核紀錄。將 `HANA_HQ_SOURCE_HOSTS` 留空可停用公開來源工具（需管理員授權更改）；不必刪資料。

DB 變更為 additive，不執行 destructive down migration，不刪 `hana_business_opportunities`、skill 欄位、runs 或 reviews。若已產生 HQ 任務，保留 `hana_hq_task_guard` 及 hana-agent 的 HQ 防護，不把這些任務交給舊 Agent。回復到舊 Edge 而失去該防護前，必須先隔離 HQ 操作並完成審查。舊任务的資料／status/role 約束不變，正式部署前仍須先備份。

本機測試容器名稱為 `hana-hq-test-pg/auth/rest`；測試後可停止這些指定容器。不要執行全機 `docker system prune`、刪除其他容器或重設正式資料庫。
