---
name: spec-authoring
description: >-
  Writes or extends Playwright specs from approved scenarios — importing test and expect from
  @fixtures, receiving page objects and modules by injection, using web-first assertions, relative
  navigation and exactly one priority and one feature tag per test. Use whenever someone asks to
  write, generate, add or extend a Playwright test or spec, or to implement approved scenarios as
  code, or someone asks to add a smoke, regression or end-to-end test. Not for designing scenarios
  (scenario-design), creating page objects (page-object-authoring), API-only tests
  (api-test-authoring), or repairing a failing test (test-healing).
allowed-tools: Read Grep Glob Edit(tests/**) Write(tests/**) Bash(npx eslint:*) Bash(npx tsc --noEmit) Bash(npx playwright test --list)
---

# Spec authoring

Specs state intent; page objects, modules and fixtures carry the mechanics.

## Non-negotiables
- `import { test, expect } from '@fixtures'`; never `new SomePage()` in a spec.
- No XPath, `waitForTimeout`, `networkidle`, absolute URLs or literal credentials.
- No `test.only`, `test.skip` or `test.fixme` without a registered waiver; never weaken an assertion to make a test pass.
- Exactly one `@P0`/`@P1`/`@P2` tag and one feature tag per test.

## Inputs and outputs
- **In:** approved scenarios; existing page objects, modules, fixtures
- **Out:** `tests/<area>/<feature>.spec.ts`

## Procedure
1. Reuse first: search `src/pages`, `src/modules`, `src/fixtures` and nearby specs.
2. Build bottom-up when something is missing: data factory, page object, module, fixture — through their skills.
3. Write the spec with web-first assertions (`await expect(locator).toBeVisible()`), one behaviour per test.
4. Run `npx eslint <file>` and `npx tsc --noEmit`; confirm discovery with `npx playwright test --list`.
5. Run the new tests narrowly with `--repeat-each=3` (managed settings ask first); report results in the evidence block.

## Verify
- lint and typecheck clean
- the test is listed
- new tests pass three times

## Evidence
Add to the evidence block: spec paths, tags, repeat results. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Specs pass governance, use only existing members (KPI hallucination check), and passed three times.
