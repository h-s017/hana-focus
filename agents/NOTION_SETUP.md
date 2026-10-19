# Notion 唯讀授權｜HANA FOCUS V5

## 唯一必要的人工設定流程（由 HANA／帳號管理員操作）

1. Notion Settings → Connections／Integrations：建立 internal integration，僅開 **Read content**；關閉 Insert／Update content，不需要使用者資料讀取。
2. 在文慶雞專案中心 `3fc9b41981ae8112bef6d0aa5b9616e3` 的 Connections 加入整合。若頁面權限未繼承，另分享這三個已映射任務頁：
   - `3fc9b41981ae816c8804fe5c27e500d1`
   - `3d89b41981ae816887f0e92f0ec1cf62`
   - `3fc9b41981ae81568c7cdd9503779407`
   不需分享總工作區、其他客戶或 CHURCH WORK；讀不到任務會明確失敗，不擅自擴權。
3. GitHub Settings → Environments → 建立 `notion-readonly`，設定 HANA 為 Required reviewer，開啟 Prevent self-review，僅允許審核過的分支。若帳號方案不提供此保護，**不要配置金鑰或執行真實讀取**，先回報阻礙。workflow 檔案無法自行保證這個管理設定已啟用。
4. 在該 environment 的 Secrets 建立 `NOTION_API_TOKEN`，只在 GitHub 安全欄位貼整合金鑰。優先使用 environment secret；移除同名 repository／organization secret 以免繞過預期控管。不得貼到聊天、Issue、程式或前端。
5. Actions → Notion Read-Only Review → Run workflow → 選擇已審查的分支，勾選 `hana_review_authorized`；HANA 在 environment 核准當次執行。下載保留1天的 `notion-readonly-review` artifact，核對GitHub／Notion差異。

這是一組一次性設定加當次核准流程，不需另裝同步服務。若環境或金鑰已設定，不重建或要求再提供金鑰。HANA 的對話／Notion connector 能讀頁面不代表 GitHub Actions 已獲授權，不能借用其認證宣稱 API 已驗證。

## 結果判讀

- exit 0：完整允許範圍的 API GET 成功，產出差異審核；不代表通過G1–G5或資料同步。
- exit 2：缺金鑰，顯示「未連線」與設定提示；不送出 API。
- exit 1：API／快照／回應／覆蓋失敗；HTTP 401 檢查有效金鑰、403 檢查唯讀能力／頁面授權、404 檢查頁面是否分享給此整合，429 等候後由 HANA 重試。錯誤 body不會寫入log或artifact。
- `unknown`／null：缺映射、缺Notion狀態屬性、自訂值、或尚未核准的快照基準，不等同未完成。
- Notion當前status欄「完成」只作差異資料；HANA仍需檢查成果及簽核證據。

本版不啟用schedule，不自動更新Notion／GitHub快照，不寄信、不變更B/C方案，不發布Pages。工作板localStorage仍未連線；Calendar、Gmail、背景Agent與雙向同步都未實作。後續若需回寫須另案設計並取得HANA核准，不能直接提升整合權限。
