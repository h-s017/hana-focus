# 原 HANA FOCUS 集中管理入口 — 2026-11-04

使用者要求集中管理。以 h-s017/hana-focus 與既有 Supabase hana-ai-office（ihmvziqisputjnjkuhvm）為主，不建立第二套訂單、場次、Google 行程或正式月曆資料。

## 本次更新
- 原 index.html 與 workspace.html 的月曆入口置前；新使用者／無既有目的地時預設月曆，顯式連結及既有工作區目的地仍保留。
- 既有 monthly_load / monthly_generate / monthly_review 及 hana_monthly_drafts 原封不動沿用，增加跨月導覽、列表檢視、核實狀態、管理規則及訂單影響提示。
- 月曆可切往同站「客戶預約明細」，帶入所選日期；僅篩選已載入的目前頁，需使用者按鈕才向原系統讀取客戶資料。分頁不完整時不宣稱無訂單。
- 週一閉館／週六不可營業是本次使用者指定的管理規則；如果既有正式場次與規則並存，保留場次並提示核對例外。手動關閉明確標示僅屬草稿，不假裝已停止正式收單。
- 所有來源判斷沿用原後端；Google 未驗證或來源超過 30 分鐘時，不宣稱可預約。候選保持待確認。

## 實際核實（唯讀）
- GitHub 預設分支 hana-focus-preview；既有 Pages workflow 有精確版本發布授權 gate。
- 既有 Supabase 專案 ACTIVE_HEALTHY。原月曆草稿 2026-10、2026-11 存在，schedule_enabled 均為 false。
- cron.job 目前有 hana-automation-tick 及 hana-canva-daily-import；未讀取排程 SQL 內的秘密、未啟用／更動任何排程。
- 原月末 Worker 已具最後五天、Asia/Taipei 08:00、手動覆寫、每日 claim 與明確 enabled gate。ChatGPT 新站的 5 項排程額度不是此原系統的限制；仍需獨立驗證月末 Worker 連線後才可啟用。

## Sites 指引頁
先前新增的私人 Sites 站改為原 HANA FOCUS 的入口與來源說明。原獨立資料保留可匯出備份，原寫入端點停用，不自動匯入或覆寫正式系統。此頁不等同已發布本 PR 的原站新版，也不等同 Google／原訂單來源已通過實際使用者驗證。

## 驗證與發布
本次無資料庫 schema 變更、無 Edge Function 部署、無 OAuth／密鑰變更、無正式訂單變動。50 項相關 Node 測試通過，靜態網站可完整建置。原站更新經 PR 檢視及現有精確版本發布流程發布；不改寫或繞過其 gate。未在使用者實際登入狀態完成手機實機驗證。

## 復原
回復本次前端檔案即可。既有 Supabase 資料、正式訂單及先前 Sites D1 資料皆保留；不需刪表或回滾資料。
