# Issue #4 驗證紀錄

## 本機離線證據

環境：Python 3，PyYAML；所有Notion回應均為合成fixture，無真實金鑰／客戶原文。

- `python -m unittest discover -s tests -v`：28 tests，全部通過（首次執行）。涵蓋分頁／巢狀區塊／純文字與表格解析、缺或重複cursor、深度／區塊上限、結構化狀態same／changed／unknown、時間正規化、中心頁未變但子任務變動、無映射、未知值不外洩、403／404／401／429、無金鑰零請求、網路及格式錯誤、不跟隨redirect、GET限制、G1–G5、前三建議與work隔離、YAML觸發及權限。
- `python agents/project_manager.py --project wenqingji`：產出5筆快照任務報告，最多3項建議與G1–G5；不是Notion即時資料。
- `python -m compileall -q agents tests`：通過。

## 遠端驗證

已確認 [Project Manager Review run 39057189552](https://github.com/h-s017/hana-focus/actions/runs/39057189552) **completed / success**，觸發方式 push，驗證提交 `02e1db95c1dad134f3d81a572b9cac11f1382bd0`。
已讀回 job 117467458808 的 steps 與完整 log：28 tests 全過、快照報告產生成功、artifact 上傳成功；執行權限 Contents: read。
[project-manager-review Artifact](https://github.com/h-s017/hana-focus/actions/runs/39057189552/artifacts/12110251322)，ID 12110251322，保留7天。

### 尚未完成的驗證
- **workflow_dispatch 未驗證**：目前 GitHub connector 無 dispatch 方法。已嘗試 `gh workflow run project-manager-review.yml --repo h-s017/hana-focus --ref codex/issue-4-notion-readonly -f project=wenqingji`，環境在代理連線階段返回 socket operation not permitted，沒有建立手動 run。CLI 的 auth status 另顯示注入登入不可用；未索取、讀取或輸出金鑰。沒有以合併、發布或其他認證繞過限制。
- **Notion 真實 API 未驗證**：本輪執行環境未配置 NOTION_API_TOKEN，且無法透過管理工具驗證 environment required reviewers 或 secret。未借用聊天的 Notion connector 代替 Actions 認證，也沒有未經核准讀取真實中心頁。
- **HANA 環境審核待管理員確認**：依 NOTION_SETUP.md 唯一設定流程，確認 Read content、分享中心與三個映射頁、設定 required reviewer 與 prevent self-review、environment secret。之後在已審查分支手動執行並補 run URL；同一次 Notion 讀取授權不等於 G1–G5 核准。
- 手動工作流程的 YAML／輸入及最少權限有離線測試；push 成功不能證明 workflow_dispatch 已成功。Issue #4 保留未結案，PR 等 HANA 審核。

PR：[ #5](https://github.com/h-s017/hana-focus/pull/5)。以上是功能提交的執行證據；後續僅補文件不改動已測試程式。

## 安全與人工審核

未修改 `index.html`、`docs/index.html`、Pages workflow或AT repository。只新增顯式映射與null基準，不臆造任務狀態或改變G1–G5。
離線CI不讀secret；Notion流程僅手動，environment的required reviewers必須由HANA檢查設定，程式不宣稱已代設。

回滾：關閉PR不影響基準分支；若採用後需回滾另開revert PR經HANA核准。可先撤除Notion secret／停用workflow停止讀取，不回復舊token。
