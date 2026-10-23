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
## Current limitations
- Rule-based automation only; no LLM decision loop. A scheduled, read-only Google Calendar synchronizer is committed in the corresponding Reservation PR, but NOT live or authorized until D1 migration, Cloudflare deployment, dedicated Calendar sharing and credentials are verified.
- The HANA form does not yet write a duplicate event to Google Calendar. To block a time, enter it in HANA WORKSPACE (manual) OR on the separately authorized busy calendar (periodic sync); these are separate trusted inputs to the same Worker/D1 availability logic.
- Only a specifically shared, dedicated busy calendar is eligible for Google sync. The Worker expands recurring event instances and ignores transparent events. Do not ingest all personal calendar items by default: public course events can represent seats sold to multiple students, not personal unavailability.
- The HANA WORKSPACE page uses the existing Worker administrator token held in RAM for this tab; a shared SSO session is future work.
- No secrets or customer PII belong in this public GitHub repository.
## Validation
Reservation backend Draft PR #9 (including migrations 0009 + 0010) must be reviewed, tested and deployed before this UI's actions will function. Workspace Draft PR #8 alone does not activate cross-system sync. After Cloudflare setup, verify synchronizer status, no-collision slot reopening, and already-paid booking alerts. Do not call it automatic Calendar integration until a real dedicated calendar successfully syncs.
