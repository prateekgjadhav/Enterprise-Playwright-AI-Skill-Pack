---
name: security-findings-report
description: >-
  Turns security test results into a CVSS-scored findings report that embeds the authorization record
  (scope id, digest, approver), with reproduction limited to what an owner needs and evidence
  redacted, and files findings to the tracker only with an approval attestation. Use whenever a scoped
  security run has finished or findings must be shared with owners. Not for running checks
  (security-headers-check, authz-session-testing, injection-testing, api-security-testing), verifying
  scope (security-scope-verify), or general evidence (evidence-report).
allowed-tools: Read Grep Glob Write(reports/security/**) Bash(gh workflow run approve.yml:*)
---

# Security findings report

A finding without its authorisation record is not shareable.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- Every report references a verified scope.
- No exploit chains or weaponised payloads; reproduction steps stop at what proves the issue.
- External filing needs an approval attestation.

## Inputs and outputs
- **In:** findings; the scope record
- **Out:** `reports/security/<scope-id>.md`

## Procedure
1. Score each finding with CVSS and the affected asset.
2. Embed the scope id, digest and approver.
3. Redact evidence; run `secrets-scan`.
4. Request approval to file through `approval-attestation`.

## Verify
- the report references a valid scope
- secrets-scan clean

## Evidence
Add to the evidence block: report digest, findings by severity. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Owners receive redacted, scored findings with their authorisation record.
