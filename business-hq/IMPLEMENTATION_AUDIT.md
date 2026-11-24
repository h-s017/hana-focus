# HANA BUSINESS HQ P0.1 程式及資源盤點

查核日期：2026-11-24。這是開發分支的盤點，不能當成正式部署完成證明。

## 保存與分支比較

- 本次為全新執行環境，原本沒有專案 checkout 或可保存的未提交修改；不能宣稱已備份先前電腦內的檔案。clone 後工作樹乾淨，並建立本機 `checkpoint/hana-focus-before-hq` 保存正式基準。
- `hana-focus-preview`：`fca4d2daafccc9f42f0aa81929c759e3a28d70ba`。
- `hana-business-hq-v1`：`0a3c4ae6fcdd3e7cb7ea579fc1bda6eb4f699e05`。
- `git rev-list --left-right --count preview...hq` 為 **0 / 9**。差異只有 README、CODEX_PHASE1 及七個 SKILL.md，共九個文件；既有正式程式沒有分岔。
- 實作分支從 HQ 規格分支建立，PR 最初以 HQ 分支為 base；HANA 核准合併部署後，PR #52 改以既有部署分支 hana-focus-preview 為 base，透過 PR 推進發布，不直接推送正式分支。遠端 `feat/pm-material-intake` 另有未整合的素材需求工作；保留該分支，未整批合入、重寫或假稱已完成其功能。
- 已讀根目錄 SYSTEM_AUDIT、ops/UNIFIED_FOCUS_RELEASE、現行前端、hana-agent、hana-automation、schema／migration。未發現 AGENTS.md。七項技能均為 1.0.0。

## 實際架構與資料

`workspace.html → office-app → focus-dashboard → business-hq` 共用現有登入；`hana-automation` 既有 Auth 驗證後將 `hq_*` 動作交給固定技能 runner；runner 經現有服務端 Supabase 權限保存至既有 tasks/runs/reviews 與新增商機表。沒有新工作板、Supabase 專案或付費模型。

| 查核項目 | 來源及行號 | 結論 |
|---|---|---|
| 實際網站來源 | scripts/build-office-site.mjs:2、.github/workflows/hana-focus-preview.yml:53 | 根目錄頁面＋js/icons/content，產出 public-site；docs 只保留部分舊工具 |
| 既有登入／工作台 | js/office-app.mjs:24、js/focus-dashboard.mjs:9 | 沿用 Supabase Auth、work/church、既有專案／任務與 localStorage 備份工具 |
| 既有任務執行／審核 | supabase/schema/hana-office-review.sql:9、:58 | hana_tasks、hana_task_runs、hana_reviews 及 claim/finish/review/recover/handoff RPC 保留 |
| 中央專案／範圍與權限 | supabase/migrations/20261025173059_focus_central_workspace.sql:1、:71 | 沿用 projects/versions/documents、來源對照、衝突及 fresh DB app_metadata 核對 |
| 新商機與最小擴充 | supabase/migrations/20261124114411_business_hq_phase1.sql:2、:19 | 只新增 hana_business_opportunities；runs 增加 nullable 技能欄位與歷史，不修改舊狀態限制 |
| 去重／並行／重試 | 同 migration:55、:82 | owner+request advisory lock、輸入及技能 hash、owner/domain/branch 唯一、attempt token fencing、最多五次明確重試 |
| 人工審核／追蹤 | 同 migration:115、:127、:137 | 呼叫既有 hana_review_task；內部核准不等於已聯絡；追蹤只保存日期；商務進展必須人工確認及紀錄 |
| 白名單技能資源 | scripts/build-business-skills.mjs:7、hq-registry.mjs:1 | 真實 MD 生成服務端 bundle，含全文／版本／SHA-256；一致性測試防止忘記重新產生 |
| 網址研究工具 | hq-source.mjs:3、:16 | HTTPS 公司公開頁面、服務端 host allowlist、禁止任意 host/IP/credentials/port/redirect，限大小與時間；不提供公司發現／搜尋 |
| 執行入口與 UI | hana-automation/control.mjs:5、js/business-hq.mjs:11 | owner 來自已驗證 JWT；來源文本只作資料；純文字顯示成果，沒有原始 JSON 作日常畫面 |

