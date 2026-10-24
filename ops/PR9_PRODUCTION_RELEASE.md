# PR #9 production release record

HANA approved this release in the task conversation on 2026-10-24 (Asia/Taipei). Scope: database additions, existing hana-agent deployment, WORKSPACE Pages. Paid AI, Calendar writes and automatic external notifications remain disabled. SMTP login success is user-reported, not a newly repeated mail test.

## Verified completed

- Applied Supabase migration `20261024140724_hana_office_atomic_review_runs` to the existing `ihmvziqisputjnjkuhvm` project. No new Supabase project was created.
- Existing two queued tasks retained. Run table RLS enabled; authenticated role cannot execute claim RPC; service_role can; no SECURITY DEFINER functions added.
- Granted trusted app_metadata access to exactly one confirmed account explicitly designated by HANA. No email, user ID, access token or secret is written in this public report.
- Production SQL RPC smoke test completed in a BEGIN/ROLLBACK transaction: claim exclusion, draft-to-review, rejection/requeue, stale recovery and stale-writer rejection. Follow-up read: original tasks=2, persisted fixture tasks=0, reviews=0, runs=0.
- Paid AI is explicitly disabled at the Edge entrypoint regardless of any existing server key. PM falls back to labeled rule-based drafts.
- Release preparation commit: `9de4694ff7d43d1d72bc13add4ba8f8f7f81aff5`.
- [Integration tests](https://github.com/h-s017/hana-focus/actions/runs/40100865313) and [PWA tests](https://github.com/h-s017/hana-focus/actions/runs/40100865447) succeeded.

## Actual publication blocker

[Readiness run](https://github.com/h-s017/hana-focus/actions/runs/40100861829), job 120892539380, read the actual GitHub Pages setting:

```json
{"build_type":"legacy","source":{"branch":"hana-focus-preview","path":"/"},"html_url":"https://h-s017.github.io/hana-focus/"}
```

Its failure is a deliberate safety check, not a failing application test. Updating this setting requires Pages + Administration write permission, which the current connector and Actions token do not have. Owner action: Settings > Pages > Build and deployment > Source > GitHub Actions. This does not require renewed release consent; HANA already approved deployment.

Until verified, PR #9 stays unmerged and the existing Edge version is retained to avoid breaking the current frontend during a partial rollout. No environment protection is removed or bypassed.

## Remaining execution after Source is switched

1. Rerun the read-only readiness check and verify Actions Source.
2. Deploy the reviewed function with paid AI disabled and JWT + server-side user validation retained; verify version/source readback.
3. Mark PR #9 ready and merge at the exact tested head SHA. The approved marker triggers only this PR's merge publication; unrelated future pushes do not publish.
4. Verify Pages workflow success, public WORKSPACE/AI OFFICE content, and rejection of anonymous function calls. No DNS changes, customer messages or Calendar writes.
5. Record final run URLs, commit and any remaining authenticated-user test limitation.
