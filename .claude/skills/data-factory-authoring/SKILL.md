---
name: data-factory-authoring
description: >-
  Builds factories under src/data that create synthetic, unique-per-worker test data with automatic
  teardown, so tests never share or depend on fixed records and never use real personal data. Use
  whenever a test needs users, orders, products or other records, data collides between parallel
  workers, or hard-coded test data must be removed, or tests collide on the same user or record when
  run in parallel. Not for credentials and secrets (secret-provider-fixture), fixture lifetime
  (fixture-authoring), or mocking responses (network-mocking), or hard-coded passwords
  (secret-provider-fixture).
allowed-tools: Read Grep Glob Edit(src/data/**) Write(src/data/**) Bash(npx tsc --noEmit)
---

# Data factory authoring

Every test brings its own data and takes it away again.

## Non-negotiables
- Synthetic data only: never copy production or personal data; use reserved domains such as `example.test`.
- Uniqueness from `workerIndex` plus a random suffix; no fixed ids shared across tests.
- Every create registers its cleanup in fixture teardown.

## Inputs and outputs
- **In:** the entity schema or API
- **Out:** `src/data/<entity>.factory.ts`

## Procedure
1. Model the minimum valid entity; allow overrides.
2. Seed values with `testInfo.workerIndex` and a random suffix.
3. Create through the API where possible; register cleanup.
4. Expose the factory through a fixture.

## Verify
- two workers produce disjoint ids
- `no-hardcoded-sensitive` passes

## Evidence
Add to the evidence block: entities, cleanup hooks. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Tests run in parallel without data collisions and leave nothing behind.
