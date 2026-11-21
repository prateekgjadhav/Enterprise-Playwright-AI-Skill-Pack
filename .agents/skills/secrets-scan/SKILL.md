---
name: secrets-scan
description: >-
  Scans source, history diffs, HAR files, reports and other artifacts for secrets and personal data —
  keys, tokens, JWTs, URI credentials, cards, IBANs, emails, assigned passwords — with the knowledge
  layer's redaction rules, without ever printing a matched value. Use whenever code or fixtures are
  committed, before artifacts are uploaded, or someone asks whether a secret leaked, or someone asks
  did we commit a secret, or whether a branch holds credentials. Not for removing secrets from
  artifacts (artifact-redaction), resolving credentials (secret-provider-fixture), or skill files
  (skill-scan).
allowed-tools: Read Grep Glob Bash(node scripts/secrets-scan.mjs:*) Bash(git diff:*)
---

# Secrets scan

Report where a secret is and what kind it is; never what it is.

## Non-negotiables
- Never echo a matched value; report file, line and rule only.
- A finding in history means rotation, not just deletion.

## Inputs and outputs
- **In:** paths or a diff
- **Out:** findings by rule

## Procedure
1. `node scripts/secrets-scan.mjs <paths>` (defaults to tracked files).
2. For a real secret: rotate it first, then remove it and add a canary pattern.
3. Re-run until clean.

## Verify
- exit 0

## Evidence
Add to the evidence block: finding counts by rule. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- No secret or personal data in the repository or artifacts.
