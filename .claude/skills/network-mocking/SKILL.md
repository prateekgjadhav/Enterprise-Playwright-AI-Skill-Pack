---
name: network-mocking
description: >-
  Stubs third-party or unstable dependencies with page.route or HAR replay, scoped per test, with
  recorded HAR files scrubbed before commit. Use whenever a test depends on a payment provider, maps,
  analytics or another third party, an upstream is unstable in test environments, or an error path
  must be forced, or a test must force an error such as a 500 from an API. Not for testing the API
  itself (api-test-authoring), contract drift (contract-testing), or time control
  (clock-time-control).
allowed-tools: Read Grep Glob Edit(tests/**) Edit(src/mocks/**) Write(src/mocks/**) Bash(node scripts/scrub-artifacts.mjs:*)
---

# Network mocking

Mock what you do not own; never mock the system under test.

## Non-negotiables
- One handler per route pattern per file (`unique-route`).
- Recorded HAR files are scrubbed (`node scripts/scrub-artifacts.mjs src/mocks`) and secrets-scanned before commit.
- Never mock the application under test itself.

## Inputs and outputs
- **In:** the dependency and the behaviour to force
- **Out:** route handlers or HAR fixtures under `src/mocks/`

## Procedure
1. Pick the narrowest URL pattern.
2. Fulfil with a fixture body or `routeFromHAR` in update-off mode.
3. Scrub any recorded HAR.
4. Scope the mock to the tests that need it.

## Verify
- `unique-route` passes
- `node scripts/secrets-scan.mjs src/mocks` exits 0

## Evidence
Add to the evidence block: mocked hosts and routes. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Tests no longer depend on the third party, and no secret entered the repository.
