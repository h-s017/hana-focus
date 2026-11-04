# 課程訂單與課前問卷
入口：https://h-s017.github.io/hana-focus/#orders

訂單仍在原 reservation Worker / D1。新增需本人預覽確認，沿用原定價、場次、人數、容量、閉館及 36 小時檢查。待收款使用 LINE_CONFIRMATION，實際已收款需填參考才記錄 PAID，不建立金流交易。UUID 冪等防重複。

移除只允許未成立 PENDING / FAILED / CANCELLED，付款處理中、成功付款及已確認訂單擋下。取消、釋放名額並保留 ARCHIVE_ORDER。恢復顯示不恢復席位，寫入 RESTORE_ORDER。原始訂單與 audit 均保留。橋接固定路由與原管理員 owner，加上既有 office 與 reservation_read app_metadata，不能由前台擴權。操作紀錄不存聯絡資料。

原問卷 Apps Script 只有寫入 Google Sheet，沒有通知。舊前台 no-cors 也無法驗證成功。新增固定 hana-intake 接收端轉送原 Apps Script，核對成功、相同 UUID、來源列後才記錄完成。Apps Script 以鎖與第 30 欄 Submission ID 防重複並保持原部署網址、共享權限。完整答案仍在原試算表：
https://docs.google.com/spreadsheets/d/1kT-xXo9lRoR4ZlqpMr8cjCk2pejMdNcMg7lKHIqpZek/edit

hana_intake_receipts 僅保存最少姓名、曾上課程、來源列、處理與已讀狀態，不存完整答案。匿名無查詢 / RPC 權限。既有管理角色只能讀自己的收據並更新 seen_at，不能改完成狀態。RLS、大小限制、欄位驗證、固定 owner / 上游、HMAC 位址限流、租約與 UUID 冪等。姓名為學員自填，訂單對應仍待本人核對，不能自動同名配對。Newsletter 獨立且只在學生主動勾選後處理。

登入並開啟 HANA FOCUS 時，每 60 秒在可見頁面查最近 100 筆，顯示新問卷與待查核筆數，支援已讀與原始回覆入口。沒有背景推播或 Email / LINE 通知。舊問卷直接查原表，不宣稱已回補提醒；舊版快取前台仍可送出到原表，但不產生本次新提醒。

驗證：原訂單 32 項及新增管理 4 項測試通過；HANA FOCUS 228 項通過，包含固定來源、owner 授權、收據核對、失敗與重試及 Sheet 鎖 / 重複行為。資料庫確認 anon 不可讀取或 claim；authenticated 不能讀 digest 或修改 status，只能更新 seen_at。測試使用合成資料及記憶體 Sheet，沒有實際學生訂單、外寄通知或正式表內測試資料。

第一次真實學生送出後，仍需依原表與私有完成收據核實全程；不得把 mock 驗證說成真實學生已收到或完成。站內新回覆提示不代表本人已讀。
