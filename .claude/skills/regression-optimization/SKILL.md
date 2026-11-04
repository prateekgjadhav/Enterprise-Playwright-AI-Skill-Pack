---
name: regression-optimization
description: >-
  Reduces flakiness and speeds up Playwright regression suites: proves and quarantines flaky
  tests, removes root causes of nondeterminism, tunes workers, sharding and retries, selects tests
  by change or risk, and reports suite health. Use whenever the user mentions flaky or intermittent
  tests, a slow suite, too many retries, long CI times, test selection or impact analysis, smoke
  suite selection, or quarantining tests. Not for one specific failure's root cause
  (defect-analysis) or writing pipeline files (ci-cd-pipeline-config).
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Regression optimisation

A fast suite nobody trusts is useless. Fix trust first, then speed.

## Non-negotiables
- Prove flakiness before acting: `npx playwright test <file> --repeat-each=10 --workers=1`, then with `--workers=4` and `--shuffle` to expose order and isolation problems.
- Quarantine is temporary and visible: tag `@quarantine`, exclude with `-G @quarantine`, link a ticket and an owner, and review weekly. Never delete or skip silently.
- Never "fix" flakiness with waits, `force: true`, extra retries or weaker assertions.

## Flakiness causes and fixes
| Cause | Signal | Fix |
|---|---|---|
| Timing | passes with `--headed`, fails fast in CI | web-first assertions; wait for the specific response, not time |
| Shared data | fails only in parallel or with `--shuffle` | unique data per worker (`test-data-management`) |
| Order dependence | fails when run alone or reordered | each test sets up its own state; no reliance on previous tests |
| Ambiguous locator | strict-mode errors, wrong element clicked | `locator-strategy` |
| Environment | many unrelated failures in one shard | route to `defect-analysis` as environment; do not retry blindly |
| Animations and rendering | visual or click interception | disable animations, wait for the ready indicator |

## Speed levers
| Lever | How |
|---|---|
| Parallelism | `fullyParallel: true`; `workers: '50%'` in CI; tests independent |
| Sharding | `--shard=i/n` with blob reports; split by duration once history exists |
| Change-based selection | `--only-changed=origin/main` on pull requests, plus `@smoke` |
| Layer shifting | move checks that don't need a browser into `api-testing` |
| Auth reuse | one `setup` project writing `storageState`, reused by all tests |
| Retries | CI only (`retries: 2`); `failOnFlakyTests` once the suite is clean |

## Procedure
1. Collect history: the last N runs' JSON or JUnit reports; compute per-test failure rate, flaky rate (passed on retry) and duration.
2. Rank by impact: flaky rate times run frequency, then the slowest 10 percent.
3. For each flaky test, reproduce with `--repeat-each`, classify with the table, fix the cause, and prove it with 10 clean repeats.
4. For speed, apply the levers in order and measure wall-clock time before and after.
5. Choose the smoke set: P0 journeys only, stable for the last 10 runs, under the agreed time budget.
6. Report suite health: pass rate, flaky rate, slowest tests, quarantine list with owners.

## Definition of Done
- Each fixed test passes 10 consecutive repeats in parallel.
- The quarantine list has an owner and a ticket per entry.
- Before and after timings are reported.
