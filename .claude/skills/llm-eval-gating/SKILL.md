---
name: llm-eval-gating
description: >-
  Gates changes to skills, prompts, the knowledge layer and generated tests on fixed thresholds —
  retrieval benchmark, AI test-quality KPIs (hallucinated fixtures, members and imports), DeepEval and
  RAGAS through the pinned judge model on the gateway at temperature zero — and produces one GO or
  NO-GO with the AI Ops dashboard. Use whenever skills, prompts, retrieval or generation change, a
  release is prepared, or someone asks whether AI quality regressed. Not for routing accuracy alone
  (skill-routing-eval), budgets (cost-budget-guard), or telemetry (telemetry-instrumentation).
allowed-tools: Read Grep Glob Bash(node rag/cli.mjs bench:*) Bash(node rag/cli.mjs kpi:*) Bash(python3 evals/deepeval/run_evals.py:*) Bash(python3 evals/ragas/run_ragas.py:*) Bash(node scripts/ai-release-gate.mjs:*) Bash(node scripts/ai-ops-dashboard.mjs:*)
---

# LLM evaluation gating

Gate on thresholds with a pinned judge, never on a feeling or a delta.

## Non-negotiables
- The judge model is pinned in `ai.judgeModel` and reached only through the gateway; temperature 0.
- Never lower a threshold in the same change that needs it.
- Goldens hold no secrets or production data.

## Inputs and outputs
- **In:** goldens in `evals/goldens/`; `aiGates` thresholds
- **Out:** `evals/results/*.json` and a GO or NO-GO

## Procedure
1. `node rag/cli.mjs bench --write` and `node rag/cli.mjs kpi --write` (no model needed).
2. `python3 evals/deepeval/run_evals.py` and `python3 evals/ragas/run_ragas.py` (judge through the gateway).
3. `node scripts/ai-release-gate.mjs` for the decision.
4. `node scripts/ai-ops-dashboard.mjs` for the trend view.

## Verify
- the gate prints GO

## Evidence
Add to the evidence block: gate decision with each check, value and threshold. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- AI changes ship only with a GO.
