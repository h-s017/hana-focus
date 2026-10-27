# 一個交辦入口：素材、需求與 PM 整理

使用方式：選專案 → 上傳照片或文件／貼素材連結 → 寫需求 →「交給 PM 整理」。這次的結果直接顯示在交辦框下方，亦保留在原工作。所有既有自動流程的進度集中於「所有自動處理與紀錄」，預設收合。

## 這次實作

- 私人素材區 `hana-work-intake`：最多 10 個檔案，每個 10 MB，總計 30 MB；JPEG、PNG、WebP、PDF、TXT、Markdown。
- 使用原登入、專案和 `hana_tasks.source_payload.work_intake` 保存檔案參照與連結；不另建工作板或 Supabase 專案。
- 檔案依 owner/project/request/SHA-256 命名，不覆寫原檔。RLS 限本人與該專案存取，即使已有其他寬鬆 Storage policy 仍不能跨帳號存取新素材區。前端沒有 Service Role Key。
- 上傳失敗保留素材與需求；已成功接單但畫面重載失敗時仍可重試，沿用相同請求 ID，不重複上傳或建立工作。
- PM 沿用免費規則工具，核對已上傳檔案存在、大小與類型，依檔名分類、整理交辦內容、提出步驟與待確認事項。文字檔只擷取有限片段。
- 結果顯示白話清單，不顯示內部 JSON。舊 PM／策略／製作結果也轉為可讀摘要，且新報告不再把任務舊 result 反覆包入新 result。
- 日常畫面只保留交辦與結果；既有 PM、社群文案、Canva、日曆與 Notion 的狀態在同一處集中讀取。此處沒有啟動排程或修改預約的動作。

## 實際能力與界線

「整理素材」目前指保存檔案、核對檔案及依檔名分類。照片視覺辨識、PDF 內文解析、修圖及設計工具執行均未由這個免費 PM 工具完成。素材連結只登記，不冒稱已讀外部檔案。沿革牆步驟是專案工作草稿，不是已完成的設計；重要輸出沿用人工審核。API 預算仍為 NT$0。

文慶雞實際照片選片與圖文初稿另由本次 Codex 工作製作並供 HANA 查看。私人照片、Canva 簽名連結與個案成果不進公開 repository。

## 測試與發布

- Node：全部 `tests/office/*.test.mjs`；新增輸入驗證、服務端檔案核對、舊 JSON 摘要及報告成長防護測試。
- Playwright：兩套離線 API 替身流程；涵蓋素材上傳失敗、接單後重載失敗、重試去重、可讀結果、原資料保留、登出及 320／390／820 像素版面。
- PostgreSQL：`tests/office/work-intake-rls.sql` 在 CI 暫存資料庫驗證 migration 重複執行、跨帳號／跨專案隔離、禁止原檔覆寫刪除、匿名存取及舊 bucket 不受影響。
- Edge：由既有 Actions 做 TypeScript 檢查。正式檔案投遞與登入帳號測試須在核准部署後完成，離線替身測試不取代正式驗證。

Migration 由 UTC 時間產生檔名。環境中的 Supabase CLI 因唯讀使用者目錄無法啟動，未藉此變更正式 schema；SQL 僅在 PR 和隔離資料庫審查驗證。

## 核准後部署順序

1. 確認 PR head 與全部 CI 成功，且與最新 `hana-focus-preview` 相容。
2. 套用 `supabase/migrations/20261027053642_pm_material_intake.sql` 至既有專案；驗證 bucket 為 private、RLS 與其他 bucket 未改動。不新增憑證。
3. 從最新整合分支部署 `hana-automation`，保留既有 OAuth、Canva worker、Secrets 與 Cron。確認 `focus_intake_status` 回傳 version 1 且 private_files_ready 為 true。
4. 以受保護的 GitHub Pages workflow 發布前端，並驗證公開 JS／CSS 為該版本。
5. HANA 登入上傳一個無敏感內容的測試檔，驗證接單、可讀結果、跨裝置查看原檔、登出隔離。

本 PR 不自行合併、部署或套用正式 migration。發布需要 HANA 一次核准私人素材區、服務端與工作台更新。

## 回復

回復前端與 Edge 到先前核准版本；已存在的任務、原素材與 Storage 物件保留，不執行刪除。此 migration 不回填或覆寫既有業務資料。若後續需要清理未完成交辦的孤立上傳，另由本人明確核准後進行，不在失敗重試中自行刪除。
