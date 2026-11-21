---
name: test-healing
description: >-
  Repairs locator and flow drift through scripts/self-healing/heal.mjs and the Playwright healer agent
  under governance: proposals first, page objects only, applied after review, never test.fixme or
  skip, never weaker assertions, and the healed test must pass three times. Use whenever locators
  broke after a UI change, the healer agent proposes fixes, or many tests fail on the same changed
  element, or the healer's proposals must be reviewed. Not for diagnosing the cause of a failure
  (failure-rca), choosing a locator by hand (locator-selection), or flaky timing (flake-triage).
allowed-tools: Read Grep Glob Edit(src/pages/**) Bash(node scripts/self-healing/heal.mjs:*)
---

# Governed test healing

Heal the selector, never the expectation.

## Non-negotiables
- Proposals first: `heal.mjs` without `--apply` writes `healing-report.md` and `healing-proposals.json` for review.
- Touch page objects only, never specs; never add `test.fixme`, `test.skip` or a weaker assertion.
- When intent is unclear, ask: this overrides the upstream healer prompt that says not to ask questions.
- `--live` checks only allowlisted environments.

## Inputs and outputs
- **In:** `reports/results.json`; ARIA snapshots or an allowlisted URL
- **Out:** reviewed locator patches

## Procedure
1. `node scripts/self-healing/heal.mjs --results reports/results.json` to propose.
2. Review each proposal's confidence and reason; reject low-confidence ones.
3. `node scripts/self-healing/heal.mjs --apply` for the accepted ones.
4. Re-run each healed test with `--repeat-each=3` in the Execute step (managed settings ask first).

## Verify
- healed tests pass three times
- `governance-lint` clean

## Evidence
Add to the evidence block: proposals accepted and rejected, repeat results. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Only true drift was healed, by reviewed patches, with passing repeats.
