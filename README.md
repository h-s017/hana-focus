# HANA FOCUS

每日工作總管測試版。Founder & Creative Director。

獨立於 AT 學員管理。部署分支：hana-focus-preview；網站內容：docs/。

正式站包含既有 localStorage 工作／教會板、Supabase Auth、雲端 Agent 任務與審核及私有月曆草稿；這些目前仍有資料流程缺口，詳見 SYSTEM_AUDIT.md。此分支新增中央工作台、可回復的本機匯入、專案版本／範圍及 Notion 單向同步候選，尚未部署。請勿把客戶資料或密鑰提交到公開 GitHub。

## Unified dashboard candidate

HANA FOCUS remains the daily entry. This branch reuses the existing Supabase task/run/review tables; root and workspace share one cloud dashboard. The legacy board remains a recoverable archive. Blank teaching rules automatically use existing Reservation inventory (read-only); no new official slots are opened.

- System inventory and gaps: [SYSTEM_AUDIT.md](SYSTEM_AUDIT.md).
- Release, Notion authorization, migration and recovery: [ops/UNIFIED_FOCUS_RELEASE.md](ops/UNIFIED_FOCUS_RELEASE.md).
- Tracked additive migration: `supabase/migrations/20261025173059_focus_central_workspace.sql`.
- No paid model calls, recurring sync activation, external notifications or client delivery. Real source/tool analysis is labelled `free_tools`; simulation does not persist a real execution. Website Notion/Google authentication and production import require separate verification.
