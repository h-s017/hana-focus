# HANA FOCUS system audit — 2026-10-26 Asia/Taipei

Audited deployment: `hana-focus-preview` @ `340da9584ab267783cd5173086da12d2461a418a`; PR18 Pages run 40211611879. This document describes observed code/configuration, not assumed completion.

## Observed system

| Area | Actual implementation | Reuse / gap |
| --- | --- | --- |
| Frontend | Plain HTML, native ESM, pinned supabase-js 2.57.0; root local board, workspace shared Auth/office, private mobile month calendar | Keep one HANA FOCUS entry; cloud and local boards currently separate |
| Pages | GitHub Actions; branch hana-focus-preview, root; exact-release `hana_publish_authorized` and github-pages environment | Retain approval guard; no automatic production switch |
| Local data | `hana-focus-workspace-v2-work` / `...-church`: `{tasks:[],ideas:[]}`; old `hana-focus-ai-office-demo-v1`; per-workspace/project markers | Existing exporter covers only active workspace; no restore/import transaction or cross-device sync |
| Supabase | Existing Tokyo hana-ai-office (`ihmvziqisputjnjkuhvm`); Auth Magic Link; trusted app_metadata authorization | Reuse; no new Supabase project |
| Cloud tasks | hana_tasks, hana_task_runs, hana_reviews; server claim/finish/review/recovery/handoff RPCs | Agent run state is not actual client delivery; missing project/version/source/scope/work-state metadata |
| Integrations | hana_project_materials, hana_connector_credentials, hana_automation_events/settings, hana_booking_changes | Private source credentials server-only; draft reservation changes never applied |
| Calendar | hana_monthly_drafts; source verification, manual overrides, revision CAS, internal review | Monthly schedule remains OFF; website Google OAuth must be independently validated |
| Agent | hana-agent v4; hana-automation v4; SQL PM cron every5min; paid provider disabled | PM tools available; Brand/Creative generation unavailable at NT$0. PR16 intake is not merged; do not describe it as deployed |
| Notion | GitHub read-only Python workflow + unmerged PR6 tools; connected Notion accessible here | No verified website continuous Notion import or conflict reconciliation |
| Booking | Existing reservation repo/main and public live slots; course-specific duration/capacity/unit/special dates exist | Do not ask owner to retype available data; no single generic lesson length; buffer policy not established by empty calendar |

## Source checks

Connected Notion source IDs and schema were read directly. The task database has 任務/備註/優先度/所屬專案/狀態/類型; states 未開始/進行中/等待中/完成. Latest project-center V3 explicitly supersedes old packaging/uniform tasks. Quote page is older and contains multiple schemes, so raw document content cannot be treated as the active task scope or evidence of client approval. Actual private source content and prices stay outside public repository fixtures.

Reservation has deployed frontend configuration, catalogue-rules.json, legacy Code.gs, public Worker inventory and an independent monthly UI-anchor workflow. Some exclusion dates differ. Live slot capacity/booked is authoritative for remaining seats; manual reservations must not be deducted twice. Missing dates do not imply authorization to create new sessions. Existing-only read mode can show already-open inventory without inventing teaching hours; creating new openings still requires explicit rules and review.

## Additive integration design

- Keep hana_tasks/runs/reviews/events and monthly drafts. Do not create parallel orders, task or agent tables.
- Add project/version/document/external-ID/sync-state/conflict records with UUIDs, owner RLS, timestamps and version CAS. Extend existing tasks with priority, scope, work-state, project/version and source metadata.
- Keep source task state separate from Agent queue/review and client-delivery approval. Scope/version checks apply to board priorities, progress and every Agent claim.
- Backup whitelisted work/church/legacy data before import; include a downloadable copy and reversible local restore. Never export Auth localStorage keys. Keep original records after import; device/source IDs make retries idempotent.
- One-way Notion import only. Incremental source hashes/edited times, dedup by page ID, title/explicit canonical matches and owner; ambiguous or locally edited updates enter conflict review. No Notion writes or deletions.
- Three free tools perform actual task analysis, source/version comparison and specification checking; all results enter review and are explicitly non-generative. Mock mode is separate and never presented as real execution; no paid model calls.
- Embed a single cloud dashboard in the existing entry with project details, top3, reviews, runs, conflicts and synchronization; local board remains a recoverable archive/Church workflow until explicitly migrated.

## Risks / approval boundaries

Production data remains unchanged during development. Existing pg_net public-schema and Auth password-protection advisories predate this work; don't put tokens in HTTP queues. Do not store customer documents or credentials in public GitHub snapshots. No new paid resources, DNS changes, secret changes, production switch, notifications, external deliveries or irreversible migration are authorized by this implementation request. Active client-approved scope is not inferred from AI drafts.

## Expected files

`js/focus-*.mjs`, `js/monthly-calendar*.mjs`, existing office entry/styles, `supabase/functions/hana-automation/{focus,notion,monthly,store,control,index}`, existing claim/review scope guards, an additive tracked migration, `tests/office/*`, `README.md`, and an operations/rollback guide. Preserve PR18 calendar and original local work/church isolation; reconcile PR16 overlap explicitly instead of overwriting files.
