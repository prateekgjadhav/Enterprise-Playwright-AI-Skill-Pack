---
name: api-security-testing
description: >-
  Tests in-scope APIs under a verified scope for broken object- and function-level authorisation, mass
  assignment, SSRF defences using only the scope's canary callback host, file-upload validation (type,
  size, content) and rate limiting. Use whenever an approved scope covers an API or an API finding
  needs a regression guard, or an upload endpoint's validation must be checked. Not for functional API
  tests (api-test-authoring), UI session checks (authz-session-testing), or input injection
  (injection-testing), or starting an assessment or pentest (security-scope-verify), or JWT checks
  (authz-session-testing), or someone asking to write API tests (api-test-authoring).
allowed-tools: Read Grep Glob Edit(tests/sec/**) Write(tests/sec/**) Bash(npx playwright test --project=security:*) Write(reports/security/**)
---

# API security testing

An API is a user interface for attackers: test the rules it enforces.

## Gate
Disabled by default. It runs only after `security-scope-verify` accepts a signed, unexpired scope that names this skill, and the managed `verify-scope` hook re-checks that scope on every security command. Without a valid scope the command is blocked.

## Non-negotiables
- Runs only with a scope verified by `security-scope-verify`; the verify-scope hook blocks every security command otherwise.
- Non-destructive, rate-limited, synthetic accounts and data only; never production, never another tenant's real data.
- Prove that a control holds; never produce exploit chains or weaponised payloads.
- SSRF probes target only the scope's canary endpoint, never metadata or internal addresses.

## Inputs and outputs
- **In:** the scope; the API specification
- **Out:** findings and regression specs

## Procedure
1. Call each endpoint as each role and as another tenant's user.
2. Send extra fields to check mass assignment is refused.
3. Submit callback URLs pointing at the canary host only.
4. Upload files of the wrong type, oversized files and polyglots; expect refusal.

## Verify
- the security project ran under the scope

## Evidence
Add to the evidence block: scope id, endpoints checked, findings. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every in-scope endpoint's controls are proven or recorded as findings.
