---
name: model-gateway-config
description: >-
  Declares the repository's model routes for the OpenAI-compatible gateway — which pinned model serves
  each data class, external or self-hosted, with budgets — and validates that restricted data is
  blocked, confidential data never reaches an external route and no route uses a floating model alias.
  Use whenever a model is added, replaced or moved between routes, or a data class needs a new route.
  Not for classifying content (data-classification), budgets at run time (cost-budget-guard), or
  evaluation of the model (llm-eval-gating).
allowed-tools: Read Grep Glob Edit(gateway/routes.json) Bash(node scripts/check-gateway.mjs:*)
---

# Model gateway configuration

The route follows the data class, and the model behind it never floats.

## Non-negotiables
- `restricted` is always `BLOCK`; `confidential` routes are `external: false`.
- Model ids are pinned; aliases such as `latest` are refused.
- A route change needs a passing `llm-eval-gating` run.

## Inputs and outputs
- **In:** the route request
- **Out:** a `gateway/routes.json` diff

## Procedure
1. Edit the route for the class.
2. `node scripts/check-gateway.mjs`.
3. Run `llm-eval-gating` with the new route before merge.

## Verify
- `check-gateway` exits 0
- the eval gate prints GO

## Evidence
Add to the evidence block: route diff, gate result. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Routes match the data-class policy and the change passed evaluation.
