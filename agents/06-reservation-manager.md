# Reservation Manager｜HANA WORKSPACE Agent contract
**Status:** Prototype on feature branch; not production-deployed.
**Core role:** 04 in the HANA AI OFFICE business-operations group. Repository filename uses 06 to avoid colliding with the pre-existing Social Editor (agents/04-social-editor.md).
## Single operator entry
HANA WORKSPACE > Reservation Manager. Operators should not need to visit another admin website. The existing reservation site remains for customers, and the Cloudflare D1 database is the single source of truth for payment orders and public course availability.
## Trigger and outcomes
1. Operator creates or edits an appointment in HANA WORKSPACE.
2. The existing reservation Worker checks its times against published session intervals, keeping all existing closed dates and manually closed sessions unchanged.
3. Overlapping sessions become unavailable immediately **only after the Worker/API/D1 migration has been deployed**. Database triggers prevent booking, seat reactivation, and new checkout into conflicts.
4. Existing orders are never cancelled or refunded by an automatic block. Return order IDs, dates and statuses for manual review.
5. Removing an appointment removes only its own overlay; overlapping blocks, sold-out inventory, and unrelated closures persist.
6. Every write is authenticated and leaves an admin audit entry in the Worker database.
## Google Calendar rules (owner selected Option A)
- Use the **existing main Google Calendar**. A second calendar is not required. HANA WORKSPACE remains the normal way to enter appointments.
- Proposed periodic read-only sync classifies original calendar events into BLOCK (confirmed timed busy events; explicit unavailable/all-day rest), REVIEW (all-day general events, existing multi-student HANA classes and unanswered/tentative invitations) and IGNORE (cancelled, Google free/transparent, declined, explicit keep-open).
- Google events that look like existing public teaching sessions must not automatically close their own class. Show these under **預覽自動判斷**, so the operator can review uncertain dates.
- Administrator-only calendar-preview never modifies reservations. Manager-created busy intervals remain separate from Google-derived blocks and continue to take effect independently.
- Google authorization to ChatGPT Calendar does **not** grant a Cloudflare Worker permission to read it. A separate read-only service-account share (with the true owner's calendar ID, never the service account's `primary`) or scoped OAuth setup is still needed.
## Current limitations
- Rule-based automation only; no LLM agent. Main-Calendar event classification and periodic Google sync are committed in Reservation PR #9, **not** deployed or authorized on production.
- The HANA form does not yet create or edit an event in Google Calendar. Entries made in HANA WORKSPACE block website slots through the Worker after deployment; Google syncing is an independent optional input.
- The HANA WORKSPACE page still uses the existing Worker administrator token held in RAM in this tab. Unified SSO is future work.
- No credentials or customer PII belong in public GitHub.
## Validation
Reservation backend Draft PR #9 and Workspace Draft PR #8 must be reviewed, staging-tested, migrated and deployed together. Preview, paid-seat protection, Google read permissions and public course preservation require end-to-end verification. Production remains unchanged until a separately authorized deployment.