以上相對路徑中的 `hq-*.mjs` 位於 `supabase/functions/hana-automation/`。

以既有 Supabase `ihmvziqisputjnjkuhvm` 的唯讀 information_schema／pg_catalog 查核，tasks、task_runs、reviews、projects、project_versions、project_documents、focus_ideas、external_ids、sync_conflicts、sync_state、intake_receipts、project_materials、connector_credentials、automation_settings/events、booking_changes、monthly_drafts、calendar_links/locks、canva_import_jobs 均已有資料結構，相關表已啟用 RLS；未找到既有 CRM 商機表。未讀取或公開客戶列、憑證值，未對正式資料庫套用本次 migration。實際隔離驗證使用 PostgreSQL 17、Supabase GoTrue、PostgREST，並非把 mock 當正式 Supabase。

既有任務狀態維持 queued/running/review/approved/rejected/failed，既有 runs 維持 running/review/failed。新的 skill_state 另外記錄 blocked/failed/running/review/approved/rejected。為相容舊資料，HQ 任務 role 仍為 Project Manager；真正執行權限由 skill_id 決定，source_system=business_hq 會被舊 Agent 核准／執行路徑拒絕。

## 原 Agent 功能處置

| 處置 | 功能 | 本次結果 |
|---|---|---|
| 保留 | Auth、雲端任務、工作／教會、備份／復原、日曆、預約、社群／Canva、素材連線 | 原程式與資料保留；回歸測試覆蓋，未重新授權或改正式設定 |
| 重構 | 日常角色入口、可讀成果 | 同一 composer 加入經營處理方式，主要入口改為目標／來源／成果，不再以三角色卡片作主要入口 |
| 整合 | 執行紀錄、人工審核、owner 隔離 | 重用既有 tasks/runs/reviews；加版本、工具與來源證據、重試歷史、商機追蹤 |
| 封存 | 舊社群／秘書／PM 狀態卡片與開發工具 | 移至「資料管理與進階設定 → 封存：舊版工具與執行紀錄」，仍可操作；沒有刪除舊任務或停用既有排程 |
| 已接通的技能 | sales-marketing P0.1 | 已知公司網址的實際唯讀查核、規則評分與草稿、持久化、內部審核、人工進展、匯出 |
| 尚未實作 | 其餘六項技能執行、公司搜尋／發現、生成式商務分析、P0.2 報價整合 | registry 清楚標示 not_connected；呼叫未接通技能只保存 blocked，不偽造執行成功 |

## 邊界及待處理

- 本階段沒有研究搜尋供應商或付費模型。`HANA_HQ_SOURCE_HOSTS` 在正式環境是否設定未讀取，無設定時工具停用並回 blocked；本次未改秘密設定。
- 評分只是技能文件所列 4/3/3 的字詞／證據規則，不能證明企業實際有需求。提案明確標記規則式草稿、假設與待訪談，不是正式報價或客戶核准。
- canonical_domain 是小寫 hostname 去除 www，不是完整 Public Suffix List 的集團／子公司判斷；分公司需要 branch_key 與說明。跨子網域的公司歸戶須之後獨立設計。
- 來源不跟隨跳轉；被反爬、過大、公司名無法核對或不在 allowlist 都會受阻，不放寬權限來假裝成功。
- 快照首版最多 200 商機、100 runs、200 reviews；大規模分頁與跨商機合併不在 P0.1。
- 現有背景作業不重建、不開新 cron。HQ 僅由明確需求啟動；人工追蹤日期不會自動寄送通知。
- 正式 SMTP 投遞、Google/Microsoft 授權、正式預約／付款及 Canva 發布未在本次重新操作；回歸成功不等於已完成這些服務的正式端到端驗證。
