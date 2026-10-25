# Verified integration status — 2026-10-25

No secrets, raw customer records, real project folder URLs or private calendar details in this report.

## Production observations

- hana-focus-preview advanced from approved PR10 merge ea49d18 to 52fba78 through existing social/visual scheduled content updates. Those four generated content files are retained when updating this feature branch. Do not revert the default branch or reuse its old base tree for a release.
- Last verified Pages deployment remains Actions 40108170950 at ea49d18. Code on the newer default branch is not proof of publication. Pages workflow builds public-site and deploys via Actions; source-mode check is inside the successful deployment. No subsequent deployment is claimed.
- Supabase public schema currently has hana_tasks, hana_reviews, hana_task_runs and hana_project_materials, all RLS enabled. Automation candidate tables/functions have not been applied. Existing tasks, results and decisions remain intact.
- Auth logs aggregate inspection recorded successful login activity and HTTP 429 rate-limit responses. This supports real Auth use, not end-to-end SMTP delivery verification. Resend Verified domain screenshot and saved SMTP/URLs are user-supplied configuration evidence. Current SMTP credentials, Auth allowlist and expiry behavior cannot be independently read via available tools; do not request or expose existing keys or claim fresh email delivery tests.
- Supabase security advisor returned one password-leak-protection warning, unrelated to the Magic Link code. No paid feature/plan change was made. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Existing deployed hana-agent remains paid-AI disabled. No provider key absence is inferred from the execution environment; no secret values are read.
- 文慶雞 Creative Producer wall-planning record was already internally approved by HANA. The existing guarded handoff RPC created/reused its final PM child; a rules-based progress summary was imported via management tools. Readback confirmed review status, one matching run result and zero final-PM approvals. This is a real cloud workflow record, not an autonomous/API-generation demonstration. No source facts, production delivery or customer approval were fabricated. The candidate also fixes final PM instructions/report to stop the chain instead of suggesting another strategy cycle.
- Connected Google Calendar read succeeded for the primary calendar, 2026-10-25 through exclusive 2026-11-01 in Asia/Taipei: four events, three opaque and one transparent, resulting in three busy intervals. Raw private event data is excluded from GitHub. No calendar writes, notices or reservation changes were made. The workspace adapter still needs its own approved server credentials.

## Existing reservation architecture inspected

h-s017/reservation already contains Code.gs legacy booking, Cloudflare payment-worker, D1 slots/order/quantity/refund/cancellation logic and admin UI. Production payment API configured in index.html is hana-course-production.hana-reservation-payment.workers.dev; CNAME is reservation.hanascent.com. No edits to this repository are included. GET /api/slots is the existing public read path; admin POST routes require its server admin token and origin checks. Public website fetch was unavailable through this session's fetch tools; repository inspection is not live API availability evidence.

The new comparison adapter is tested against that real public slot schema. Actual production write integration is intentionally absent pending credentials and write approval. Do not create a parallel order database or import customer PII to public fixtures.

## Candidate feature evidence

PR12 holds the disabled-by-default durable worker, manual approval gates, source-grounded role handoffs, bounded recovery, daily attempt caps, encrypted Microsoft device login and read-only folder traversal, unified controls, and read-only Calendar/reservation comparison. Node tests use fixtures. Browser tests mock APIs; PostgreSQL tests use ephemeral PG17 and real service_role permissions. CI links and final commit are maintained in the PR description after the final run.

## Pending consolidated authorization / setup

1. Review and approve PR12's exact tested SHA, additive schema, Edge deployment and Pages publication. No major platform/database replacement is proposed.
2. AI model, provider project budget and securely set API key; approve transmission of selected project text. Attempt/output limits do not guarantee dollar spend. Do not purchase/upgrade automatically.
3. Microsoft public-client app and Files.Read/offline_access consent; select project folder explicitly. Registered sharing link does not itself provide a runtime token.
4. Encryption key and worker token stored server-side; approve five-minute cron plus per-project start. All defaults remain off until activation.
5. Google calendar.readonly server authorization and account binding for website preview. Existing ChatGPT connection is already readable and does not need to be re-created merely to inspect events.
6. Production reservation admin bridge, calendar writes, notifications and live end-to-end rehearsal need explicit scoped authorization and safe configuration. They remain incomplete and disabled, not hidden behind a claim of full integration.

No new DNS/Resend account/key is requested merely because it cannot be inspected. Only unresolved safe-configuration checks remain for Auth/SMTP.
