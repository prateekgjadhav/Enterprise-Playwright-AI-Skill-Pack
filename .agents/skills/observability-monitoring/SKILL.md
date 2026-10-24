---
name: observability-monitoring
description: >-
  Observability validation and synthetic monitoring for services the team owns: assert that health
  and readiness endpoints behave, that structured logs, metrics (RED/USE) and OpenTelemetry traces
  are emitted for key flows, and stand up Playwright-based synthetic checks that run on a schedule
  against non-production (and, where authorised, production read-only) to catch regressions in
  availability and latency. Use whenever the user asks for observability, monitoring, synthetic
  checks, health/readiness probes, telemetry or trace validation, uptime checks, or dashboards and
  alert wiring. Not for in-browser Core Web Vitals (performance-testing), CI pipeline config
  (ci-cd-pipeline-config), or SLOs and error budgets (sre-reliability).
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Observability & monitoring

You can only operate what you can see. Confirm the application emits the signals operators need,
and run lightweight synthetic journeys that fail loudly when availability or latency regresses.

## Non-negotiables
- Synthetic checks target authorised environments only; default to `staging`/`dev`. Production synthetics are read-only, non-mutating, and run only with approval.
- Never log or assert on secrets or PII; redact. Telemetry assertions check that a signal exists and is well-formed, not its sensitive contents.
- Synthetic monitors are deterministic and cheap; they alert on availability and latency SLIs, not on flaky UI detail.
- Health/readiness semantics are respected: readiness gates traffic, liveness gates restarts.

## Coverage map
| Signal | Check |
|---|---|
| Health / readiness | `/healthz` and `/readyz` return correct status and reflect dependencies |
| Logs | key flows emit structured logs with correlation/trace ids; levels sane; no secrets |
| Metrics | RED (rate, errors, duration) for request paths; USE for resources; exposed to the scraper |
| Traces | OpenTelemetry spans for critical transactions; context propagates across services |
| Synthetic | scheduled journeys assert availability and latency thresholds; alert on breach |
| Dashboards & alerts | key SLIs on a dashboard; alerts route to an owner; no alert on noise |

## Templates
```typescript
// @skill-example: fragment — tests/synthetic/checkout.synthetic.spec.ts
import { test, expect } from '@fixtures';

test('checkout journey stays available and fast', { tag: ['@synthetic', '@P1', '@checkout'] }, async ({ apiAs }) => {
  const api = await apiAs('user');
  const started = Date.now();
  const res = await api.get('/readyz');
  expect(res.status()).toBe(200);
  expect(Date.now() - started, 'readiness latency').toBeLessThan(1000);   // availability + latency SLI
});
```
```yaml
# @skill-example: fragment — scheduled synthetic job (add to the Observability stage)
synthetic:
  on: { schedule: [{ cron: '*/15 * * * *' }] }     # every 15 min, non-prod
  steps:
    - uses: actions/checkout@<sha>
    - run: npm ci
    - run: npx playwright test --project=synthetic   # alerts via the report/notify step on failure
```

## Procedure
1. Confirm the environment and authorisation; identify the critical flows and their dependencies.
2. Assert health/readiness semantics and that logs, metrics and traces are emitted and well-formed for those flows.
3. Write deterministic synthetic journeys in `tests/synthetic/`; set availability and latency thresholds.
4. Schedule the synthetics (`ci-cd-pipeline-config`); wire alerts to an owner; put key SLIs on a dashboard.
5. Run `--project=synthetic`, then `npm run verify`; hand SLO targets and error-budget policy to `sre-reliability`.

## Definition of Done
- Health/readiness, log, metric and trace emission validated for critical flows (no secrets).
- Scheduled synthetic journeys with availability/latency thresholds and owner-routed alerts.
- Dashboard shows key SLIs; verify green.
