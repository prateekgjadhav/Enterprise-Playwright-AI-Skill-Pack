---
name: contract-testing
description: >-
  Checks provider responses against the published OpenAPI or JSON Schema contract and classifies
  differences as breaking or additive, so a service change that would break its consumers is caught
  before release. Use whenever an API contract or schema changes, a consumer broke after a provider
  release, or someone asks for consumer-driven or schema contract checks. Not for functional API
  behaviour (api-test-authoring), API security (api-security-testing), or mocking (network-mocking),
  or creating a new skill (skill-authoring).
allowed-tools: Read Grep Glob Edit(tests/contract/**) Write(tests/contract/**) Bash(npx tsc --noEmit)
---

# Contract testing

A contract test fails when the promise changes, not when the data does.

## Non-negotiables
- Never update the published schema to make a test pass without the provider owner's approval.
- Run only against allowlisted environments.

## Inputs and outputs
- **In:** the contract file; the endpoints
- **Out:** contract specs and a drift report

## Procedure
1. Load the schema from the repository (never fetch it at run time from an unlisted host).
2. Validate representative responses.
3. Classify each difference: removed or renamed field, type change (breaking); new optional field (additive).
4. Report drift with the consumer impact.

## Verify
- contract specs listed
- drift report attached

## Evidence
Add to the evidence block: breaking and additive changes. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Breaking changes are visible before release.
