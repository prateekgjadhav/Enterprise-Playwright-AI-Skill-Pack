---
name: module-authoring
description: >-
  Composes page objects into a reusable multi-page journey under src/modules — sign-in, checkout,
  onboarding — that returns domain results and is injected through fixtures. Use whenever the same
  multi-step flow appears in three or more specs, or a journey spans several pages and keeps being
  copied. Not for a single page (page-object-authoring), fixture scope and teardown
  (fixture-authoring), or test data (data-factory-authoring).
allowed-tools: Read Grep Glob Edit(src/modules/**) Write(src/modules/**) Bash(npx tsc --noEmit)
---

# Module authoring

A journey is written once and read everywhere.

## Non-negotiables
- Modules receive page objects through their constructor; they never navigate to absolute URLs.
- No assertions about business rules inside modules; return results the spec asserts on.
- Create a module only for flows reused by at least three specs.

## Inputs and outputs
- **In:** the repeated steps and the specs that repeat them
- **Out:** `src/modules/<journey>.module.ts` registered as a fixture

## Procedure
1. Find the duplicated steps across specs.
2. Write the module over existing page objects.
3. Register it in `src/fixtures/index.ts`.
4. Replace the duplicated steps in the specs (through `spec-authoring`).

## Verify
- typecheck clean
- at least three consumers

## Evidence
Add to the evidence block: module name, consumers. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The journey exists once and every consumer uses it.
