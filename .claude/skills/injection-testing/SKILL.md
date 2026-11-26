---
name: injection-testing
description: >-
  Probes in-scope inputs with benign canary payloads for SQL, NoSQL, command and template injection
  and stored or reflected XSS under a verified scope, checking that input is handled and output is
  encoded, and stops at the first confirmed issue. Use whenever an approved scope covers input
  handling or an injection finding needs a regression guard. Not for API authorisation abuse
  (api-security-testing), headers (security-headers-check), or sessions (authz-session-testing).
allowed-tools: Read Grep Glob Edit(tests/sec/**) Write(tests/sec/**) Bash(npx playwright test --project=security:*) Write(reports/security/**)
---

# Injection testing

Show the input is treated as data with a harmless marker, never with a harmful one.

## Gate
Disabled by default. It runs only after `security-scope-verify` accepts a signed, unexpired scope that names this skill, and the managed `verify-scope` hook re-checks that scope on every security command. Without a valid scope the command is blocked.

## Non-negotiables
- Runs only with a scope verified by `security-scope-verify`; the verify-scope hook blocks every security command otherwise.
- Non-destructive, rate-limited, synthetic accounts and data only; never production, never another tenant's real data.
- Prove that a control holds; never produce exploit chains or weaponised payloads.
- No destructive payloads, no data extraction, no denial of service.

## Inputs and outputs
- **In:** the scope; the input fields and parameters
- **Out:** findings and regression specs

## Procedure
1. Submit canary markers (for example `qa-canary-<id>'"<b>`) to each input.
2. Check the response and the rendered page: the marker must appear encoded or be rejected.
3. Stop at the first confirmed issue and record it.

## Verify
- the security project ran under the scope
- the rate limit was respected

## Evidence
Add to the evidence block: scope id, inputs probed, findings. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every in-scope input is shown to encode or reject the canary.
