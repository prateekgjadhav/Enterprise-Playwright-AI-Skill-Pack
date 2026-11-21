---
name: sharding-config
description: >-
  Sizes the browser-by-shard matrix and worker count from timing data so the pull request pipeline
  stays within its duration objective, using the blob reporter so shards merge into one report. Use
  whenever CI is slow, shards are unbalanced, or a new browser or project is added to the matrix. Not
  for choosing tests by impact (test-impact-selection), merging the reports (merge-reports), or
  editing other parts of workflows (ci-workflow-authoring).
allowed-tools: Read Grep Glob Edit(.github/workflows/ci.yml) Edit(playwright.config.ts)
---

# Sharding configuration

Spend machines, not engineers' time: balance shards from measured durations.

## Non-negotiables
- Never drop a browser engine to save time.
- Impact-selected shards pass `--pass-with-no-tests` explicitly (Playwright 1.65 fails empty shards otherwise).

## Inputs and outputs
- **In:** test durations from the last merged report
- **Out:** matrix and worker settings

## Procedure
1. Read durations from the JSON or blob report.
2. Pick shard count so p95 job time is at most ten minutes.
3. Keep `fullyParallel: true` unless a file must be serial.
4. Update the matrix and confirm the merge job still downloads every blob.

## Verify
- workflow lint passes
- pull request p95 at most 20 minutes

## Evidence
Add to the evidence block: shard maths and measured durations. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The pipeline meets its duration objective with all three engines.
