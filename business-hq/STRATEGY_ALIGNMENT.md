# Business HQ — strategy-driven operations contract (v2 proposal)

Status: draft implementation and acceptance contract. The same HANA FOCUS, Business HQ database and Social Editor remain the integration points. Production activation is gated.

## Draft implementation

- Private strategy: the authenticated work route saves owner-approved, append-only revisions. Replaying the same revision is safe and conflicting writes require reload. The public project has no strategy seed. An approved profile supplies its own business lines, operating limits, planning horizon and public-safe research fields.
- Financial reporting: verified owner records track contracted, invoiced, received and recognized stages independently, in ISO minor units. Each line keeps the same business, payer market, channel and currency across stages. Partner sales remain included in their payer market. Rollups display the scope of known entries, with unknown costs and unsupported metrics left blank. Corporate Strategy and Financial Management reports return the skill version/hash and tool receipt.
- Sales scheduler: derives priority from an effective private revision, opportunity history and available recorded margin. A run records all configured sales lanes, including lanes blocked by a missing authorized data source. External discovery and analysis receive only the explicitly approved public query and offer. Strategy assumptions, financial records, and targets stay in the project.
- Data and approvals: owner-confirmed finance records can be imported through the existing HANA FOCUS login. No accounting, enrollment, procurement, manufacturing or MY ORGAN connector is assumed active. Production migration, worker and provider changes remain separate gated steps.
- Integration verification uses synthesized finance values and a separate isolated database with real authentication and RPC storage. The private business setting is provisioned separately.

## 1. Private strategy profile
Persist one owner-scoped, versioned strategy profile in the existing authenticated work workspace. Never store the actual owner financial targets, starting capital, product strategy, customer details or credentials in public GitHub, browser bundles, logs or public latest.json. Profile values are supplied privately by the owner; schema below is illustrative and has no business-specific defaults.

Fields: strategy_id, owner_id, revision, effective_from, currency, core_product, core_unit, initial_capital_minor, horizon_years, annual_targets[{year,core_product_net_revenue_minor,company_net_revenue_minor(optional),milestone}], founder_independence_target_year, standardizable_work_automation_target_pct, target_market_mix_pct{B2B,B2G,B2C}, channel_modes[direct,partner], priority_customer_segments, supporting_businesses, price_scenarios[{unit_price_minor,unit,assumption}], approved_at. Targets are challenge assumptions, not forecasts; update by explicit owner approval. If missing/unapproved, report strategy_profile_missing and do not fabricate target values. Keep budget, margins and working capital constraints distinct from revenue. Do not require owner to type daily search criteria.

## 2. Taxonomy and CRM
Market dimension: payer/contracting customer type B2B, B2G, B2C. Channel dimension: direct vs partner (B2B2C when applicable). Distinguish end customer and payer. B2B2C is a channel, not a fourth additive revenue bucket. Every invoice/order line has one market and one channel. Track core_product vs supporting business by product line, and contract/order/receipt dates separately. Revenue excludes tax, reversals, double count and amounts collected on behalf of others where not revenue; apply approved accounting policy. Keep signed, invoiced, received and recognized amounts distinct. Never count CRM estimated deal value as realized sales.

B2B discovery: prioritize recurring buyers/manufacturers, qualifying need, product application, sampling, expected purchase volume (only evidence or labeled assumption), delivery capability, pricing and repeat-order likelihood. B2G: procurement and cultural projects, publicly verified eligibility/deadline, cash exposure and fulfillment. B2C: courses, experience, own IP and digital products as validated supporting cashflow and education, privacy-safe aggregate demand insights. Partner channel: partner buyer/end customer, licensing/training or distribution, margin/revenue-share, replenishment and service independence. Retain manual search only as override.

Extend existing CRM with market, channel, end_customer_type, core_product_fit, application_category, demand_evidence, quantity_estimate/unit/confidence, sampling_stage, reorder_signal, payment_terms, contribution_margin_estimate, working_capital_exposure, strategic_fit, next_action, source_timestamp. Existing rows remain unknown until verified; no guessed backfills. Dedupe prospect + application/initiative, and tender by official notice ID; use owner-scoped keys. Preserve current CRM stages; add linked sampling/qualification milestones without breaking history.

