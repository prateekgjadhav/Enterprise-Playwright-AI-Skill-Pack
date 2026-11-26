---
name: cost-budget-guard
description: >-
  Enforces token and cost budgets per session, skill and day from qa.config.json against the AI Ops
  log and the gateway's budget headers, warns at 80 percent and stops at 100 percent without silently
  switching to a cheaper model. Use whenever a session starts, the gateway returns 429, spend looks
  unusual, or someone asks how much the agent is costing. Not for changing routes
  (model-gateway-config), telemetry setup (telemetry-instrumentation), or eval gates
  (llm-eval-gating).
allowed-tools: Read Grep Glob Bash(node scripts/budget-status.mjs:*)
---

# Cost budget guard

A budget is a stop, not a suggestion.

## Non-negotiables
- Never raise a budget inside a session; a temporary increase needs an approval attestation.
- Never downgrade the model silently to stay under budget.

## Inputs and outputs
- **In:** `ai.budgets`; `.claude/telemetry/ai-ops.jsonl`
- **Out:** budget status

## Procedure
1. `node scripts/budget-status.mjs`.
2. At 80 percent warn the user; at 100 percent stop and report.
3. Find runaway loops by skill in the status output.

## Verify
- exit 0 under budget, 1 over budget

## Evidence
Add to the evidence block: tokens and cost used, remaining. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- No session exceeded its budget.
