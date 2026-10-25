# Semi-autonomous office: release candidate

Not deployed, no production migration applied, no schedule created, no paid calls made.
This extends the existing tasks/reviews and workspace; it does not replace them.

## Implemented

- Durable task queue uses existing hana_tasks/run states. A separate server-only worker claims one task per invocation, serializes work per owner, checks Asia/Taipei daily reservations and project limits, and leaves every result in review. Approved handoffs use existing atomic RPCs. Final PM stops the chain.
- Live read-only inspection confirmed service_role cannot select auth.users by default. Candidate SQL grants only id, deleted_at and raw_app_meta_data SELECT for revocation checks; no email, other columns or Auth writes. Ephemeral worker SQL tests run as service_role, not only as postgres.
- Background operation is independent of an open chat/browser once the approved five-minute cron is installed. SQL claims use row locks, SKIP LOCKED and an owner advisory lock; overlapping ticks cannot claim the same task or bypass reservation limits.
- Paused projects are not claimed. Two checks before source/provider calls detect pause. An already-sent provider request cannot be undone. Its result still goes to review.
- Stale workers become failed, not automatically retried. Human retry is bounded to three total attempts and still subject to daily limits. An ambiguous response after a provider call requires review, avoiding silent repeated billing. Existing failed tasks and approval decisions are retained.
- OneDrive delegated Files.Read/offline_access device login, encrypted credential storage, owner-bound AES-GCM authentication, refresh-token rotation, rate-aware pending/slow-down states, and folder browsing. Credentials never reach frontend or localStorage. Client secrets are not needed for this public-client device grant.
- User selects their own-drive folder separately from saving a sharing URL. /shares is deliberately not used because its documented least permission is Files.ReadWrite. Shared folder shortcuts and cross-drive sources are not traversed.
- User explicitly authorizes source transfer to AI per project. Max two nested folder levels, 40 files, 15 listing requests, 30-second snapshot signal, 16000 text characters total and 6000/file. Text formats: TXT/MD/CSV/JSON up to 128 KiB each. PDF/DOCX/images are metadata only; no OCR or visual interpretation is claimed. Pagination/limits are surfaced, and provenance versions are included in the review result.
- Source text is untrusted input; prompts distinguish evidence and AI suggestions. Model receives no tools and cannot approve, send, publish, buy or change external files. Task scope overrides generic older handoff suggestions (e.g. only history wall).
- WORKSPACE controls include source connection, folder selection, project scope, start/pause, daily cap, latest events and deterministic top-three priorities. Existing task approval buttons remain the only human approval path.

## One consolidated HANA approval before activation

1. Approve reviewed PR/commit, additive SQL and new hana-automation deployment. Do not merge or publish before approval. Existing hana-agent stays verify_jwt=true and paid calls disabled. New endpoint requires verify_jwt=false ONLY because worker uses its own strong secret; all user controls independently validate Supabase Auth bearer and trusted app_metadata.
2. Select AI provider/model and approve API usage budget. No plan purchase/upgrade is authorized. Supply OPENAI_API_KEY securely in Edge secrets; OPENAI_MODEL must be explicit. Default HANA_DAILY_RUN_CAP=3 per owner, project caps 1–6, output max1800 tokens. Limits reserve attempts, not successful outputs; this is NOT a dollar spending guarantee. Input/model pricing matters. Configure provider project limits/alerts too. No keys in chat, Issues or repository.
3. Create/confirm a Microsoft Entra application supporting the intended personal/work account with public-client device flows enabled; supply MICROSOFT_CLIENT_ID and optional MICROSOFT_TENANT (default consumers). Consent only to delegated Files.Read and offline_access, then connect in WORKSPACE. Files.Read is account-wide Microsoft consent; application traversal is restricted to the user-selected project folder. No Files.ReadWrite, app-only permissions or automatic sharing redemption.
4. Generate HANA_CONNECTOR_ENCRYPTION_KEY (32 random bytes, base64) and HANA_WORKER_TOKEN (>=32 random characters) server-side. Keep secrets in Edge secrets; worker token also in Vault as hana_worker_token. Existing publishable key goes in Vault as hana_publishable_key. Losing/changing the encryption key requires reconnecting OneDrive; there is no plaintext recovery path. Do not paste secrets here.
5. Approve reading selected project texts and transmitting them to AI. Folder URL registration alone is not consent to reading/transfer. Confirm document rights and scope in the project form; binary-only projects can execute planning but cannot claim to have read images/PDF/Word content.
6. Approve installing the five-minute cron and setting HANA_AUTOMATION_ENABLED=true. Each project remains off until its owner enables it in WORKSPACE. No emails, Calendar writes, customer delivery or publishing are included in this approval.

