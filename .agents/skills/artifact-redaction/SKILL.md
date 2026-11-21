---
name: artifact-redaction
description: >-
  Scrubs Playwright traces, blob reports, HTML reports and HAR files before they leave the runner —
  opening trace zips, redacting registered secret values, authorization and cookie headers, tokens and
  personal data in every text entry, deleting .auth/ and storage state — and fails closed when
  anything cannot be parsed. Use whenever artifacts are about to be uploaded, a report or HAR is
  shared, or a secret was found in an artifact, or a token appears in a report or a HAR must be made
  safe to share. Not for scanning the repository (secrets-scan), merging reports (merge-reports), or
  resolving credentials (secret-provider-fixture).
allowed-tools: Read Grep Glob Bash(node scripts/scrub-artifacts.mjs:*)
---

# Artifact redaction

Nothing leaves the runner unscrubbed; if it cannot be scrubbed, it does not leave.

## Non-negotiables
- Upload only the scrubber's output; never the originals, never with `if: always()` on raw paths.
- Unparseable archives fail the job.
- Pixels cannot be scrubbed: keep video off and screenshots on failure only, against synthetic data.

## Inputs and outputs
- **In:** artifact directories; the runner-temp redaction registry
- **Out:** scrubbed artifacts and a redaction summary

## Procedure
1. `node scripts/scrub-artifacts.mjs blob-report test-results playwright-report`.
2. Check the summary: entries scanned, values redacted, files dropped.
3. Run `node scripts/secrets-scan.mjs` on the output.

## Verify
- scrubber exit 0
- canary secret absent

## Evidence
Add to the evidence block: redaction counts, dropped files. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Uploaded artifacts contain no secret, cookie, token or storage state.
