---
name: merge-reports
description: >-
  Downloads the scrubbed blob reports from every shard, merges them into one HTML and JUnit report
  with npx playwright merge-reports, scrubs the result again and publishes it with short retention.
  Use whenever a sharded run finishes, a single report is needed across browsers, or the merged report
  is missing results. Not for scrubbing raw artifacts before upload (artifact-redaction), summarising
  a task (evidence-report), or analysing failures (failure-rca), or a flaky test blocking merges
  (flake-quarantine), or whether a branch is ready to merge (governance-lint).
allowed-tools: Read Grep Glob Bash(npx playwright merge-reports:*) Bash(node scripts/scrub-artifacts.mjs:*)
---

# Merge reports

One report per run, merged from scrubbed parts and scrubbed again.

## Non-negotiables
- Never merge or publish an unscrubbed blob.
- Retention is seven days; reports never include `.auth/` or storage state.

## Inputs and outputs
- **In:** `blob-*` artifacts
- **Out:** the merged HTML and JUnit report

## Procedure
1. Download all blob artifacts into one folder.
2. `npx playwright merge-reports --reporter html,junit all-blob`.
3. `node scripts/scrub-artifacts.mjs playwright-report`.
4. Upload with `retention-days: 7`.

## Verify
- the report's test count equals the sum of shards
- scrubber exit 0

## Evidence
Add to the evidence block: report digest, test counts. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- One scrubbed report holds every shard's results.
