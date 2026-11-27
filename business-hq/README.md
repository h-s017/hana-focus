# HANA BUSINESS HQ V1 — implementation foundation
2026-11-24｜Asia/Taipei

## 現況核對
基準：hana-focus-preview @ fca4d2daafccc9f42f0aa81929c759e3a28d70ba。
已實際讀取 README.md、SYSTEM_AUDIT.md、ai-office.html、index.html、js/office-app.mjs。已有 Supabase 登入、工作台掛載、hana_tasks/runs/reviews、舊角色任務與審核呼叫；前端存在 ai_not_configured 錯誤提示。舊 Agent 在封存 details。原有 README 記載部分整合尚未驗證；本次未實測登入、資料庫或已部署網站，因此不視為已完成或已失效。
沿用 HANA FOCUS 及原有雲端資料，不另建 Supabase。保持工作與教會隔離；不更動日曆、預約、社群、已存在的審核與歷史資料。

## 技能索引
- corporate-strategy
- operations-management
- sales-marketing
- market-intelligence
- people-management
- research-development
- financial-management
- business-systemization

各 skills/<name>/SKILL.md 是版本化作業指引，不是已安裝的 ChatGPT 技能或已運作 Agent。Codex 必須在執行端實際載入正確版本，記錄版本/hash，並驗證輸出。參考網址為研究起點，使用時核對現行內容。

## 優先順序
P0：以可執行 B2B 商務開發垂直流程為首個版本；其次 MY ORGAN→既有報價、現金流。P1：供應商與研發；P2：社群轉換優化。不要先製作所有模組的空殼。
開發及驗收契約見 CODEX_PHASE1.md。
原規劃分支只新增規格與技能。後續實作候選 `feature/business-hq-phase1` 沿用這些資源，提供 P0.1 執行引擎及 B2B 垂直流程；正式環境尚未發布。最新程式盤點見 [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md)，真實隔離測試見 [ACCEPTANCE.md](ACCEPTANCE.md)，授權與回復見 [RELEASE.md](RELEASE.md)。其餘六項技能仍未接通，不列為已完成。

## 市場商機研究中心（2026-11-27）
新增 [market-intelligence](skills/market-intelligence/SKILL.md)，作為銷售中心與 P0 B2B 流程的上游研究能力，銜接 B2B/B2G/B2C/B2B2C、研發、生產與財務。規格已納入；前端、排程與執行引擎尚待接通及驗收。

## 統一商業決策規範
[DECISION_PLAYBOOK.md](DECISION_PLAYBOOK.md) 為跨技能共同入口：六關、痛點驗證、四道賽道門、三層業務與持續收入。執行端須載入此規範及相應技能版本；優先在 P0 B2B 流程驗收，避免重複模組。規範已寫入，尚未驗證執行引擎載入或正式部署。
