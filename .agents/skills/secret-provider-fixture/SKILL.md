---
name: secret-provider-fixture
description: >-
  Wires the pluggable secretProvider worker fixture — CI-injected environment, Vault, a cloud secret
  manager or 1Password through their own CLIs — so tests resolve credentials by reference at run time
  and every resolved value is registered for redaction. Use whenever tests need credentials, a new
  secret store must be supported, or a literal password, token or key is found in test code, or a test
  has a hard-coded password. Not for detecting leaked secrets (secrets-scan), test data
  (data-factory-authoring), or authenticated state (auth-setup-project), or checking whether a secret
  was committed (secrets-scan).
allowed-tools: Read Grep Glob Edit(src/fixtures/secret-providers.ts) Edit(src/fixtures/index.ts) Bash(npx tsc --noEmit)
---

# Secret provider fixture

Tests know the name of a secret, never its value.

## Non-negotiables
- Never read `.env*`, print a value, or write one anywhere except the runner-temp redaction registry.
- A missing secret fails the test (fail closed); there is no default value.
- CI resolves secrets through OIDC federation, never stored long-lived tokens.

## Inputs and outputs
- **In:** `secrets.provider`; `secrets.refs`
- **Out:** adapter configuration and fixture usage

## Procedure
1. Pick the adapter: `ci-env`, `vault`, `aws-sm`, `gcp-sm`, `azure-kv` or `1password`.
2. Add references to `secrets.refs` (names only) through `config-proposal`.
3. Use `await secretProvider.get('<ref>')` in setup and fixtures.
4. Confirm the scrubber redacts the value (`artifact-redaction` canary test).

## Verify
- typecheck clean
- canary value absent from artifacts

## Evidence
Add to the evidence block: references used (never values). Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- No credential literal remains and every value is redacted from artifacts.