## 3. Priority decisions
Daily scheduler (Asia/Taipei) reads approved profile, open pipeline and recent runs; derives search criteria and produces actionable prioritized results with real sources, not manual inputs. Priority order: urgent safety/compliance/cash/contract deadlines; core repeat-order opportunities; sampling conversion and confirmed supply readiness; supporting work with measured cashflow/lead/technology value; speculative projects last. Suggested weighted scoring on 0–100: core product fit 30, repeat purchase evidence 25, verified buyer/application 15, feasibility 15, margin/cash exposure 15. Unknown evidence is unknown, not positive score. Missing sources -> unverified; unavailable tools -> blocked; no suitable results -> no_new_opportunity. Do not silently relax approval gates or misstate likelihood as demand. Reject negative contribution or unverified manufacturing capability from automated recommendation until reviewed. Preserve already committed obligations.

## 4. Existing seven skills, new execution contract
- corporate-strategy: compare actual/target by year and product, scenario analysis, prioritize bottleneck and cash constraints.
- sales-marketing: autonomous prospect discovery, public source verification, customer-specific offer, sampling-to-repeat funnel, next actions and CRM persistence. Use authorized discovery and real analysis, not keyword-only proposals presented as AI.
- operations-management: supplier qualification, MOQ, lead time, written terms, batch traceability, QC, delivery and backup supplier. No purchase or product release without approval; technical documents verified by competent human.
- research-development: manage internal product catalogue, formula identifiers/version, application testing and documentation readiness. No proprietary formula content in public repositories; do not claim safety or compliance absent evidence. Link MY ORGAN through authorized integration; do not overwrite formulas.
- financial-management: calculate unit economics, contribution margin, working capital, receivables, rolling cash forecast, signed vs recognized revenue. Source verified cost/price data; unknown -> pending. Never authorize spending.
- people-management: delegation/partner qualification, training and SOP ownership, quality signoff and escalation.
- business-systemization: owner-scoped automation, task run logs, failure recovery, approval gates, time-saved metrics and standardizable task coverage. Automation rate = completed verified automated standardizable work / total eligible standardizable work, with stated measurement method; do not count scripts/prompts as automated outcomes.

Existing three Social Editor role workflows remain intact. Preserve daily sensory editorial, founder story and every-three-days service article requirements; do not transform editorial lessons into daily advertising. Add strategy alignment metadata and track genuine inquiries/qualified leads, without false attribution.

## 5. Review queue and measures
HANA FOCUS remains single review entry. Reuse task/run/review records and existing source of truth. Daily report: actual researched prospects and evidence, recommended sampling/reorder followups, cash/supply exceptions, top three human decisions, blockers. Weekly: verified pipeline, sampling conversion, repeat customers, core product revenue, volume, actual unit price/margin, outstanding receivables, coverage and time saved. Monthly: annual target progress, product/market/channel breakdown, rolling cash, founder dependence and gap remediation. Avoid target pressure that fabricates records. Display missing data as unknown. No auto external messaging, quotation, purchases, procurement submissions, publication or commitments.

## 6. Implementation order / acceptance
P0: private profile, classification, scheduler and autonomous source-backed discovery, CRM and sample/repeat tracking. P0.2: MY ORGAN/quote integration, cost per unit, cash forecast. P1: supplier and catalogue readiness, reorders and delegation. P2: refine existing content/partner conversion based on real metrics. Do not build all empty pages first.

Tests:
1. Unauthenticated/church workspace cannot read or mutate owner strategy or opportunities. Public assets never contain real private profile.
2. Missing strategy, source, budget or tool yields explicit blocked/unknown as appropriate. No manual search input needed on a scheduled run; actual public-source discovery and persistence evidenced, no duplicate retries.
3. Repeat buyer ranks above unrelated one-off with otherwise comparable evidence; no fabricated fit or buyer intent. Source and strategy revision recorded.
4. B2B, B2G, B2C revenue classified exactly once; partner channel is an overlapping filter, not additional market revenue. Supporting revenue excluded from core product target. Amount/volume calculations reconcile.
5. Real quote inputs flow from authorized formula/cost records; approvals preserved. Test negative margin, absent costs, insufficient cash, and uncertain writes.
6. Daily/weekly summaries use real persisted records; no invented success, cash, sales, automation coverage or compliance.
7. Existing Social Editor and HANA FOCUS mobile, calendar, booking and church workspace regressions pass; no unrelated changes.
8. End-to-end test with real isolated source and database; distinguish dev from production. Report actual versions, commit, run IDs and remaining blockers; do not merge/deploy, incur costs or modify production without approval.

Codex: integrate this contract into existing seven skill resources, generated resource registry and executed paths using version/hash. Preserve prior verified work and active PRs. This file alone does not implement runtime behavior.
