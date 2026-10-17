# Issue #4 驗證紀錄

## 本機離線證據

環境：Python 3，PyYAML；所有Notion回應均為合成fixture，無真實金鑰／客戶原文。

- `python -m unittest discover -s tests -v`：28 tests，全部通過（首次執行）。涵蓋分頁／巢狀區塊／純文字與表格解析、缺或重複cursor、深度／區塊上限、結構化狀態same／changed／unknown、時間正規化、中心頁未變但子任務變動、無映射、未知值不外洩、403／404／401／429、無金鑰零請求、網路及格式錯誤、不跟隨redirect、GET限制、G1–G5、前三建議與work隔離、YAML觸發及權限。
- `python agents/project_manager.py --project wenqingji`：產出5筆快照任務報告，最多3項建議與G1–G5；不是Notion即時資料。
- `python -m compileall -q agents tests`：通過。

## 遠端驗證

待提交後填入實際 workflow run URL、head SHA 與結果，不把本機模擬寫成Actions通過。
手動dispatch需GitHub可用的dispatch權限／工具，Notion真實讀取另需environment人工審核及secret；若不可用將記錄阻礙，不合併或發布以解鎖。

## 安全與人工審核

未修改 `index.html`、`docs/index.html`、Pages workflow或AT repository。只新增顯式映射與null基準，不臆造任務狀態或改變G1–G5。
離線CI不讀secret；Notion流程僅手動，environment的required reviewers必須由HANA檢查設定，程式不宣稱已代設。

回滾：關閉PR不影響基準分支；若採用後需回滾另開revert PR經HANA核准。可先撤除Notion secret／停用workflow停止讀取，不回復舊token。
