---
name: test-impact-selection
description: >-
  Selects the narrowest set of tests a change needs — changed files to page objects and modules to
  specs to requirements through the knowledge graph, or Playwright's --only-changed — and always keeps
  the @P0 smoke set. Use whenever a pull request needs a targeted run, someone asks which tests to run
  for a change, or CI is slow because it runs everything on every change. Not for sharding the full
  suite (sharding-config), confirming flakiness (flake-triage), or quarantining tests
  (flake-quarantine).
allowed-tools: Read Grep Glob Bash(git diff --name-only:*) Bash(node rag/cli.mjs impact:*) Bash(npx playwright test --list:*)
---

# Test impact selection

Run what the change can break, plus the smoke set, every time.

## Non-negotiables
- Always include `@P0`; never skip the full suite on `main` or nightly.
- Config, fixture or dependency changes select the full suite.

## Inputs and outputs
- **In:** the diff
- **Out:** a list of spec files or a `--grep` expression with the reason for each

## Procedure
1. `git diff --name-only origin/main...HEAD`.
2. `node rag/cli.mjs impact <files>` for graph-based selection.
3. Fall back to `npx playwright test --only-changed=origin/main` when the index is absent.
4. Add `@P0`; if config or fixtures changed, select everything.

## Verify
- the selection is non-empty and listed by `--list`

## Evidence
Add to the evidence block: selected count and rationale. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The run covers the change and the smoke set.
