---
name: api-test-authoring
description: >-
  Writes API tests with Playwright's request context — relative paths on the configured API base,
  authentication from storage state or the secret provider, status, header and schema assertions, and
  setup that creates data through the API. Use whenever an endpoint needs tests, UI tests need faster
  API setup, or someone asks for REST or GraphQL coverage, or someone asks to write API tests for an
  endpoint such as orders, or a POST or GET needs validation-error tests. Not for detecting contract
  drift across services (contract-testing), API security testing (api-security-testing), or stubbing
  third parties (network-mocking).
allowed-tools: Read Grep Glob Edit(tests/api/**) Write(tests/api/**) Bash(npx tsc --noEmit) Bash(npx playwright test --list)
---

# API test authoring

Test the contract the client relies on, through the same entry point the client uses.

## Non-negotiables
- Relative URLs only; the egress guard and allowlist decide the host.
- No literal tokens; never log auth headers.
- Validate the response schema, not just the status.

## Inputs and outputs
- **In:** the endpoint specification
- **Out:** `tests/api/<resource>.spec.ts`

## Procedure
1. Create the request context from fixtures.
2. Cover success, validation errors, not-found and permission cases.
3. Assert status, key headers and the body schema.
4. Clean up created data.

## Verify
- typecheck clean
- tests listed

## Evidence
Add to the evidence block: endpoints and cases covered. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Each endpoint's documented behaviour is asserted.
