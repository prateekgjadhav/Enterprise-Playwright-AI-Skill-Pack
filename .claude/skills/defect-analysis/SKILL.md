---
name: defect-analysis
description: >-
  Root cause analysis for failing Playwright tests from traces, logs, screenshots, videos and
  reports: reproduces the failure, reads the trace and error context, classifies it into one
  cause with evidence, checks for flakiness, and drafts a deduplicated defect when it's a product
  bug. Use whenever a test fails or is red in CI, the user shares a trace, report, screenshot or
  error, asks why a test failed, or wants a bug report written from a failure. Not for suite-wide
  flakiness programmes (regression-optimization) or performance budget breaches without a failure
  (performance-testing).
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Defect analysis

Every failure gets one cause, backed by evidence a reviewer can check.

## Non-negotiables
- Evidence first: read the error, the trace and the attachments before forming a view.
- One classification per failure, with a confidence. "Needs triage" is allowed when evidence is missing; say what's missing.
- Never "fix" a product bug by changing the test. Never weaken an assertion or add a wait to make a test pass.
- Defects are drafted, not filed, until the user approves.

## Evidence to read
| Source | How |
|---|---|
| Error and stack | the report (`reports/results.json` or the HTML report) |
| Trace | `npx playwright show-trace <trace.zip>`, or the terminal trace commands (`npx playwright trace open`, `trace actions`, `trace action <n>`) |
| Page state at failure | the error-context attachment (aria snapshot) |
| Console and network | console messages, page errors and failed requests from the trace or a diagnostics attachment |
| Screenshot and video | attachments on failure |
| History | previous runs of the same test; a knowledge server's `rca` collection if configured |

## Classes
| Class | Typical signals | Action |
|---|---|---|
| Application bug | 5xx from the app, uncaught page error before the assertion, wrong content with the right element | draft a defect |
| Test defect | wrong expectation, stale locator, missing setup | fix the test (hand to the owning skill) |
| Environment or infrastructure | DNS, TLS, connection reset, grid or websocket errors, many unrelated failures at once | rerun once; report to the environment owner |
| Test data | 409 or 422, "already exists", missing seed | `test-data-management` |
| Flaky or timing | passes on retry, strict-mode or visibility races | `regression-optimization` / `locator-strategy` |
| Migration regression | migrated test fails where the legacy one passed on the same build | `migration-analysis` |

## Procedure
1. Reproduce: `npx playwright test <file> -g "<title>" --repeat-each=3 --trace=on`.
2. Read the evidence above in order; note the first divergence from expected behaviour.
3. Classify with confidence and cite the evidence (error line, request, snapshot excerpt).
4. Compute a signature from the first error line (numbers, ids and URLs stripped) to group repeats.
5. For an application bug, draft: summary, steps (from `test.step` titles), expected and actual, environment, evidence paths, related requirement, and the label `qa-sig-<signature>`. If a tracker MCP server is configured, search for an open defect with that label first and propose a comment instead of a duplicate. File only after approval.
6. If a knowledge server is configured and the user approves, store the verified cause and resolution in the `rca` collection.

## Definition of Done
- Each failure has a class, confidence and cited evidence.
- Product bugs have a defect draft (or an existing defect to comment on); nothing filed without approval.
