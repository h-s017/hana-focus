# Workspace customer reservation details — read-only

HANA requested that existing customer reservation details be integrated in WORKSPACE. This does not authorize actual cancellation, rescheduling, payment/refund or outbound messages. API budget remains NT$0.

## Implementation

The common office-app mounts a customer-detail panel after login on WORKSPACE and AI OFFICE. Data is fetched only on the user's query click, supports existing before/beforeId pagination (200/page), current-page search and expandable customer/course/payment details. DOM is built with textContent. No customer response is written to localStorage, offline storage or the URL, and logout clears records; stale requests after account changes cannot render.

The Edge server validates Auth with trusted hana_office_access and separately requires trusted app_metadata.hana_reservation_read_access. A forged flag in request JSON or user_metadata has no effect. Only the existing HANA owner receives the new privilege through an authenticated administrative update; no public signup or general office user is granted customer access.

The connector has exactly one upstream path: POST https://hana-course-production.hana-reservation-payment.workers.dev/api/admin/orders. This existing route performs SELECT only and is paginated by creation time/id. Body contains only validated pagination values. Request origin is fixed to the worker, redirects are rejected, responses capped at 2 MB, and error bodies are never forwarded. The upstream ADMIN_TOKEN has broader authority; the adapter deliberately exposes no generic route/method or write operation. No admin credential is sent to frontend.

Response fields are an allowlist: order id, course/variant, name/phone/email/LINE/note, sessions, payment/cancellation state, quantity, amount/unit and relevant timestamps. Bank/payment account numbers and unrelated upstream fields are not returned. Internal audit stores count only, not customer names, contact data or order payloads. Existing customer records are not copied into Supabase.

When the link is safely configured and the caller has this privilege, order-change drafts can validate the original order. A minimal snapshot of id/status/quantity/amount/sessions/cancellation state excludes contacts. Approval re-fetches that snapshot and rejects changed source data. Approval remains internal only; external_writes=false. With no connection/privilege, existing order drafts stay unverified and cannot be approved. Lookup scans at most ten source pages; reaching the limit is incomplete, not falsely 'not found'.

## Safe setup required

In Supabase Dashboard → Edge Functions → Secrets, set RESERVATION_ADMIN_TOKEN to the existing reservation backend's ADMIN_TOKEN through a secure owner workflow. Never put it in chat, GitHub, a task brief, frontend input, query parameters or localStorage. The currently connected tools cannot read/copy or set this secret. If the original credential is unavailable, recover/rotate through the original backend's secure administration; do not invent a key or assume a new value will work.

Grant app_metadata.hana_reservation_read_access only to the already confirmed HANA owner, preserving other app_metadata. Do not grant via user_metadata. This permission alone does not create the upstream secret. Available tools cannot independently inspect Edge secret values/presence, so configuration must be tested by the authenticated owner from the deployed panel. A configuration error is not an empty order list.

## Release verification

Node tests cover authorization, unsafe cursors, pagination, field redaction, no source writes, private-error handling, bounded lookup and fresh order review. Mock browser tests cover query, displayed fields, no local persistence, unavailable connection clearing data, responsive layout and logout cleanup. Deno/PG17/regression jobs remain required. Mock records are synthetic and do not establish live customer access.

After tests pass, merge reviewed branch, deploy the Edge dependency files, and publish the frontend through the existing manually approved Pages workflow. The GitHub connector has no workflow_dispatch tool. Verify official 200 responses and authenticated live read after the owner safely configures the credential. Existing free PM scheduler and original reservation site remain unchanged.
