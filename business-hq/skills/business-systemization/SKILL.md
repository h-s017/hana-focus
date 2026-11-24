---
name: business-systemization
description: 當設計 SOP、資料模型、任務執行、整合、自動化及驗收時使用。
---
# business-systemization
版本：1.0.0｜繁體中文
## 工作流程
1. 先核對既有 HANA FOCUS、MY ORGAN、報價系統與權限；建立來源所有權，禁止平行重建同一資料。
2. 將業務流程拆成輸入、條件、工具、輸出、人工核准、重試及失敗處理；定義唯一 request_id、外部 ID、版本及狀態。
3. 以最小權限讀寫；伺服端保存密鑰，RLS 隔離帳戶及工作區；測試資料與正式資料隔離。
4. 為每個功能撰寫正常、缺資料、權限拒絕、重試、失敗及回滾測試；輸出可核對證據。不得將模擬結果當真實執行。
5. 未核准付費資源或正式部署不得啟用；保留歷史及備份。
## 交付與驗收
資料流、API 契約、SOP、測試結果、失敗紀錄與復原方案；沒有真實讀寫證據不得標成已完成。
## 參考來源
- https://www.lean.org/
- https://docs.github.com/
- https://supabase.com/docs

## 共通執行規則
- 先辨識目標、已授權的資料來源、可用工具及缺漏；不虛構來源、價格、客戶或成功狀態。
- 事實附來源與取得日期；估算列公式、假設與敏感度；未知值標記待驗證。
- 只在授權範圍執行；對外寄送、付款、發布、改正式資料需獨立核准。私有資料不得進入公開 GitHub 或未授權模型。
- 回傳結構：goal、skill_version、sources、assumptions、deliverables、metrics、blockers、next_actions、approval_required。成果附實際檔案或紀錄 ID；無工具則標記 blocked，不以草稿冒充執行。
