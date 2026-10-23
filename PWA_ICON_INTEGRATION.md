# HANA WORKSPACE PWA｜PNG 整合待辦

九宮格首頁已設定讀取 `icons/module-*.png`，但這些 PNG 尚未上傳 GitHub，因此頁面會顯示備援符號；不得將此分支視為完成安裝測試。

請從 HANA_WORKSPACE_Icons_Final_v2.zip 上傳以下檔案到 `icons/`：
- module-dashboard.png
- module-social-editor.png
- module-ai-studio.png
- module-brand-projects.png
- module-courses.png
- module-church.png
- module-review.png
- module-schedule.png
- module-settings.png
- hana-app-192.png
- hana-app-512.png
- hana-app-96.png
- hana-app-1024.png
- agent-hana.png, agent-sora.png, agent-lumi.png, agent-pino.png, agent-mori.png, agent-nami.png, agent-kiro.png

上傳後更新 `manifest.webmanifest`，以 PNG 192 與 512 作為主 icons；確認 512 PNG 在 maskable safe zone 內，若不符合則另製 maskable icon。更新 `workspace.html` 的 favicon / apple-touch-icon 與 `sw.js` 快取版本。

驗證：GitHub Pages 200 回應、Manifest 無 404、9 張模組圖像載入、Chrome 安裝提示、離線啟動、Android 實機與現有工作板資料保存。創辦人確認前不要合併至正式分支。
