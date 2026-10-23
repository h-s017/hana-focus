# 文慶雞｜Brand Identity Manual V1.0 — Agent Handoff

**Reference version:** 2026-10-23 · A4 portrait · 28-page internal review draft.  
**Authoritative review record:** [Notion｜文慶雞手冊 V1.0 Agent 審閱基準](https://app.notion.com/p/4029b41981ae8161bda0eb5f9f3adc76?pvs=204).  
**Status:** `DRAFT / INTERNAL REVIEW` — not client approved, not print-ready, not a construction specification.

> This GitHub repository is public. Do not copy unreleased graphic files, private quotes, customer data, or full proprietary materials into this repository. The original PDF/DOCX files remain available in the ChatGPT conversation that produced them; they have not been verified as uploaded to an Agent-accessible file store.

## Read order

1. Fetch the Notion manual review record above.
2. Compare [14 unresolved conflicts](https://app.notion.com/p/3fc9b41981ae816c8804fe5c27e500d1?pvs=204) and the [main project center](https://app.notion.com/p/3fc9b41981ae8112bef6d0aa5b9616e3?pvs=204).
3. Use `agent_data/projects.json` to track `bkc-06`, `bkc-07`, and `bkc-08` with their human-review checkpoints.
4. Escalate every unresolved design or commercial conflict to HANA; don't silently select one version.

## 01 Project Manager

- Own version-control and review-task routing; ensure the Notion manual page is linked in reports.
- Preserve G1 brand strategy, G2 logo/colors/symbol, G3 signed commercial scope, G4 production samples, G5 formal delivery as **unapproved** until an explicit record confirms otherwise.
- Keep 'draft complete' separate from 'client approved' and 'production ready'.

## 02 Brand Strategist

- Verify exact slogan: **要嘛新加坡，要嘛文慶雞**.
- Preserve the inherited Chinese calligraphic logo and the heritage × Singapore Hainanese chicken rice identity.
- Confirm English public name (`BOON KENG CHICKEN` in prior references), history/timeline, and any B2B or performance claims with the owner.
- Return an approval-ready copy / evidence discrepancy list, not a market-research conclusion from assumptions.

## 03 Creative Producer

- Check the original logo vectors and whether BKC, round chopsticks mark, or square monogram is secondary; they are not all approved primary marks.
- Compare the two documented red versions; neither is a production authorization without G2.
- Verify horizontal front signage, side signage (including SINCE 2002), space material specimens, typography licensing, and packaging dielines.
- Honor same box for dine-in/takeaway; no ceramic bowl or box belly band. Packaging/uniform production work is subject to the signed scope.

## Execution / validation boundary

- Current executable GitHub capability: `agents/project_manager.py` produces a **rule-based** report from `agent_data/projects.json`; it does not fetch Notion or perform generative AI.
- `Brand Strategist` and `Creative Producer` are role specifications / handoff tasks, **not deployed autonomous services**.
- No automatic client communications, asset publication, approval, packaging procurement or physical production.
- Suggested validation: `python agents/project_manager.py --project wenqingji` and inspect `agent_output/wenqingji-review.md`; the output reflects the repository snapshot, not live Notion status.

## Source and update discipline

Record source, date, draft version, responsible role, approval checkpoint, and link to evidence before changing completion state. If later approved artifacts conflict with this draft, retain both versions and ask HANA which supersedes which.
