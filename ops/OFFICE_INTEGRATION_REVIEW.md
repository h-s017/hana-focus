# HANA AI OFFICE｜持續整合審核包

2026-10-24（Asia/Taipei）｜品牌 Hana Scent Artist｜分支 feature/office-auth-agent-integration。
這是可測試程式提交，尚未獲准正式發布。未更動DNS、SMTP、正式預約時段、客戶資料，未發送郵件或寫入日曆，未購買／升級服務。

## 實際檢查結果

| 範圍 | 已取得證據 | 尚未驗證 |
|---|---|---|
| GitHub | hana-focus-preview 基準 b3b5dd6932d7e4eea349fd1a1fe69e9acc6cbb48；根目錄AI OFFICE／WORKSPACE已存在 | 新版正式採用 |
| Pages | 既有workflow只上傳docs；另有dynamic pages build同時成功，存在來源／發布競爭風險；[既有部署](https://github.com/h-s017/hana-focus/actions/runs/40094628871) | 管理端Source設定；本次web工具無法開啟正式網址，不能宣稱已確認網站內容或HTTP200 |
| Supabase | hana-ai-office，ihmvziqisputjnjkuhvm，Tokyo ACTIVE_HEALTHY；Postgres17；hana_tasks／hana_reviews皆RLS且各0筆；hana-agent ACTIVE v2 | 新版schema／Edge正式部署與真實使用者操作 |
| Auth／SMTP | 已讀登入程式及官方Magic Link／SMTP文件；執行環境無秘密憑證綁定 | 無Auth管理設定讀寫工具，因此Site URL、Redirect URLs、SMTP是否已設、Resend帳號／域名驗證與Edge secrets存在性皆未證實；不以執行環境未綁定推斷Supabase沒設key |
| 安全 | 已讀RLS policies及security advisor；既有警告是[Leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | 未為此升級方案；Magic Link無密碼流程不代表可忽略後續密碼模式安全 |
| Calendar | 既有Google Calendar connector已能列出日曆 | 這不代表預約後端有OAuth或已選定用哪個日曆；未寫入或讀取行程原文 |
| 既有預約站 | URL已提供，web工具無法開啟 | 尚無預約站repo／後端資料來源，未改動正式庫存 |

Supabase changelog Markdown抓取因工具content-type不支援失敗，已改讀[HTML changelog](https://supabase.com/changelog)及本次相關官方文件。執行環境HTTP proxy不可用；未改路由／繞過代理。

## 已實作

### 登入

- 共用office-auth模組，固定回呼到 `/hana-focus/ai-office.html`；shouldCreateUser=false，僅已受邀帳號登入。
- 單次請求鎖、跨頁冷卻、可用時navigator.locks跨分頁鎖；伺服端rate limit仍是權威，前端不保證服務額度重置。
- 支援implicit session、PKCE code、email token_hash；成功或失敗都先清理URL，referrer policy不攜帶敏感回呼。顯示過期／已用／錯誤／429安全提示，不直接反射API錯誤。
- 登出成功清空私有任務DOM，登入狀態由同一Supabase client storage保留；未修改舊HANA FOCUS的localStorage keys或WORK／CHURCH隔離。

### 三角色與人工交接

- Project Manager可在沒有AI key時產生明確標記「規則式」的工作分解草稿；Brand Strategist／Creative Producer只在服務端有AI key時呼叫AI，前端僅有原先Supabase publishable key（可公開，非service-role／AI key）。
- 角色指令區分策略、研究待查、三方向、Moodboard需求及製作驗收。沒有來源不捏造研究，不冒稱圖檔或客戶核准。
- 候選SQL補原子claim、唯一request_id、交易式review＋audit、交接唯一性、失敗／重試／退回重排及10分鐘逾時回收。舊run無法覆寫回收後新run。
- RPC是SECURITY INVOKER，僅service_role可執行；Edge每次Auth /user驗證且按owner篩選。額外要求服務端可信app_metadata.hana_office_access=true或HANA_OWNER_IDS白名單，不能用user_metadata授權AI支出。
- UI僅在review顯示本人審核；approved後手動建立下一角色queued草稿，不自動生成。PM→策略→本人審核→製作規劃→本人核准→PM進度彙整；最後PM不再自動循環。本人核准≠客戶核准≠FINAL。
- 文慶雞測試需求可載入表單，須手動核對才儲存，不自動導入客戶資料。品牌紅、家徽／雙筷及B/C範圍皆保留未決。參考[Notion中心](https://app.notion.com/p/3fc9b41981ae8112bef6d0aa5b9616e3)與[策略V1](https://docs.google.com/document/d/15aRA0TDcv0JAxJvQMh-vWDPwC9Pc-yWI71IaULnRvDA/edit)，沒有假稱本次已完成自動同步。

### 日曆／統一工作台

- WORKSPACE直接嵌入同一登入、任務、審核、執行紀錄，AI Studio入口移到內嵌區，不只跳轉。
- 新增Asia/Taipei唯讀時段計算：含Google all-day排他結束日、取消／透明／暫定行程、重疊合併與半開區間；無時區或不完整行程拒絕計算。
- 可在WORKSPACE試算合成範例；不是正式可預約時段、Calendar同步或客戶預約。重複預約的正式資料庫鎖、通知、取消／改期寫入尚未接入。
- 以白名單public-site打包既有公開頁、icons、js、content及docs既有工具；不發布supabase、agents、agent_output、ops與測試資料。Pages候選流程改為需HANA勾選授權的手動發布，限制主要分支；管理端也須設required reviewers並確認沒有第二個branch-source pipeline。
- Service Worker只清理hana-workspace前綴的自有cache，避免影響同origin其他網站cache；不清理任務資料。

## 測試證據

- 本機：Node24；agent14、auth10、calendar6、site1、server adapter3，共34項測試通過；模擬完整文慶雞四步交接，不含真實AI呼叫或郵件。
- JavaScript syntax checks、workflow YAML解析通過。
- 真實Supabase候選SQL嘗試使用BEGIN／ROLLBACK驗證時工具回傳Invalid or expired requestState，故不算SQL驗證成功。隨後已查證run table及active_run_id欄位未持久化，原tasks／reviews仍各0筆。正式schema未改動。
- 已加入CI隔離Postgres17合成fixture，測試SQL編譯、原子狀態、審核audit、owner RLS、RPC權限、交接唯一性、失敗重試、逾時回收及ROLLBACK；不另外建立Supabase專案。
- 已加入CI瀏覽器測試：所有外部請求攔截為fixture，測試登入／回呼／重整／登出、四步人工審核交接、舊storage保留及320/390/820版面，截圖artifact。
- 已加入Deno Edge type check；此環境無Deno，CI已通過首版檢查。Edge adapter使用原生HTTP，不新增Supabase npm安裝依賴；前端保留既有精確版本2.57.0。

不能把mock瀏覽器或fixture模型輸出寫成SMTP投遞、真實AI品質或Google同步驗收通過。正式使用者登入／郵件、實際AI API與預約端到端仍待授權及測試。

## 一次性必要授權／設定清單

1. **Resend Free與網域**：由帳號擁有人建立／確認免費帳號，加入發信子域auth.hanascent.com。正式DNS修改前需核准面板實際產生的紀錄（DKIM TXT、發送驗證SPF／MX及需要時DMARC）；尚未取得面板值，不捏造DKIM。不要取代根網域現有MX／SPF，亦不啟用不必要的收信。建議寄件人login@auth.hanascent.com、名稱Hana Scent Artist，均待HANA確認。
2. **SMTP及Auth安全欄位**：只在Supabase Dashboard → Auth → Email／SMTP設定Resend憑證；host smtp.resend.com、port465、user resend、password為Resend API key，僅服務端保存。Site URL建議為https://h-s017.github.io/hana-focus/workspace.html，Redirect白名單精確加入https://h-s017.github.io/hana-focus/ai-office.html，不用廣泛wildcard。確認邀請帳號並以本人指定測試信箱完成一次實際投遞及登入驗證。勿將密碼／key貼聊天、Issue或公開repo。
3. **AI服務端**：確認Supabase Edge secrets內OPENAI_API_KEY及OPENAI_MODEL；如需新增，直接在Dashboard安全輸入。設定可信帳號app_metadata.hana_office_access或HANA_OWNER_IDS，不開公開註冊來測試。是否已有key目前未知，不要求重建、不購買或升級。
4. **Calendar／預約**：確認應影響預約的日曆、阻擋行程規則及既有預約站repo／資料庫。只讀OAuth先驗證，再另核准Calendar寫入與通知權限；refresh token只進服務端secret store。不複製客戶行程到公開repo。
5. **正式採用與發布**：審核此PR與候選SQL、Edge及Pages來源設定。核准後才按下述順序部署；本次不自行合併、寫DNS或發布。需要設定github-pages required reviewers，並停用／調整重複的branch-source部署才可採用新流程。

### Resend參考

[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)、[Magic Link](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[Resend Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)、[Resend domain驗證](https://resend.com/docs/dashboard/domains/introduction)。僅使用免費方案，不在程式硬編免費額度或假定已驗證DNS。

## 核准後部署與回滾

1. 先備份／審核現有schema，將supabase/schema/hana-office-review.sql以單一交易套用；用正式遷移流程產生migration紀錄，不把候選SQL檔當成已套用migration。
2. 在同一既有hana-ai-office專案部署hana-agent候選版本，維持JWT驗證及Auth /user，不為方便測試關閉認證；先確認目前JWT signing方式與gateway相容。
3. 設定服務端憑證／帳號授權，做本人測試帳號的CRUD、併發、人工審核、跨owner與錯誤流程；確認不會對外發送。
4. HANA核准靜態發布後，在正確主要分支手動觸發Pages，使用public-site並驗證workspace.html及ai-office.html、回呼白名單與手機流程。原HANA FOCUS入口與localStorage保留。
5. Calendar先dry-run對照，再由HANA另核准正式寫入／預約通知。

回滾：PR未採用可關閉，正式服務保持原狀；採用後以審核過的revert PR還原靜態檔，先停用新生成／交接入口。保留新增run及review紀錄，不DROP表或清資料；憑證撤銷／輪替只在服務端進行，不把舊秘密恢復到版本庫。不可用未核准舊版Edge替代而重新引入競態。

## GitHub 執行證據

功能提交42b1be9aa26447933d253f5be4a61c9029aa6569：
- [整合push run 40097489686](https://github.com/h-s017/hana-focus/actions/runs/40097489686)：全部3 jobs success。
- [整合PR run 40097497569](https://github.com/h-s017/hana-focus/actions/runs/40097497569)：success；[既有PWA驗證](https://github.com/h-s017/hana-focus/actions/runs/40097497537)亦success。
- job120882676054日誌：30項Node測試、mock瀏覽器登入／callback／重整／登出、四步人工審核與320/390/820響應式皆通過。
- job120882676207：Postgres17合成fixture之claim、audit、交接唯一性、失敗重試、逾時回收、RPC權限、owner RLS及rollback均PASS。
- [瀏覽器截圖證據包](https://github.com/h-s017/hana-focus/actions/runs/40097489686/artifacts/12560969775)；[完整靜態測試包](https://github.com/h-s017/hana-focus/actions/runs/40097489686/artifacts/12561970030)，均保留7天，未公開部署。
- [PR #9](https://github.com/h-s017/hana-focus/pull/9)為審核入口，未合併。後續Edge原生HTTP adapter變更會再由CI驗證；不以先前版本結果替代新提交。

### 本輪文慶雞來源讀回

已透過既有連接器實際讀取Notion中心（最後編輯2026-10-23T04:07:22.467Z）、其連結的[品牌識別手冊V1.0審閱基準](https://app.notion.com/p/4029b41981ae8161bda0eb5f9f3adc76)（2026-10-23T04:10:54.789Z）及Google Docs策略V1。新版手冊仍標DRAFT／INTERNAL REVIEW、非業主核准版；G2紅色、Symbol、G3方案範圍仍待核准，故測試需求保留未決，沒有將較新編輯時間當作客戶批准。這是本次按需讀取，不是已建立持續同步。

## HANA 授權紀錄｜2026-10-24

已由HANA在任務對話確認：採用Resend Free，不升級付費；發信子域auth.hanascent.com；寄件人login@auth.hanascent.com，名稱Hana Scent Artist。可進行免費帳號／發信網域設定準備，不啟用不必要收信。

尚未完成或核准：Resend帳號及網域是否已建立／驗證尚未知；未取得面板實際DKIM／SPF／MX值。DNS實際變更仍需先檢視該批紀錄再核准，不取代根網域MX／SPF。SMTP憑證僅能填入安全的服務端設定，不貼聊天或Issue；此確認不代表正式對外自動發送、schema／Edge／Pages發布已獲核准。

目前工具未提供Resend帳號／網域管理或瀏覽器操作連線，故沒有宣稱已代建立、驗證或修改DNS。

### HANA 核准SMTP與Auth設定｜2026-10-24

HANA已確認以下設定方案：SMTP host smtp.resend.com、port465、username resend；password為Resend API key，僅在Supabase Dashboard服務端安全欄位設定。

- Site URL：https://h-s017.github.io/hana-focus/workspace.html
- Redirect URL精確白名單：https://h-s017.github.io/hana-focus/ai-office.html
- 不新增廣泛wildcard；確認受邀帳號後，可對HANA另行指定的本人測試信箱執行一次實際投遞與登入驗證。測試收件信箱尚未指定，不推定為任何連接器帳號。

這是方案核准，不是已套用證據。現有工具沒有Supabase Auth／SMTP管理設定能力，也沒有Resend或瀏覽器操作連線；實際Site URL、Redirect白名單、SMTP憑證與郵件投遞仍待帳號擁有人設定及驗證。未要求任何密碼／key貼到聊天、Issue或repo。尚未發送測試郵件，亦未啟用對外自動發送或正式發布。
