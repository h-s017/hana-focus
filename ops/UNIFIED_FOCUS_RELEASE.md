# Unified HANA FOCUS release and recovery

This branch is a review candidate. No central-schema migration, project import, Notion credential change or new application version has been deployed by this work. Existing PR18 production remains in place.

## Logical data map

| Requested concept | Reused / additive storage |
| --- | --- |
| projects | hana_projects, per-owner work/church isolation |
| tasks | existing hana_tasks plus work_state, priority, scope, current project/version, source metadata and dependencies |
| project_versions | hana_project_versions; immutable contract/source definition per label; new version explicitly activated by HANA |
| project_documents | hana_project_documents with external page ID, original URL, content hash, edited/synced times |
| approvals | existing hana_reviews for Agent drafts; private hana_automation_events for version/conflict approval; no client-delivery auto-approval |
| agent_runs | existing hana_task_runs; scope/version checks, claim exclusion and result review |
| sync_events | existing hana_automation_events plus hana_sync_state, hana_external_ids and hana_sync_conflicts |
| calendar_events | original Google Calendar remains source of truth; read-only week/month projections, no parallel editable calendar |
| booking_rules | existing hana_monthly_drafts.policy; default existing_slots_only automatically reads course times/capacities, never creates new official slots |
| idea inbox | hana_focus_ideas, not automatically converted to tasks |

## One daily entry

Root index and workspace use the same Auth and dashboard modules and the same cloud records. The old local board remains an explicitly labelled archive/recovery surface. The old Agent form is an advanced history view; no second new Agent task board is created. Existing root work/church records remain unchanged until explicit backup/import. Source scope review and internal work completion do not represent client approval or delivery.

## Before release

1. Review SYSTEM_AUDIT.md, the exact PR commit, full CI, source permissions and data-migration behavior. This request authorizes development/testing, not a production switch.
2. Review the CLI-generated migration `20261025173059_focus_central_workspace.sql`. New records use UUIDs, timestamps, owner RLS, service-only writes, foreign keys and unique source mappings. It does not create a Supabase project, cron job, credentials or paid resource. No existing task data is deleted or bulk reclassified.
3. Verify a downloadable browser backup and a local backup copy before every local import. Backups whitelist only work/church/legacy records and markers; never export Supabase Auth storage. Confirm storage-quota failures stop before import.
4. Keep client documents/pricing and the actual Notion source bundle in private storage. Public CI uses synthetic fixtures. Codex prepared an actual V3 source bundle privately, verified it in an isolated PostgreSQL transaction and rolled it back; it has not imported that project into production.

## Authorized release order

After HANA approves the exact candidate:

1. Recheck deployment head and any PR16 overlap. Preserve both changes when resolving conflicts; do not blindly replace shared files.
2. Apply the additive migration to the existing hana-ai-office project, then run role/RLS/idempotency verification with a rolled-back transaction. Keep all monthly and Notion recurring schedules disabled.
3. Deploy existing hana-automation with focus/notion/inventory modules and all relative ESM dependencies; deploy existing hana-agent scope-route update. Preserve Auth validation on every request, NT$0, and closed external-write paths. New scoped tasks use free_tools; the legacy generic generator redirects to the central tool flow.
4. Publish through the existing Pages workflow with explicit exact-release authorization. Verify root/workspace and actual mobile behavior.
5. Perform the reviewed private V3 bootstrap/import once. Check original Page IDs, canonical history-wall match, scope classification, source status mapping and quote/version against the owner-approved sources. Ambiguous existing task matches enter conflict review instead of creating a duplicate.
6. Let HANA verify an authenticated run: import/duplicate skip → update local/cloud state → Notion conflict → keep/adopt decision → actual role tool result → review. No output is marked delivered to a customer.

## Website source setup still requiring authorization/verification

- Connected ChatGPT Notion is usable by Codex but does not automatically supply a website server token. Website recurring/manual API sync uses NOTION_TOKEN and HANA_NOTION_OWNER_ID in existing Supabase Edge secrets; reuse a compatible existing binding if present. Never paste keys in chat, tasks or GitHub. No live secret changes were made in this branch.
- Notion data-source ID and project prefix come from private reviewed project configuration. Adapter only POSTs to read-only data-source query endpoints, uses inclusive edited-time cursors and retries 429 at most3 times. Partial batches are idempotent and do not advance the success cursor; status receipts recover after a lost response. Unknown task states fail closed. No Notion writes, deletions or two-way sync.
- Sync interval may be saved between15 and1440 minutes, but saving always keeps enabled=false. A recurring runner is not activated or installed by this candidate; enabling it requires a separately reviewed operational setup after live authentication validation.
- Google website OAuth/owner binding still needs real authenticated verification. Reservation public inventory may be read without re-entering all course rules. Missing Google busy data never becomes an empty/free calendar. Extra buffers or new candidate opening policies are not inferred.
- Paid API stays OFF and budget NT$0. Three roles perform real deterministic task/source/spec analysis, not model reasoning or finished design production. Simulation is explicit and non-persistent. Design-generation tools are not connected to the website; no visual artifacts or historical facts are falsely reported as verified.

## Recovery

- Browser: use the exported checksum-verified backup. Restore first backs up the current local state; failed writes attempt rollback. Original data and the pre-upgrade snapshot are retained. Cloud records are not deleted by browser restore. If no backend was deployed, continue using the original local archive.
- Application: pause affected project automation, deploy the last approved static/Edge release and keep the added private data/tables. Preserve the scope claim guard for registered projects. An additive migration does not require dropping data to roll the application back.
- Sync: keep recurring sync disabled; investigate error_code/events and retry manually using the same receipt for uncertain outcomes. Version/local-edit conflicts require human resolution. A new active version clears the incremental cursor so source data can be reconciled against the new scope; history remains.
- Database: no automatic destructive down-migration. Export affected owner records and approval logs before a reviewed forward fix. Dropping tables, deleting source mappings or overwriting formal data requires separate authorization.

## Acceptance evidence

CI links and exact commit are maintained on the PR. Tests include Node domain/service/backup/API behavior, source failures/retries, isolated PostgreSQL double-apply/RLS/CAS/scope/Agent review and browser root/mobile regression. The actual 14-row Notion V3 source check is private and local, not a claim of website API sync or production import. Existing formal orders, payments, Google events and Notion pages were not modified.
