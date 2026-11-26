---
name: security-headers-check
description: >-
  Passively checks in-scope responses for Content-Security-Policy, Strict-Transport-Security, frame
  protection, Referrer-Policy, Permissions-Policy, CORS and cookie attributes (Secure, HttpOnly,
  SameSite) with GET requests only, under a verified scope. Use whenever an approved scope covers
  response hardening or someone asks whether security headers are set correctly, or someone asks
  whether CSP and HSTS are configured. Not for authorisation tests (authz-session-testing), injection
  probes (injection-testing), or verifying the scope (security-scope-verify).
allowed-tools: Read Grep Glob Edit(tests/sec/**) Write(tests/sec/**) Bash(npx playwright test --project=security:*) Write(reports/security/**)
---

# Security headers check

Headers are the cheapest controls to verify and the easiest to lose in a release.

## Gate
Disabled by default. It runs only after `security-scope-verify` accepts a signed, unexpired scope that names this skill, and the managed `verify-scope` hook re-checks that scope on every security command. Without a valid scope the command is blocked.

## Non-negotiables
- Runs only with a scope verified by `security-scope-verify`; the verify-scope hook blocks every security command otherwise.
- Non-destructive, rate-limited, synthetic accounts and data only; never production, never another tenant's real data.
- Prove that a control holds; never produce exploit chains or weaponised payloads.

## Inputs and outputs
- **In:** the scope; in-scope URLs
- **Out:** findings under `reports/security/`

## Procedure
1. Request each in-scope page and API with GET.
2. Assert each header against the expected policy in the spec.
3. Record findings with the scope id.

## Verify
- `npx playwright test --project=security --grep @headers` ran under the scope

## Evidence
Add to the evidence block: scope id, headers missing or weak. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every in-scope response is checked and recorded.
