# PR #18 月曆整合與發布前審核

此 PR 是候選程式，不能自動部署。現有正式預約、客戶訂單與付款不變。未啟用 2026-10-27 或其他自動排程。

## 可驗證行為

- workspace.html 頂部與 HANA FOCUS 根頁的 HANA WORK 有本月／下月七欄月曆、選日詳情、來源狀態。CHURCH WORK 不顯示商務月曆；既有本機任務、構想不遷移或覆寫。
- 共用既有 Supabase Auth 與 Google Calendar 服務端憑證設定。Google 只讀最小事件欄位，不存標題、參與者或地點；Reservation 只 GET 原 public slots，不讀寫客戶訂單、付款或通知。
- Google singleEvents 展開重複事件、分頁、透明／取消／全天事件及台北時區沿用原驗證介面。不完整分頁、來源離線、缺少網站授權時，整月維持未驗證，不假設可預約。
- 本人先輸入授課星期、時段、課程分鐘及前後緩衝。僅計算全域時間候選，不推定具體商品、價格、名額或已取得上架許可。不同課程規格需後續細分；此版本沒有商品配置或公開預約功能。
- 新私有 hana_monthly_drafts 只存規劃草稿，不是平行訂單庫。owner+month 主鍵對應 monthly-availability:YYYY-MM；每次更新增加 revision，舊核准失效，事件保存變更日期與審核版本。
- manual override 僅能關閉／移除草稿手動關閉，不會重開原系統關閉場次；重算與背景更新保留覆寫。本人核准只記為 approved_internal，published 永遠 false。
- 超過 30 分鐘的來源快照、未驗證來源或未設定規則不能核准。所有真正對外上架仍未實作，需另行審核具體寫入流程。

## 月末 worker（未啟用）

- `hana-automation/monthly-worker` 使用獨立強秘密 token，且 `HANA_MONTHLY_SCHEDULE_ENABLED` 必須明確為 `true` 才會查詢設定。預設關閉。
- 資料列 schedule_enabled 預設 false；網站使用者沒有寫入此欄的權限，也沒有開啟排程的前端動作。
- 只在台北每月最後五個曆日 08 點執行；SQL 以 owner+台北日期鎖定並記錄一次 daily claim，防止重複觸發。重複請求不重新讀取來源。
- 2026-10-27～31 都更新 2026-11 同一資料列，保留 manual override；每天更新後重新待審。
- 此 PR **沒有建立 cron job、沒有 schedule workflow trigger、沒有呼叫 worker 或提供排程 secret**。未來執行器需每天 00:00 UTC（08:00 台北）以安全 header 呼叫該 endpoint；驗證後才設定三個獨立開關：執行器、服務端 enabled、指定 owner 設定。不可把 token 放 URL 或公開 pg_net HTTP queue。
- 失敗記錄 monthly_job_failed，停止當日自動重試；本人可在網站明確重新產製。沒有模型呼叫，維持 NT$0 API 預算。

## 網站端連線及最終必要操作

1. HANA 核准本 PR 的精確提交與新私有規劃表後才套用 schema/hana-monthly-calendar.sql；先更新後端，再經原 Pages 人工核准發布前端。
2. 確認 Google 網站端 OAuth readonly 授權與 owner 綁定；現有 ChatGPT Google 連線不等於網站憑證。沿用既有 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_CALENDAR_REFRESH_TOKEN、GOOGLE_CALENDAR_OWNER_ID、HANA_CONNECTOR_ENCRYPTION_KEY 安全後台設定，不在聊天或 GitHub 填 secret。
3. 本人指定並確認授課時段、課程時長／緩衝。未提供時不預設營業時間。
4. 上線後登入本人帳號實測：讀取兩來源→本月／下月→關閉日期→重算保留→版本衝突→審核→確認原 Reservation 及付款沒有寫入。離線 mock 不替代真實授權驗收。
5. 上述皆完成後，另核准啟用月末排程及安全執行器；這不授權正式發布可預約時段或客戶通知。

## 測試證據

PR 的 GitHub Actions 連結與精確提交由 Codex 在驗證完成後更新。Node、Playwright 全 mock、Deno 與 PostgreSQL17 臨時交易測試；資料庫測試最後 rollback。正式網站端授權／整合測試／部署尚未完成前，這份 PR 不標記為上線完成。
