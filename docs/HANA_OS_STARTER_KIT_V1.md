# HANA OS Starter Kit｜可複製部署系統規格 V1
更新：2026-11-04
狀態：設計規格／尚未實作一鍵部署；不得宣稱已可商用自動交付。

## 目標
以管理員 Email 作為建立新 Tenant 的入口，經管理員驗證與必要 OAuth / DNS / provider 授權後，自動產生可獨立使用的品牌網站、CMS、預約、會員 CRM、電子報與營運工作台。
Email 不是雲端部署憑證，也不代表取得使用者的 GitHub、Cloudflare、Supabase、Google 或寄信服務權限。

## 既有來源（不得直接把客戶資料複製到模板）
- h-s017/official_site：官網靜態基礎；CMS 專案 hanascent-cms 另存文章、公告與網站設定。
- h-s017/reservation：預約前端；另有 Cloudflare Worker 預約 API，需核實 API 及正式資料庫來源。
- h-s017/hana-focus：營運工作台、任務、日曆草稿；hana-ai-office Supabase。
- 會員與訂閱：CMS 已有 email_subscribers、helori_course_leads 等資料表；不能將 profiles（CMS 角色）誤作客戶主檔。
- 原系統其他工具屬可選插件，不進入 Starter Kit 核心。

## 產品架構
1. Control Plane（部署控制中心）：tenant registry、setup jobs、step status、connected providers、audit events、billing plan（可預留）、invite status。
2. Tenant App（每個品牌實例）：Public Site + CMS + Booking + CRM + Newsletter + Dashboard。
3. Infra Adapter：GitHub Template、Supabase migration、Cloudflare deploy / custom domain、Email provider（例如 Resend / Brevo；實作前選定）、Google Calendar OAuth（選用）。
4. 版本管理：一組模板版本號與 migration 版本；租戶更新需要相容性檢查、預覽與回復方案。
5. 預設選 tenant-isolated environment：每個客戶獨立資料庫或經檢證的嚴格 tenant_id/RLS 隔離；不可跨客戶暴露資料。

## 最小輸入與驗證
必填：管理員 Email（格式驗證、邀請驗證、唯一 tenant 申請）。
部署預設可先使用自動產生的 slug / 臨時子網域與示範品牌名稱；之後在引導流程填品牌名、Logo、配色、課程、時區、地區、隱私與退訂資訊。
正式網域需要 DNS 控制授權；正式寄信需要 SPF/DKIM/DMARC 等域名驗證；金流另需合規金流帳戶。
未獲授權時標示 blocked / awaiting_authorization，不得回報 completed。

## 部署狀態機
draft -> email_verification_pending -> authorization_pending -> provisioning -> validation -> ready -> invited -> active
失敗：failed_recoverable / failed_requires_manual_review，支援重試但必須 idempotent。
每一步記錄 operation id、request id、provider resource id、時間、錯誤碼；重跑不得產生重複的專案、帳戶、邀請。
外部供應商敏感 token 僅加密儲存在 Secrets / Vault，不進公開 repo、日誌或前端。部署控制面需具管理員授權與審計記錄。

## 資料模型（概念）
tenants, tenant_domains, tenant_memberships, tenant_features, provisioning_jobs, provisioning_steps, provider_connections, audit_log
contacts, contact_identities, contact_consents, contact_tags, courses, sessions, bookings, payments, attendance, questionnaires
newsletter_subscriptions, newsletter_campaigns, newsletter_deliveries, unsubscribe_events
content_posts, content_announcements, site_settings
注意：booking 訂單與金流由一個權威來源管理；CRM 關聯但不二次寫入獨立訂單影本。行銷訂閱需明確 opt-in、稽核時間、來源、範圍及退訂管道。

## 六大模組介面與事件
- Website/CMS：草稿、發布、版控，Webhook content.published。
- Booking：日期/名額/訂單/取消；booking.created/updated/cancelled 事件；Calendar connector 具同步去重與衝突處理。
- CRM：contacts 去重採已驗證 identity，勿僅憑同名合併；記錄歷程、權限和資料刪除請求。
- Newsletter：subscription.confirmed、consent.changed、unsubscribed；未獲同意不得推廣寄信；退訂立即生效，發送記錄與退信管理。
- Dashboard：只聚合讀取各模組的實際狀態；有權限的變更經原始 API 寫回；清楚標示同步時間與失敗。
- Agents：選用模組；產製與內部審核可自動，但公開發布、對客戶交付及外寄需獨立權限策略。

## 建議專案結構
apps/control-plane
apps/tenant-web
apps/tenant-admin
packages/design-system
packages/tenant-schema
packages/booking-adapter
packages/email-adapter
packages/provider-adapters
packages/event-contracts
infra/supabase
infra/cloudflare
infra/github-actions
templates/default-brand
tests/e2e

## Codex 實作次序
P0：建立新獨立 GitHub template repository（不複製秘密或真實會員資料）、維護版號、配置 schema 和 mock adapter；完成單一租戶 demo。
P1：建立 Control Plane，支援 Email 驗證、部署狀態機、稽核與重試；支援 sandbox provider。
P2：CMS + Website 真正部署，含臨時域名和 smoke test。
P3：預約 Worker 的真實 API 與訂單資料流梳理後接入，完成 CRM 單一客戶主檔；訂單變更不重複。
P4：電子報 provider、verified domain、訂閱同意/退訂和發送日志；sandbox 不實際寄信。
P5：Calendar OAuth、HANA FOCUS 白標版、AI Agent 選用插件與監測。
P6：正式客戶測試、故障回復演練、隱私與資安審核、交付手冊。

## 驗收條件
1. 一筆 admin email 可建立一個 sandbox 租戶，重複提交不產生重複資源。
2. 第一次授權完成後能部署 demo 官網和登入後台，顯示模板版本。
3. 測試報名 -> 訂單 -> CRM 關聯 -> 可選行事曆，不重複寫入。
4. Newsletter 訂閱需同意；拒絕/退訂後不再寄行銷信。
5. 租戶 A 的使用者無法讀寫租戶 B 的任何資料，包括 storage、REST API 與後台。
6. 可中止、重跑、追蹤單一步驟與清理部分建置的資源。
7. 未經 DNS、OAuth 或金流授權時保持等待狀態，不假稱部署完成。
8. 每個租戶提供可匯出資料與備份/回復流程；文案及照片素材不得從 HANA 範本洩漏到新客戶。
9. 管理員提供新 Email 只發出邀請，必須確認驗證後才能擁有最高權限。
10. 所有外部服務資費與可用額度屬動態資訊，部署前逐租戶顯示預估與必要核准。

## 現階段限制
2026-11-04 本文件僅建立可執行規格；尚未建立部署程式、連接服務或完成端到端測試。