## Release and real-use verification

Apply supabase/schema/hana-automation.sql once after existing PR9/10 schemas; deploy all files of supabase/functions/hana-automation plus imported hana-agent/store.mjs and js/office-workflow.mjs. Keep all settings off. Configure secrets without displaying values, test unsigned requests rejected, authenticated status works, and worker secret/missing-master cases are safe. Activate the reviewed schedule only after HANA approval. ops/enable-automation-cron.sql is an activation artifact, not part of the migration.

Publish reviewed frontend with the existing Pages workflow and github-pages review. Browser mocks and ephemeral PG17 test evidence validate implementation; they do not establish real Microsoft login, paid OpenAI responses, long-running cron health or post-release access. Run a synthetic project first: device login → select dedicated synthetic folder → authorize text transfer → enable → queued→review → HANA approve→handoff→review → HANA approve→PM summary. Test pause, rejected, failed, expired Microsoft auth and daily cap. Then enable 文慶雞 with scope "只有沿革牆". Do not mutate existing customer tasks merely to simulate success.

If Microsoft/AI/cron remain unauthorized, preserve disabled state and use existing collaborative drafts. No unauthenticated tick, auto-approval or default enable is allowed.

## Documentation checked

- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/functions/background-tasks
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code
- https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
- https://learn.microsoft.com/en-us/graph/api/shares-get

## Google Calendar / existing reservation preview

The new calendar.mjs adapter refreshes server-side Google credentials, enforces a single configured Supabase owner, reads only calendar timeZone and event id/start/end/status/transparency, expands recurrence and follows bounded pagination. Incomplete snapshots and foreign all-day timezones fail closed. A fresh snapshot means cancelled/rescheduled events are recalculated without retaining stale busy blocks. No event titles, locations or attendees are requested.

It reads only GET /api/slots from the existing production reservation worker discovered in h-s017/reservation. It understands the existing date/time/capacity/booked/status shape and proposes CLOSE only for currently open overlapping slots. Booked conflicts require coordination, unknown durations require review, and previously closed slots are never automatically reopened. WORKSPACE renders the preview with the same login. Success/failure events are recorded privately. No reservation source code, D1 data or production timeslots are changed.

Runtime setup requires the existing or approved Google OAuth application's GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALENDAR_REFRESH_TOKEN in Edge secrets, GOOGLE_CALENDAR_OWNER_ID bound to the trusted Supabase account, optional GOOGLE_CALENDAR_ID (default primary), and the connector encryption key. Request calendar.readonly only. New rotated refresh tokens are encrypted in the same server-only credential table under kind google. The ChatGPT Calendar connector does not supply credentials to this website. Configure/consent safely after approval; no token belongs in chat or GitHub.

Still incomplete: applying closures to production, creating calendar events from confirmed reservations, cancellation/reschedule propagation, owner notifications and full live two-way tests. The existing reservation backend's admin authentication and business rules must be integrated under separate explicit write/notification authorization. A read-only preview is not production synchronization.

Remaining scope: OCR/PDF/DOCX parsing, visual design generation, Gmail/Notion runtime connectors, external web research and outbound notifications are not implemented by this PR. Do not describe them as complete.
