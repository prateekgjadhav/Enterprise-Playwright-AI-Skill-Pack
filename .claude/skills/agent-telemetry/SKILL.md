---
name: agent-telemetry
description: >-
  Observability for the pack's own agent runs (not the system under test): emit OpenTelemetry spans
  for each orchestration step, skill and tool call, trace the agent's LLM calls (model, latency,
  tokens, cost, routing decision, outcome) in a Langfuse-style view, record verify/gate results and
  evidence links, and expose Prometheus metrics for run duration, pass rate, cost and gate blocks.
  Use whenever the user asks to observe, trace, debug, measure or audit the agent itself — why a
  skill was chosen, how long a run took, token/cost tracking, LLM-call tracing, or a dashboard of
  agent behaviour. Not for observing the application under test (observability-monitoring), test
  result reporting (reporting-analytics), or test-flakiness (regression-optimization). Telemetry
  records process and decisions with redaction; it never stores secrets, credentials or target data.
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Agent telemetry

See what the agent did and why. This skill instruments the orchestrator and skills so every run
produces traces, metrics and LLM-call records you can inspect.

## Non-negotiables
- **Observe the agent, not the target.** Spans and metrics describe the agent's own process and decisions. Target data, findings detail and payloads are out of scope here (that is `observability-monitoring` / `reporting-analytics`).
- **Never record secrets, credentials, tokens or PII**, and redact any prompt/response field that could contain them before export. Prefer recording decision metadata (which skill, which tool, status, latency, tokens) over raw content.
- Telemetry backends are the team's own (self-hosted OTLP collector, Prometheus, a Langfuse-style LLM dashboard); set sampling and a retention policy; telemetry is opt-in via `qa.config.json`.
- Telemetry is read-only observation; it never changes agent behaviour or bypasses a gate.

## What to emit
| Signal | Captures |
|---|---|
| Run span | request id, start/end, overall status, skills used |
| Step/skill spans | each orchestration step and skill invocation, nested under the run |
| Tool-call spans | tool name, arguments shape (redacted), exit status, duration |
| LLM-call trace | model, prompt/response **token counts and cost**, latency, the routing decision (skill chosen) and outcome — content redacted or omitted |
| Gate events | `npm run verify` result, approval-gate decisions, stop-gate blocks |
| Evidence link | pointer to the run's evidence block / artifacts (not the artifacts' sensitive contents) |
| Metrics (Prometheus) | run count & duration histogram, pass rate, tokens & cost, gate-block count, retry/flaky count |

## Templates
```typescript
// @skill-example: fragment — src/telemetry/agent-tracing.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
const tracer = trace.getTracer('skill-pack-agent');

export async function withSkillSpan<T>(skill: string, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(`skill:${skill}`, async (span) => {
    try { const out = await fn(); span.setStatus({ code: SpanStatusCode.OK }); return out; }
    catch (e) { span.setStatus({ code: SpanStatusCode.ERROR }); throw e; }
    finally { span.end(); }
  });
}

// LLM call: record METADATA only; never the raw prompt/response if it may hold secrets or target data.
export function recordLlmCall(span, m: { model: string; promptTokens: number; completionTokens: number; costUsd: number; skillChosen: string; }) {
  span.setAttributes({
    'llm.model': m.model, 'llm.tokens.prompt': m.promptTokens, 'llm.tokens.completion': m.completionTokens,
    'llm.cost_usd': m.costUsd, 'agent.routing.skill_chosen': m.skillChosen,   // decision, not content
  });
}
```
```jsonc
// @skill-example: fragment — .agents/qa.config.json (add)
"telemetry": {
  "enabled": false,                       // opt-in
  "otlpEndpoint": null,                   // e.g. http://localhost:4318 (self-hosted collector)
  "llmDashboard": null,                   // e.g. a self-hosted Langfuse base URL
  "sampleRate": 1.0,
  "redactFields": ["prompt", "response", "headers.authorization"],
  "retentionDays": 30
}
```

## Procedure
1. Enable telemetry in `qa.config.json` and point it at the team's self-hosted OTLP collector, Prometheus and LLM dashboard.
2. Wrap the orchestrator steps, skill invocations and tool calls in spans; nest them under one run span per request.
3. Record LLM-call metadata (model, tokens, cost, latency, routing decision, outcome) with content redacted per `redactFields`.
4. Export Prometheus metrics (duration, pass rate, cost, gate blocks, retries); build a dashboard for them and the LLM-call view.
5. Confirm no secrets/target data appear in traces (spot-check redaction); set sampling and retention.

## Definition of Done
- Run, skill and tool spans export via OTLP; LLM calls traced by metadata with content redacted.
- Prometheus metrics (duration, pass rate, cost, gate blocks) exposed and on a dashboard.
- Telemetry is opt-in, backends are self-hosted, retention set, and no secrets/target data are recorded.
