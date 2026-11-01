# HANA FOCUS｜氣味通信訂閱管理（唯讀）

## 入口與現況
- HANA FOCUS `workspace.html`、`index.html` 主選單的「氣味通信」→ `newsletter.html`。
- `js/newsletter-admin.mjs` 讀取正式官網 `hanascent-cms` Supabase 專案；**HANA FOCUS 的工作台登入不會自動授權讀取訂閱者資料**。
- 此頁使用官網 CMS 的公開 publishable key，但實際權限由官網資料庫驗證過的管理員角色與 Supabase MFA `aal2` 執行。令牌只保留在該瀏覽器分頁 sessionStorage；不複製訂閱者資料進 GitHub、localStorage 或 HANA FOCUS 工作板。
- 必須用已有官網管理員帳戶登入並完成驗證器驗證；未通過管理員檢查時不顯示清單。
- 本頁只讀：姓名、Email、訂閱來源、訂閱時間；可搜尋、選來源、分頁。沒有寄送、刪除、取消訂閱、手動核准或 CSV 匯出。

## 資料源
- 官網 Supabase 專案 `uzqaodfmnrjrsbvxhlmh` 的 `public.email_subscribers`。
- 官網 migration: `h-s017/official_site/supabase/newsletter-admin-readonly.sql`，提供 `public.newsletter_admin_list`。
- 呼叫方為 `authenticated` 才具有 EXECUTE，匿名沒有；私有 definer 使用既有 `shop_private.student_is_admin()`（確認 Email + role=admin + MFA aal2）後才提供資料。每次呼叫重新查驗，不能用前端 UI 隱藏取代後端權限。
- `course-intake` = 課前問卷；`student-registration` = 學員註冊；`website-subscription` = 官網訂閱。資料庫仍可能有其他來源值。
- 取消訂閱可能會從 email_subscribers 移除現有行；此頁顯示**目前名單**，不是完整歷史／退訂記錄。

## 發布與驗證
- 靜態網站建置腳本 `scripts/build-office-site.mjs` 已包含 `newsletter.html`，新頁 CSS/JS 隨 `js/` 複製。
- HANA FOCUS Preview 原有 GitHub Actions 發布工作流程要求經授權的 workflow_dispatch；僅提交分支**不代表已發布**。不得移除核准檢查以直接上線。
- SQL migration 已套用，匿名無法呼叫、authenticated 有權呼叫但每次必須經管理員 AAL2 檢查；沒有新建第二份訂閱名單或變更既有名單。
- 尚待正式驗證：指定管理員登入、MFA、搜尋、不同來源分頁、手機版與站點正式 URL；不可將程式檢查當作端對端測試。
- 如遇既有舊密碼或身分驗證問題，使用官網管理員既有登入與 MFA 流程，不要把服務端密鑰或 OTP 貼入 GitHub 或聊天。
