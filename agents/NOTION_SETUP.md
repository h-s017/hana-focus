# Notion API｜HANA FOCUS V5

## 啟用方式（一次性設定）

1. 到 Notion 的 **Settings → Connections / Integrations** 建立一個內部整合，僅給予 **Read content** 權限。
2. 在「文慶雞｜HANA AI 專案管理中心」頁面，使用 **Connections** 將該整合授權給此頁。若需讀取其他頁面，須分別授權。
3. 複製整合的 **Internal Integration Secret**。不要將金鑰貼到對話、Issue、程式或公開檔案。
4. 到 [hana-focus GitHub Actions secrets](https://github.com/h-s017/hana-focus/settings/secrets/actions) → **New repository secret**，名稱填 `NOTION_API_TOKEN`，值貼入金鑰。
5. 到 [Notion Read-Only Review](https://github.com/h-s017/hana-focus/actions/workflows/notion-readonly-review.yml) 手動執行。成功後下載 `notion-readonly-review` Artifact。

## 運作模式

- 讀取 Notion 頁面 ID `3fc9b41981ae8112bef6d0aa5b9616e3` 及其區塊。
- 與 GitHub `agent_data/projects.json` 中的最後編輯時間及任務標題做有限比對。
- 報告不含 Notion 內文，避免在 Actions artifact 暴露客戶資料。
- 每週一 UTC 01:15（台灣時間 09:15）執行，並支援手動執行。GitHub Actions 排程可能延遲。
- **唯讀**：不會寫回 Notion、不會自動同步任務、不會對外發布或自動核准。
- Notion API 只會取得整合獲授權的頁面；若 HTTP 403/404，檢查頁面分享權限。
- GitHub Pages 靜態工作板的本機資料不會自動同步到此報告。

## 後續
若要雙向同步，須另行設計後端、使用者身分驗證、差異審核與回寫權限；不可將 Notion token 放入公開網站的 JavaScript。
