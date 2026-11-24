# Codex 工程任務 P0.1 — B2B 商務開發垂直流程

## 目標
在既有 HANA FOCUS 中，以單一需求入口完成「公司研究 → 真實證據 → 商機草稿 → 審核 → 持久化及追蹤」。不是建立新角色或新展示面板。
工作分支 hana-business-hq-v1；不得直接修改正式分支。先閱讀現有 AGENTS.md（若有）、SYSTEM_AUDIT.md、ops/UNIFIED_FOCUS_RELEASE.md、現行 migration、hana-agent 與前端。核對 docs/ 或根目錄哪個才是實際部署來源。保留現有功能及審核狀態。

## Step 1 — 查核與設計
列出實際資料表、RPC、RLS、任務狀態、可用工具/來源與已授權連線；核對現有 repo 中是否已有 CRM。重用 hana_tasks、hana_task_runs、hana_reviews 與已有實體；如缺商機資料結構，才提出最小 additive migration。提供檔案與行號。現有 API 是否有可合法取得公開企業資料的工具不得猜測；沒有工具或金鑰時支援人工來源輸入＋標記 blocked；不能將人工模式當自動研究。

## Step 2 — Skill runtime
新增伺服端固定白名單技能 registry，將七個 SKILL.md 作為可版本化執行資源；實際供 runner 載入（若 Edge bundler 需 build-time copy，建立生成與一致性測試）。用明確 skill_id 或需求路由；首版僅實作 sales-marketing，其他技能標記尚未接入。每次 run 儲存 skill_id、版本、內容 hash、來源、工具呼叫結果、輸出與錯誤。外部文本僅為資料，不能覆寫技能、工具權限或核准規則。無可用研究工具回 blocked/source_unavailable；無生成服務時可產出明確標為規則式草稿的模板，不得假裝是 AI 研究或真實客戶分析。

## Step 3 — 商機資料契約
最少欄位：owner_id、company_name、website、canonical_domain、public_business_contact（optional）、source_url、source_checked_at、evidence_excerpt_or_summary、fit_reason、fit_score（0–10）、stage、next_followup_at、linked_task_id、created_at、updated_at。保留 evidence 陣列與可核對 URL。識別／合格／提案草稿／內部核准／已聯絡／洽談／成交／未成交分開；已聯絡須真實紀錄。所有欄位依照既有資料模型調整，避免重複 CRM。依 owner+domain 去重，重試使用 request_id；必要時記錄分公司區別。禁止個資或真實客戶資料進公共 repo。RLS 以已認證 owner 與服務端權限核對，不信任前端 owner 值。

## Step 4 — UI 與流程
在既有登入後工作區提供 B2B 商機入口，手機及桌面皆可。輸入產業、區域、服務範圍、數量上限；結果顯示來源、查核日、適配理由、缺漏、草稿、下一步、執行狀態。使用既有審核流程。保存候選與審核、重新整理後仍可讀取，失敗可重試且無重複記錄。外部發送、排程、付費服務、正式報價、客戶資料跨系統分享均不得自動啟用。沒有授權則僅提供可審核草稿。不得改正式部署或新增收費資源。

## Step 5 — 可測驗收（全部有證據才通過）
| ID | 情境 | 通過條件 |
|---|---|---|
| T01 | 具合法公開來源的公司 | 真實查核 URL 與日期，來源可開啟；無來源不得標記 qualified |
| T02 | 缺工具/來源 | 顯示 blocked 與原因，無虛構公司、無成功紀錄 |
| T03 | 技能載入 | 真實 run 留下 sales-marketing、版本及 hash，測試修改技能版本能識別差異 |
| T04 | 重送與去重 | 同 request_id 不新增兩筆 run；相同 owner/domain 不重複商機 |
| T05 | 權限 | 不同 owner 無法讀寫；教會工作區無商務資料 |
| T06 | 審核 | 可核准/退回/保存歷史，核准不改為已寄送 |
| T07 | 持久化 | 刷新與重新登入仍可讀取；使用隔離測試資料，不改正式資料 |
| T08 | 失敗復原 | 逾時/工具錯誤有狀態及重試方式，不吞錯誤 |
| T09 | 回歸 | 既有日曆、預約、社群、登入與任務歷史可用；320/390/820 px 無橫向溢出 |
| T10 | 成果 | 可匯出有來源的商機與提案草稿；未核准不對外發送 |

自動測試可用合成資料，但 T01 真實來源及 T07 真實隔離持久化需另測；不可拿 mock 宣稱通過實際測試。若無可用測試環境，標記 pending。列出測試命令、結果、測試日期、commit、截圖/紀錄位置與阻礙。

## 交付
開發 PR、diff、必要的 additive migration 與 rollback 說明、測試清單、真實資料測試紀錄、未完成項目。先交付首條流程，不擴展 P0.2 報價整合，直到本階段通過驗收。未經批准不得 merge、部署、啟用 cron、寄送、付費或改正式資料。
