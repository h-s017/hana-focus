# HANA AI Studio｜3-Agent Workflow

## Human and agent roles
HANA (Founder & Creative Director) is the final approver. Agent 01 coordinates; Agent 02 plans strategy; Agent 03 produces creative deliverables. The three agents are role specifications executed through Codex tasks or a future orchestrator; **no autonomous multi-agent runner is deployed yet**.

## State machine
`backlog -> in_progress -> review_requested -> approved -> delivered`; exceptional state `blocked`. Never infer approval from a completed draft.

## Gates
- G1 Strategy: positioning and verified sources
- G2 Identity: logo, symbol, colors, visual direction
- G3 Commercial: quotation scope and price
- G4 Production: measurements, samples, material and supplier validation
- G5 Delivery: final files, approvals, payment conditions

## Handoff protocol
Each handoff JSON includes `project_id`, `task_id`, `from_agent`, `to_agent`, `input_links`, `deliverables`, `acceptance_criteria`, `approval_gate`, `status`, and `evidence_links`. Agent 01 checks that a gate is approved before authorizing downstream FINAL work.

## Shared data and source-of-truth
- Notion: tasks and status. Google Docs: strategy content. GitHub: agent rules, versioned artifacts, handoff manifests.
- Files in this repository are snapshots/working artifacts, not a live Notion/Drive synchronization.
- Never place customer PII, passwords, API keys, or confidential assets in this public repository.
- If integrations lack authorization, record `blocked` and request access; do not simulate success.

## Manual Codex execution
1. Open the project manifest and latest Notion task state.
2. Run Agent 01 triage; assign Agent 02 research or Agent 03 design as appropriate.
3. Commit work product and handoff manifest in a PR.
4. HANA reviews, resolves pending gates, and approves merge or changes.
5. Agent 01 records status back to Notion when available and authorized.

## Future deployment (not yet done)
Implement a scheduler/worker, Notion/Drive authenticated APIs, approval webhook/UI, audit persistence, retry/idempotency, and end-to-end integration tests. Until then, execution is initiated manually.
