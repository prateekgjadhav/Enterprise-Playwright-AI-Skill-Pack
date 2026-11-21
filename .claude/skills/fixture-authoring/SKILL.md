---
name: fixture-authoring
description: >-
  Adds or changes typed fixtures in src/fixtures so specs receive page objects, modules, factories,
  the secret provider and the egress guard by injection, with the right scope and teardown. Use
  whenever a spec needs a new dependency, setup is copied between specs, or a fixture leaks state or
  teardown fails, or a page object or client must be injected into specs. Not for writing page objects
  (page-object-authoring), credentials resolution (secret-provider-fixture), or authenticated state
  (auth-setup-project).
allowed-tools: Read Grep Glob Edit(src/fixtures/**) Bash(npx tsc --noEmit)
---

# Fixture authoring

Dependencies arrive by injection; nothing is constructed inside a test.

## Non-negotiables
- Never bypass the automatic `egressGuard` fixture or read secrets other than through `secretProvider`.
- Choose worker or test scope deliberately; teardown runs in `finally`.
- One `@fixtures` entry point: `src/fixtures/index.ts`.

## Inputs and outputs
- **In:** the dependency
- **Out:** a typed fixture in `src/fixtures/`

## Procedure
1. Decide scope: worker for expensive shared clients, test for page-bound objects.
2. Extend the base `test` in `src/fixtures/index.ts`.
3. Write teardown with `try/finally`.
4. Typecheck and use it from one spec.

## Verify
- typecheck clean
- fixture used at least once

## Evidence
Add to the evidence block: fixture name and scope. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The dependency is injected and cleaned up reliably.
