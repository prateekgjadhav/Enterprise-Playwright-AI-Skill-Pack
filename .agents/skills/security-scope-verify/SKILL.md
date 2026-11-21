---
name: security-scope-verify
description: >-
  Validates the signed authorization scope for security testing before any T4 skill runs — signature
  against the managed security-approver identity, time window, targets within the environment
  allowlist, the skills and techniques allowed, rate limit and ticket — and stores the authorization
  record with the results. Use whenever someone asks for penetration testing, authorisation,
  injection, API or header security checks, or before any T4 skill starts, or someone asks for a
  security assessment or a pentest. Not for running the checks (security-headers-check,
  authz-session-testing, injection-testing, api-security-testing), or reporting findings
  (security-findings-report).
allowed-tools: Read Grep Glob Bash(node /opt/qa-pack/hooks/verify-scope.mjs --check:*)
---

# Security scope verification

Security testing without written, signed, current authorisation is an attack.

## Non-negotiables
- No scope, no test: any verification failure stops the work.
- Targets must be inside `environments[].hosts`; production is never in scope.
- Scopes are created and signed by security approvers, never by the agent.

## Inputs and outputs
- **In:** `governance/scopes/<id>.json` and its bundle
- **Out:** valid or invalid with reasons

## Procedure
1. `node /opt/qa-pack/hooks/verify-scope.mjs --check governance/scopes/<id>.json`.
2. Confirm the requested skill and techniques are listed in the scope.
3. Export `QA_SCOPE_FILE` for the run; the verify-scope hook re-checks on every security command.

## Verify
- the check exits 0

## Evidence
Add to the evidence block: scope id, window, signer. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every security run is covered by a verified scope recorded with its results.
