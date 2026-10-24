# Project materials: OneDrive folder links

Release candidate; not deployed. Existing WORKSPACE, tasks, visual library and files remain intact.

## Behavior

Logged-in users can save one OneDrive folder link per project, edit the link and open it in a new tab. The owner/project pair is unique, so retrying a save updates the same record. The link registry is stored in Supabase; it is not localStorage and is not committed to GitHub. Microsoft personal OneDrive and tenant SharePoint URLs are accepted; other schemes, credentials and deceptive hosts are rejected. URL validation does not prove the destination is a folder or that the user has Microsoft access.

No file upload, OAuth/Graph integration, content scanning, AI ingestion, file deletion or sharing-permission change is included. Microsoft permissions still determine who can open the folder. Do not make customer folders public for this feature.

## Privacy and access

The additive `hana_project_materials` table has RLS and grants select/insert/update only to authenticated owners with trusted `app_metadata.hana_office_access=true`. Both UPDATE USING and WITH CHECK enforce ownership; user_metadata cannot authorize access. No authenticated delete permission is granted. No secrets or file contents are stored. Users authorized only through server-side HANA_OWNER_IDS need the existing trusted app_metadata grant for this direct Data API feature.

The frontend uses textContent for project names and validates URLs again when rendering. Links open with noopener/noreferrer and no-referrer. Logout disposes the panel; late responses from a former session are ignored. Materials loading errors leave the task panel usable. The old Visual Library remains unchanged.

## Review and release

1. Review PR and passing Actions evidence: Node validation, mocked browser interactions at 320/390/820 widths, and ephemeral PostgreSQL RLS/upsert assertions. No real Microsoft credentials are used by tests.
2. HANA approval is required before merge/publication. Apply `supabase/schema/hana-project-materials.sql` once as an additive migration before publishing the frontend. It has not been applied to production by this PR.
3. Publish the reviewed SHA with the existing manually authorized Pages workflow and environment review. No deployment workflow or one-time PR9 approval is changed here.
4. Verify with the authorized real account: save a restricted OneDrive folder link, refresh, sign in on another device, open the link, edit it, and logout. Confirm Microsoft authorization separately; do not claim this real-account test from mocked CI results.

Before release, use OneDrive directly for storage. A real folder link and approved release are still needed for the first project setup.
