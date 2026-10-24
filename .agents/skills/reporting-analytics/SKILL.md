---
name: reporting-analytics
description: >-
  Test reporting and analytics for Playwright suites: configures reporters, normalises results from
  every layer into one result file, computes pass rate, flaky rate, duration and failure trends,
  measures requirement coverage from test annotations, and publishes dashboards or summaries. Use
  whenever the user asks for test reports, dashboards, trends, metrics, coverage of requirements or
  acceptance criteria, release readiness summaries, or pushing results to a dashboard or chat. Not
  for diagnosing individual failures (defect-analysis), configuring CI jobs (ci-cd-pipeline-config),
  or security risk posture (security-posture-management).
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Reporting and analytics

Reports answer three questions: can we ship, what is getting worse, and what isn't tested.

## Non-negotiables
- Numbers come only from result files; never estimate or invent figures.
- Flaky tests (passed on retry) are reported separately from passes and failures.
- Dashboards and chat posts outside the team need the user's approval.

## Reporters
Configure `list`, `html` (`reports/html`), `junit` (`reports/junit.xml`) and `json` (`reports/results.json`); `blob` when sharded, merged afterwards. Add `allure-playwright` or a ReportPortal agent only when the organisation already uses them. Attach evidence (traces, screenshots, axe results, vitals, k6 summaries) to tests so reports carry it.

## Normalised result file
One `result.json` per run merges all layers:
```json
{ "run": "2026-10-20T10:15:00Z", "env": "staging", "commit": "abc1234",
  "summary": { "total": 412, "passed": 398, "failed": 6, "flaky": 5, "skipped": 3, "durationMs": 1830000,
    "byLayer": { "ui": { "passed": 210, "failed": 4 }, "api": { "passed": 160, "failed": 1 },
                 "perf": { "budgetsFailed": ["LCP /checkout"] }, "security": { "findings": { "High": 0, "Medium": 1 } } } },
  "tests": [ { "id": "tests/e2e/checkout/coupon.spec.ts::applies a valid coupon", "status": "passed", "retries": 0,
               "durationMs": 8200, "tags": ["@P0", "@checkout"], "requirements": ["PROJ-123"] } ] }
```

## Metrics
| Metric | Definition |
|---|---|
| Pass rate | passed ÷ (passed + failed), excluding skipped |
| Flaky rate | tests that passed only on retry ÷ executed |
| Failure trend | failures per run over the last N runs, by feature tag |
| Duration | suite wall-clock and the slowest 10 tests, trended |
| Requirement coverage | requirements with at least one passing test ÷ requirements in scope (from `requirement` annotations) |
| Priority health | P0 pass rate on its own; any P0 failure blocks release |

## Procedure
1. Collect the run's reports (merged JSON, JUnit, layer outputs).
2. Normalise into `result.json`; keep unknown fields under `raw`.
3. Compute the metrics; compare with the previous runs kept as history (artifacts or a results store).
4. Coverage: list requirements in scope (from the tracker MCP server when configured, or a list from the user) and match them to `requirement` annotations.
5. Publish: the release summary (go or no-go reasons, P0 status, new failures, flaky list, coverage gaps), then push to a dashboard endpoint or chat only with approval.

## Definition of Done
- Every figure is traceable to a result file from this run or stored history.
- Flaky, failed and skipped are separate; P0 status is explicit.
- Coverage gaps list the requirements with no passing test.
