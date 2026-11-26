---
name: migration-analysis
description: >-
  Analyses a Cypress, Selenium, WebdriverIO, TestCafe or Robot Framework suite read-only and maps its
  commands, waits, selectors, data and CI to Playwright idioms with effort, risks and an order of
  migration. Use whenever a team plans to move another framework's tests to Playwright or asks how
  much a migration costs. Not for writing the migrated specs (spec-authoring), selector conversion
  details (locator-selection), or CI design (ci-workflow-authoring).
allowed-tools: Read Grep Glob Write(.claude/out/**)
---

# Migration analysis

Migrate behaviour, not syntax: map intent, then rewrite idiomatically.

## Non-negotiables
- Read-only; never delete or move legacy tests.
- Explicit waits and sleeps map to web-first assertions, never to `waitForTimeout`.

## Inputs and outputs
- **In:** the legacy suite
- **Out:** `.claude/out/migration-plan.md`

## Procedure
1. Inventory files, commands, custom commands, page objects and waits.
2. Map each pattern: `cy.get().should()` → `expect(locator).to…`; `driver.findElement(By.xpath)` → role locators; `cy.intercept` → `page.route`.
3. Estimate effort per area and order by risk.
4. List blockers: custom plugins, iframes, multiple tabs, downloads.

## Verify
- every legacy file is accounted for

## Evidence
Add to the evidence block: file counts, effort, blockers. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- A reviewed plan exists before any spec is rewritten.
