# PR #9 production deployment — completed

HANA approved production deployment in the task conversation on 2026-10-24 (Asia/Taipei). This record contains no account email, user ID, access token or secret.

## Deployed versions and URLs

- [PR #9](https://github.com/h-s017/hana-focus/pull/9) merged with HANA approval.
- [Production code commit e96b482](https://github.com/h-s017/hana-focus/commit/e96b4821007ae1db780cf27fedaa02c0aad377d0).
- [HANA WORKSPACE](https://h-s017.github.io/hana-focus/workspace.html).
- [HANA AI OFFICE](https://h-s017.github.io/hana-focus/ai-office.html).
- Existing [HANA FOCUS local work board](https://h-s017.github.io/hana-focus/) retained. WORK / CHURCH localStorage keys were not changed or cleared.

## Actual release evidence

- Pages Source readback: build_type=workflow. [Readiness run 40100861829, attempt 2](https://github.com/h-s017/hana-focus/actions/runs/40100861829/attempts/2) succeeded after the owner switched Source to GitHub Actions. The earlier attempt deliberately failed on legacy branch publication; it was not bypassed.
- [Production Pages run 40102029500](https://github.com/h-s017/hana-focus/actions/runs/40102029500): completed / success at code SHA e96b4821007ae1db780cf27fedaa02c0aad377d0.
- Job 120895982326 verified the one-time approval marker and exact PR #9 merge SHA, staged public-site, deployed Pages, then fetched workspace.html / ai-office.html / js/office-app.mjs with HTTP 200 and expected new content.
- The same deployment job sent an unauthenticated POST to hana-agent; it was rejected with HTTP 401. This proves anonymous access is blocked, not that an authenticated task run was tested through the live browser.
- [Latest pre-merge integration tests](https://github.com/h-s017/hana-focus/actions/runs/40101454201) succeeded: 34 Node tests, mocked browser interactions, isolated PostgreSQL transaction/RLS tests, and Edge type check. [PWA validation](https://github.com/h-s017/hana-focus/actions/runs/40101454216) also succeeded. Browser tests with fixture APIs are not live SMTP or live model tests.

## Supabase production result

- Existing project ihmvziqisputjnjkuhvm retained; no new project created.
- Applied migration 20261024140724_hana_office_atomic_review_runs. Its exported SQL is tracked at supabase/migrations/20261024140724_hana_office_atomic_review_runs.sql.
- Existing two queued tasks preserved. New execution table has owner RLS. authenticated cannot execute claim RPC; service_role can. No SECURITY DEFINER functions added.
- Exactly one confirmed account explicitly designated by HANA received trusted app_metadata.hana_office_access. The account identity is intentionally omitted from public records.
- Production SQL RPC smoke test ran inside BEGIN/ROLLBACK: claim exclusion, draft-to-review, rejection/requeue, stale recovery, and stale-writer rejection succeeded. Follow-up: original tasks=2, persisted fixture tasks=0, reviews=0, runs=0. No real customer work was approved or deleted.
- hana-agent deployed as ACTIVE version 3, with verify_jwt=true. Source readback confirmed the entrypoint contains ready:()=>false. Paid AI stays disabled even if a server key exists; Project Manager uses explicitly labeled rules drafts. Strategy / Creative tasks may be prepared but paid generation is not enabled.
- Existing advisor warning remains: [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No plan upgrade or password-mode change was made; the currently validated login method is Magic Link.

## Deliberately not enabled

- Paid OpenAI calls or account purchases.
- Google Calendar writes, reservation inventory changes, customer notifications or external automatic sends.
- Business approval of BKC color, Symbol, B/C packaging scope, or FINAL deliverables.

SMTP and callback success before this release was reported by HANA. No repeated email was sent by this deployment. DNS / SMTP credentials were not modified by release automation.

## Remaining authenticated-user acceptance

Open WORKSPACE, sign in if needed, create a Project Manager test task, generate a rules draft, and verify that the result enters review. HANA must explicitly approve/reject the draft. Server JWT validation, live mailbox receipt and live browser task action cannot be impersonated by the current tools; do not describe the anonymous HTTP test or SQL transaction fixture as an authenticated browser run.

## Release control and rollback

The one-time push publication only accepts PR #9's exact merge commit. Normal future pushes do not automatically deploy. Manual later deployments still require explicit HANA authorization and preserve the github-pages environment protection.

If a runtime problem is found, stop the affected generation/hand-off action and deploy a reviewed fix or revert. Retain task/run/review records; do not drop tables or delete data. Never reactivate a paid provider or Calendar/customer notifications as part of rollback. The authorization and tested source commits remain traceable in PR #9.
