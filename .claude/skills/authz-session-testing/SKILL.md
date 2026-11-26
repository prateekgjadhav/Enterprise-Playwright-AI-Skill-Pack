---
name: authz-session-testing
description: >-
  Tests that authorisation and sessions hold under a verified scope — object-level access between two
  synthetic customers (IDOR), role boundaries, CSRF protection, JWT validation (signature, expiry,
  algorithm), session fixation, logout and expiry. Use whenever an approved scope covers access
  control, sessions or tokens, or an open finding needs a regression guard, or someone asks whether
  one customer can see another customer's data, or for JWT or CSRF checks. Not for functional
  permission matrices (multi-role-auth), header checks (security-headers-check), or API-specific abuse
  (api-security-testing), or time-based expiry in the UI (clock-time-control).
allowed-tools: Read Grep Glob Edit(tests/sec/**) Write(tests/sec/**) Bash(npx playwright test --project=security:*) Write(reports/security/**)
---

# Authorisation and session testing

Two users, one resource: the second must never see the first's.

## Gate
Disabled by default. It runs only after `security-scope-verify` accepts a signed, unexpired scope that names this skill, and the managed `verify-scope` hook re-checks that scope on every security command. Without a valid scope the command is blocked.

## Non-negotiables
- Runs only with a scope verified by `security-scope-verify`; the verify-scope hook blocks every security command otherwise.
- Non-destructive, rate-limited, synthetic accounts and data only; never production, never another tenant's real data.
- Prove that a control holds; never produce exploit chains or weaponised payloads.

## Inputs and outputs
- **In:** the scope; the roles and synthetic accounts
- **Out:** findings and regression specs under `tests/sec/`

## Procedure
1. Create two synthetic customers and an admin through factories.
2. Attempt cross-user access to each resource by id; expect 403 or 404.
3. Check CSRF tokens on state-changing forms; check token tampering is refused.
4. Check logout and expiry invalidate the session server-side.

## Verify
- the security project ran under the scope

## Evidence
Add to the evidence block: scope id, controls checked, findings. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Each control is proven to hold or recorded as a finding.
