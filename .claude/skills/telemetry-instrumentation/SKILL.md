---
name: telemetry-instrumentation
description: >-
  Configures OpenTelemetry for the agent, the knowledge layer and CI — invoke_agent, chat and
  execute_tool spans with the GenAI semantic-convention attributes plus the pack's skill name, skill
  hash, data class and budget, exported over OTLP to any backend — with message content never
  captured. Use whenever telemetry is set up or changed, spans are missing, or someone asks how agent
  activity is observed, or someone asks to set up OpenTelemetry or how to observe agent activity. Not
  for budgets (cost-budget-guard), the local AI Ops dashboard (llm-eval-gating), or model routes
  (model-gateway-config).
allowed-tools: Read Grep Glob Edit(telemetry/**) Bash(node scripts/check-telemetry-contract.mjs:*)
---

# Telemetry instrumentation

Trace decisions, not content.

## Non-negotiables
- `telemetry.captureContent` stays `false`; prompts, completions and retrieved text are never exported.
- GenAI conventions are still in development: pin the attribute set in `telemetry/span-contract.json` and contract-test it.

## Inputs and outputs
- **In:** `telemetry.otlpEndpoint`
- **Out:** exporter configuration and a passing contract test

## Procedure
1. Set `telemetry.otlpEndpoint` through `config-proposal`.
2. Managed settings set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` and the exporter endpoint for the agent host.
3. The knowledge layer exports its events as spans through `rag/telemetry/otlp.mjs`.
4. `node scripts/check-telemetry-contract.mjs`.

## Verify
- the contract check exits 0

## Evidence
Add to the evidence block: trace id of a sample span. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Agent, knowledge and CI spans reach the backend with no content.
