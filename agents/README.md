# HANA FOCUS V5｜規則式專案審核

這不是 LLM Agent 或背景同步服務。本輪僅支援 `wenqingji`／`workspace: work`，不變更 HANA WORK／CHURCH WORK 與前端 localStorage。

## 授權前：可離線驗證

```sh
python -m pip install PyYAML==6.0.3
python -m unittest discover -s tests -v
python agents/project_manager.py --project wenqingji
python -m compileall -q agents tests
```

Project Manager 只讀 GitHub 快照，輸出最多三項建議、G1–G5 及待 HANA 核對清單，不代表正式指派。PR／專用開發分支會跑離線 CI，不使用任何 secrets。

未設 `NOTION_API_TOKEN` 執行 `python agents/notion_readonly.py`：不發送 API 請求，退出碼 2，產出明確「未連線」設定提示。HTTP／網路／格式／分頁覆蓋失敗退出碼 1，不能解讀為 API 成功。報告先刪除舊結果，避免失敗後留下成功報告。

## 授權後：按次手動唯讀

依 [NOTION_SETUP.md](NOTION_SETUP.md) 設定後，HANA 在 Notion Read-Only Review 選擇分支並勾選當次讀取授權，通過 `notion-readonly` environment 的人工審核後執行。此版本移除原每週排程，避免未經審核自動讀取；未重新取得 HANA 同意前不恢復排程。

- 僅 GET 固定專案中心與明確映射任務的頁面 metadata、中心頁區塊；不進行搜尋、不寫回。
- 明確 `notion_page_id` 對應前三筆已存在證據頁。後兩筆不猜測映射。
- `notion_snapshot.status`／`last_edited_at` 目前為 null：既有人工描述不能冒充 Notion 結構化基準。即使讀到遠端狀態，第一次仍標 unknown，待 HANA 核准基準後以另個 PR 更新。
- 只讀 `properties.狀態` 的 status/select，值限「未開始／進行中／等待中／完成」。不按標題或內文推斷完成。新增自訂狀態須另行審核映射。
- 報告分開列 GitHub 基準與 Notion 狀態、兩邊編輯時間、差異原因、來源 URL、待審核欄位。中心頁時間相同仍逐筆比對任務；時間改變不代表狀態改變。
- 每次最多40個區塊請求、1000區塊、3層子區塊；深度／分頁不完整會失敗，不隱藏截斷。
- 不輸出 token、原文、原始錯誤 body、任務標題或自訂狀態。報告只保留本地ID、受控URL、標準狀態與時間；拒絕redirect以免轉送認證。
- Notion 報告為 artifact 保留1天，不 commit、不公開到 Pages；公開repo的artifact仍可能由有讀取權的人取得，故仍只保留最小metadata。
- 所有 G1–G5 仍待 HANA；遠端「完成」也不替代驗收；B/C 包裝方案不自動判定。

## 執行、採用與回滾

Actions → Project Manager Review 可手動執行離線快照報告；選擇本 PR 分支。Notion 手動讀取受 environment 審核及 secret 設定限制。讀取授權不是品牌案 G1–G5 核准。

本 PR 不含 Pages 部署，沒有前端或正式資料更動；不需發布。HANA 審查並核准後才合併。拒絕／關閉 PR 即維持原狀；若日後採用需回滾，以 revert 本 PR 的獨立 PR 交 HANA 審核，撤除 secret 或停用 Notion workflow 可立即停止讀取；不要還原已輪替的舊金鑰。

驗證證據：[ISSUE_4_VALIDATION.md](ISSUE_4_VALIDATION.md)。沒有真正執行的手動 workflow／API 不會標為通過。
