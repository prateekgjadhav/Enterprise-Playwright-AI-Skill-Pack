---
name: performance-vitals
description: >-
  Measures LCP, CLS and INP in lab conditions with a fixed throttling profile on allowlisted
  non-production environments and compares the median of five runs to the budgets in qa.config.json.
  Use whenever someone asks how fast a page is, wants Core Web Vitals budgets enforced, or a change
  may have slowed a page, or someone asks to enforce LCP budgets or whether a page became slower. Not
  for load or stress testing a service, network mocking (network-mocking), or time control
  (clock-time-control).
allowed-tools: Read Grep Glob Edit(tests/perf/**) Write(tests/perf/**) Bash(npx playwright test --grep @perf:*)
---

# Performance vitals

Lab numbers are comparisons, not field truth: hold the profile fixed and compare medians.

## Non-negotiables
- Load-testing a shared environment needs its owner's written agreement first.
- Never report lab results as field data.

## Inputs and outputs
- **In:** pages; budgets
- **Out:** perf specs tagged `@perf` and a vitals report

## Procedure
1. Fix CPU and network throttling through CDP in Chromium.
2. Collect LCP, CLS and INP with a `PerformanceObserver` injected by `addInitScript`.
3. Run five times; take the median; compare with the budgets.

## Verify
- budgets evaluated for every page

## Evidence
Add to the evidence block: median per metric and budget. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every page has a budget and a measured median.
