---
name: flake-triage
description: >-
  Confirms and classifies a suspected flaky test by repeating only that test serially and then in
  parallel, comparing passing and failing traces, and naming the cause — timing, data, environment or
  product. Use whenever a test passes and fails without code changes, retries hide failures, or
  someone asks why a test is flaky, or a test is flaky, fails one run in ten, or retries hide a
  failure. Not for quarantining it (flake-quarantine), choosing tests for a change
  (test-impact-selection), or a single deterministic failure (failure-rca).
allowed-tools: Read Grep Glob Bash(npx playwright test:*) Write(.claude/out/**)
---

# Flake triage

Prove the flake, name the cause, fix the cause.

## Non-negotiables
- Repeat only the named tests: never `--repeat-each` on the whole suite.
- Never add retries or timeouts as a fix.

## Inputs and outputs
- **In:** the test id
- **Out:** a classification with evidence and a proposed fix

## Procedure
1. `npx playwright test <file> -g "<title>" --repeat-each=20 --workers=1`.
2. Repeat with `--workers=4` to surface data or ordering issues.
3. Compare a failing and a passing trace step by step.
4. Classify and propose the fix: web-first assertion, data factory, clock, mock or product defect.

## Verify
- failure rate recorded before and after the fix

## Evidence
Add to the evidence block: pass ratio, cause, fix. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The cause is named with evidence and the fixed test passes 20 of 20.
