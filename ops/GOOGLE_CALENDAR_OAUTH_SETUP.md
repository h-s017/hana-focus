# Google Calendar 唯讀授權

此 PR 增加真正的網站授權流程；尚未部署、尚未取得真實 Google 同意。範圍只有 calendar.readonly，不改行程、預約、通知或付費設定。

## 原理與安全

先以既有 Magic Link 登入，再由受信任的 Supabase owner 發起 Google 授權。同分頁 sessionStorage 暫存一次性隨機 browser proof；Google 只送短效 code 回靜態回呼頁。回呼頁先清除網址 code，再使用目前的 HANA 登入呼叫服務端交換 token。

服務端使用 S256 PKCE、10分鐘 state、browser proof、資料庫 trusted owner 檢查與一次性 CAS。沿用 hana_automation_events 保存 pending state 的雜湊及加密 PKCE 資料，只有 service_role 能寫；claimed 時清除 pending payload。過期 pending 不能使用，保留於原操作紀錄。速率限制限制正常連續發起，並非跨多個並行請求的嚴格全域配額。

Google access／refresh token 僅保存於原 hana_connector_credentials，沿用 AES-GCM 與 owner associated data；不回傳瀏覽器，不寫聊天、Issue、public GitHub 或日誌。只接受指定唯讀 scope；取得 API 讀取成功且主日曆為 Asia/Taipei 才保存，重連以 credential version CAS 防止覆蓋較新的連線。日曆來源過期或設定不完整時維持不可發布。

不新增資料表或 Migration，不開公開註冊，不改 Auth provider；Google OAuth 僅連接日曆，不取代既有 HANA 登入。原 legacy seed refresh token 相容，但新流程不需要人工取得 refresh token。正式 Google token 的儲存及首次讀取，必須等本人在 Google 同意後才發生。

## 一次性帳號設定（HANA／帳號擁有人）

1. 在 [Google Cloud 專案選單](https://console.cloud.google.com/) 先選擇已有的 HANA 專案；若要沿用其他既有專案，先確認其用途，避免重複新建或影響已用的 OAuth 應用程式。沒有必要啟用付費或修改 Maps／其他 API。
2. 在 [Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) 啟用 Google Calendar API。
3. 在 [Google Auth Platform](https://console.cloud.google.com/auth/overview) 完成應用程式設定：名稱 HANA FOCUS、本人支援／聯絡信箱；個人 Google 帳號採外部目標對象，測試階段只加入本人指定的測試帳號。
4. 「資料存取權」只加入 `https://www.googleapis.com/auth/calendar.readonly`。
5. 「用戶端」新增或沿用專屬 Web 應用程式 client。已授權來源為 `https://h-s017.github.io`；已授權重新導向 URI **精確**為：

   `https://h-s017.github.io/hana-focus/google-calendar-callback.html`

   這是本 PR 的實際回呼檔，須先核准並部署；不是 Supabase Auth 的 callback，也不是 workspace.html。不得改動其他系統的既有 client 或回呼。
6. 僅在 [Supabase Edge Functions Secrets](https://supabase.com/dashboard/project/ihmvziqisputjnjkuhvm/functions) 安全填入：

   | 欄位 | 來源 |
   | --- | --- |
   | GOOGLE_CLIENT_ID | 上一步 Web client ID |
   | GOOGLE_CLIENT_SECRET | 上一步 client secret；不貼聊天 |
   | GOOGLE_CALENDAR_OWNER_ID | 已獲 hana_office_access 的本人 HANA 登入帳號之 Supabase Auth UUID，不是信箱或 Google 專案 ID |
   | HANA_CONNECTOR_ENCRYPTION_KEY | 既有32-byte base64加密金鑰。已存在時沿用，**不得重新產生或覆寫**，以免原 OneDrive／Google 憑證無法解密。若缺少，須在受信任的本機／密碼管理器安全產生並直接輸入 Dashboard |

   不需要手動填 GOOGLE_CALENDAR_REFRESH_TOKEN。UI 僅回報哪類必要欄位缺少，不揭露任何設定值。
7. 核准本 PR 後，部署 hana-automation（包含 google-oauth.mjs、store、calendar 等相對依賴）與 Pages；不得只更新前端。
8. 同一分頁登入工作台 → 連線與設定 →「連接 Google Calendar」→ 本人在 Google 官方頁面確認唯讀範圍並同意 → 回呼頁顯示成功 → 返回月曆，讀取來源並重算。

外部應用程式若保持 Google「測試」狀態，Calendar 範圍的離線授權可能約7天到期，需要重新連線；長期背景同步需依 Google 的發布及驗證要求另行確認，不能承諾測試 token 永久可用。此 PR 不代替 HANA 發布 OAuth 應用程式。

## 驗收及限制

- 單元測試使用合成 Google token；瀏覽器 Google 同意頁為 mock，不是實際Google登入。
- 測試涵蓋 PKCE、過期、篡改、跨瀏覽器、重放／並行、錯誤 owner／撤權、scope 擴張、缺 refresh、時區、憑證版本競爭、provider 失敗及錯誤資訊保護。
- 原資料庫測試中另驗證 existing audit CAS、owner 隔離、前端無寫入與憑證讀取權限；交易 rollback。
- 本人同意、OAuth client secrets、真實投遞與月曆整合都需要正式設定後驗收，未完成前不能標成已連線或啟用排程。
- code 交換或權限查核失敗後需重新發起連線，不能重放同一個 callback。
- 如果憑證已成功保存但後續 audit 寫入失敗，回呼會明確提示紀錄待確認，不會宣稱所有紀錄完成。

## 回復

還原本 PR 前端／服務端程式即可，既有儲存格式與資料表未變更。避免刪除已保存的憑證或變更加密金鑰；不要清除既有任務、預約、操作紀錄。部署或真實Secrets變更仍需HANA核准。
