# Issue #4／PR #6 驗證紀錄

分支：`feature/issue-4-notion-validation`。接手基準：`ae4fd4a919a1dd37a8c4560c5079f9c863afbb56`。日期：2026-10-18（台北）。

## 實際修改

- 延續 PR #6 而非合併 PR #5：保留並擴充原五項回歸測試。基準五項測試本來全過，但不涵蓋任務欄位差異、不完整分頁或完整Actions執行。
- Notion 改用固定中心頁及三個白名單任務頁的明確 ID，比對 status/select「狀態」屬性及正規化UTC時間；不按標題／內文推斷完成。缺基準或映射保留unknown；後兩筆任務不猜測頁面。
- 初始結構化基準為null，避免把原人工快照敘述當作已核准Notion狀態；需要HANA另行確認後才能建立基準。
- 分頁cursor錯誤、重複、巢狀深度／請求／區塊上限、無效回應與頁面映射均明確失敗；不靜默假裝覆蓋完整。
- 僅允許GET，拒絕redirect，報告只保留受控ID／URL／時間／狀態及待審核欄位。HTTP／網路／格式失敗不輸出原文、金鑰或錯誤body，失敗不保留舊成功報告。
- Project Manager列最多三項建議與G1–G5；B/C包裝範圍仍由HANA決定。
- 指定開發分支與PR跑離線CI，不讀secret。Notion真實讀取改為按次手動授權，移除排程，使用notion-readonly environment；管理端required reviewers必須由HANA確認，程式不宣稱已設定。

## 本機證據

Python 3.12.14；離線fixture，不用真實Notion key。

| 命令／情境 | 結果 |
|---|---|
| 接手後原始 `python -m unittest discover -s tests -v` | 5 tests，OK |
| 修改後同命令 | 38 tests，OK |
| `python -m compileall -q agents tests` | exit 0 |
| `python agents/project_manager.py --project wenqingji` | exit 0，產出5筆快照、最多3項建議及G1–G5 |
| 子程序明確設定空NOTION_API_TOKEN後執行 `python agents/notion_readonly.py` | exit 2，顯示「未連線」；單元測試另斷言API零請求 |

38項涵蓋：原5項回歸、分頁／巢狀區塊／表格文字、403／404／401／429、無金鑰、時間等價／變更／缺失、結構化狀態差異、文字完成不採信、自訂狀態遮蔽、G1–G5與work隔離、請求及深度上限、白名單與重複ID、無效頁面／區塊格式、主程式成功與安全失敗、YAML觸發與最少權限。

## GitHub Actions 證據

提交後讀取指定分支run、job steps與log，再填入實際URL及結果；本機測試不等同Actions驗證。

## 尚待授權／驗證

- 真實Notion API未執行；聊天connector可讀不代表Actions有權。此環境未提供可用Notion憑證，也未驗證GitHub environment保護／secret是否設定。
- 目前GitHub connector沒有workflow_dispatch方法；GitHub CLI先前受認證與網路限制。本輪若手動觸發不可用，將如實記錄，不能以push CI取代手動執行成功。
- HANA只需依 [NOTION_SETUP.md](NOTION_SETUP.md) 的單一設定流程：Read content integration、分享中心及三個映射任務頁、required reviewer／prevent self-review保護environment、在environment secret安全填入NOTION_API_TOKEN，再核准當次讀取。不要把key貼到聊天／Issue。
- 讀取授權不等於G1–G5業務核准；B/C方案與正式交付不自動判定。

## 採用與回滾

PR #6保持待審核，不自動關閉Issue或合併。沒有網站部署，不修改index.html、docs/index.html、Pages workflow或AT repository。
關閉PR保留基準；若HANA日後採用後要回滾，另開revert PR再審核。停用Notion workflow或撤除secret可停止讀取，不恢復已輪替的舊token。
