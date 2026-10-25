# HANA-approved follow-up: booking changes and NT$0 operation

HANA approved PR12, additive schema, server release, scheduling and website Google Calendar read-only connection. HANA requested both slot/capacity and existing-order changes in WORKSPACE, retaining production reservation changes and outbound notices OFF. HANA then selected API budget NT$0, overriding the earlier undecided paid runtime plan. Selected OneDrive project folders may be read, and text/photos may be used for drafting subject to that budget; folder names must match project names.

## Behavior

- Adds a private change-request queue, NOT another booking database. Original orders, payments, cancellations and slots remain solely in h-s017/reservation.
- Slot date/time/capacity/open-closed proposals use the existing public GET slots API. Capacity cannot drop below booked count. Approval re-reads the original slot and rejects a stale snapshot. Approval means internal proposal approval only; there is no external mutation route.
- Order reschedule/quantity/cancel proposals preserve only reference IDs and requested changes. Without the original reservation admin read authorization, payment/refund/order status remains unknown and approval is blocked. Never infer that saving a cancellation draft cancelled a real booking.
- Saves use owner/request UUID idempotency. SQL reviews lock the change, permit only pending→approved/rejected, append an internal audit event and block unverified approval. RLS is owner + trusted app_metadata; frontend cannot directly write drafts or decisions.
- NT$0 mode has no callable paid-provider implementation. Only PM tasks can be claimed by the worker; Brand Strategist/Creative Producer stay queued for manual ChatGPT collaboration. Sources/photos are not sent to any AI API. Current folder read grant does not imply automated image understanding is operating.
- Free PM work runs as an atomic database-local cron transaction. No HTTP worker, external secret, paid request, raw Vault grants or SECURITY DEFINER helper is required. The RPC is service_role-only; user controls still validate Supabase Auth.
- Per-project enable/pause, daily reservations and human reviews remain. The cron can be enabled for PM rules without OpenAI credentials or fees. Service/hosting free-tier quotas remain; no plan upgrade is performed.
- Project/source selection compares normalized folder name to project name. Runtime snapshots also recheck to reject a renamed folder. Sharing URL registration is not a Microsoft token.

## Applied PR12 evidence before this follow-up

PR12 merged as 2ed3596a304263d926d6c46b55f1de412ddfff29 after approved head 2a64dd1 tests. hana_office_automation_runtime migration applied; hana-automation v1 ACTIVE with explicit per-request auth, hana-agent v4 ACTIVE verify_jwt=true and paid switch off. pg_cron/pg_net extensions installed. Five-minute hana-automation-tick exists but was paused pending this NT$0 worker release and Vault binding. No claim of Pages update from merge alone.

## Release order

Test PR with Node/browser/PG17/Deno. Apply hana-booking-changes.sql and hana-free-worker.sql once, deploy updated hana-automation dependencies, then change the approved five-minute cron command to `select public.hana_run_free_pm_tick();` and activate it. Keep all paid code closed. Use a clearly synthetic PM task for an actual free execution and leave its result in review. Inspect cron job_run_details for scheduled success separately from direct RPC testing.

Infrastructure inspection: pg_net is non-relocatable and owned by the platform; SQL REVOKE did not change its PUBLIC queue ACL. No token was ever placed in it: the only HTTP smoke request was unsigned and returned 401. The free scheduler therefore does not use pg_net or store any credentials in its request queue. Do not claim the unsuccessful REVOKE hardened platform ACLs. The extension metadata warning is documented at https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public; future authenticated HTTP scheduling needs a platform-approved protection change, not a workaround that exposes secrets.

Pages publication still uses the existing workflow with user-provided hana_publish_authorized=true and github-pages review. Existing connector cannot dispatch this workflow. Do not alter the release guard or claim live UI until that run succeeds.

Still requires safe account setup: Microsoft public-client app/Files.Read consent and matching folder selection; Google Calendar app/read-only refresh credentials and owner binding; original reservation admin read bridge before validating customer order changes. No new API payment consent or key is requested under NT$0. Photo interpretation through a paid API, real reservation updates, refunds, calendar writes and external messages remain disabled.
