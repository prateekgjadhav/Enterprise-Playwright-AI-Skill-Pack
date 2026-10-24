---
name: sre-reliability
description: >-
  Site-reliability engineering practices for services the team owns: define SLIs and SLOs, track an
  error budget, gate releases on it, run bounded resilience checks (timeout, retry, fallback and
  graceful-degradation behaviour under fault injection in non-production), and keep incident
  runbooks and postmortems. Use whenever the user asks about reliability, SLIs/SLOs, error budgets,
  availability targets, resilience or fault-injection/chaos checks, graceful degradation, incident
  response or postmortems, or release gating on reliability. Not for emitting telemetry and
  synthetic monitors (observability-monitoring), test flakiness (regression-optimization), or
  pipeline mechanics (ci-cd-pipeline-config). Resilience checks are authorised, non-production and
  bounded; this is not chaos engineering against live systems.
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# SRE & reliability

Make reliability a measured, budgeted target rather than a hope. Define what "reliable enough"
means, spend an error budget against it, and prove the system degrades gracefully when a dependency
misbehaves.

## Non-negotiables
- **Resilience checks run in authorised non-production only**, are bounded (one fault at a time, time-boxed, auto-reverted), and never run against production or `protectedHosts`. This is fault-injection to verify behaviour, not chaos against live systems.
- SLOs are owned and realistic; the error budget drives a decision (keep shipping vs. freeze for reliability), not a vanity metric.
- Incident runbooks and postmortems are blameless and action-oriented; every postmortem produces tracked follow-ups.
- Reliability gates are additive to existing release checks; they inform go/no-go, they don't bypass governance.

## Coverage map
| Area | Define / check |
|---|---|
| SLIs | the few user-centric signals that matter: availability, latency, correctness |
| SLOs | targets per SLI with a window (e.g. 99.9% over 30 days) |
| Error budget | remaining budget tracked; policy for what happens when it's spent |
| Resilience | dependency timeout honoured; retries bounded with backoff; fallback/degraded mode works; no cascading failure |
| Capacity/limits | sane timeouts, connection limits, and backpressure under load (pair with performance-testing) |
| Incident readiness | runbook per critical service; on-call path; postmortem template |

## Templates
```typescript
// @skill-example: fragment — tests/resilience/payments.resilience.spec.ts
import { test, expect } from '@fixtures';

// Authorised, non-prod: simulate a slow dependency via the app's test hook / fault proxy, bounded and reverted.
test('checkout degrades gracefully when payments is slow', { tag: ['@resilience', '@P1', '@checkout'] }, async ({ page, faultInjector, checkoutPage }) => {
  await faultInjector.delay('payments', { ms: 3000, forRequests: 1 });   // single, time-boxed fault
  await checkoutPage.payNow.click();
  await expect(checkoutPage.retryNotice).toBeVisible();                   // graceful message, not a crash
  await faultInjector.reset();
});
```
```markdown
# @skill-example: fragment — reliability/slo.md
Service: checkout
| SLI | SLO | Window | Error budget |
|---|---|---|---|
| Availability | 99.9% | 30d | 43m/30d |
| p95 latency | < 800ms | 30d | — |
Policy: budget exhausted → freeze feature work, prioritise reliability until recovered.
```

## Procedure
1. With the service owner, define SLIs and SLOs and the error-budget policy; record them.
2. Wire SLI measurement to the signals from `observability-monitoring`; track budget burn.
3. Write bounded resilience checks in `tests/resilience/` (timeout, retry, fallback, degraded mode); confirm no cascading failure.
4. Add a reliability input to release go/no-go (via `reporting-analytics`); write/refresh the runbook and postmortem template.
5. Run `--project=resilience` (non-prod), then `npm run verify`; review budget and follow-ups.

## Definition of Done
- SLIs/SLOs and error-budget policy defined and owned; budget burn tracked from real signals.
- Bounded, non-prod resilience checks prove graceful degradation for critical dependencies.
- Runbook and postmortem template in place; reliability feeds release go/no-go; verify green.
