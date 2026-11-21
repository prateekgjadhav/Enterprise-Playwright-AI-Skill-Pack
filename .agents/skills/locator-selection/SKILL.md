---
name: locator-selection
description: >-
  Chooses, reviews and repairs locators in the priority getByRole, getByLabel, getByPlaceholder,
  getByText, getByTestId, with CSS only under a registered waiver and XPath forbidden; resolves
  strict-mode violations and converts legacy selectors. Use whenever someone asks which locator to
  use, why an element cannot be found, how to fix a strict mode violation, how to replace XPath or
  CSS, or to audit selectors. Not for page class structure (page-object-authoring), repairing locators
  broken across a run (test-healing), or diagnosing a whole failing run (failure-rca), or exceptions
  to the rules (waiver-registry).
allowed-tools: Read Grep Glob Edit(src/pages/**) Edit(src/modules/**)
---

# Locator selection

A locator is a promise about what the user sees; choose the one that breaks only when the experience changes.

## Non-negotiables
- XPath is forbidden, and so are positional selectors and `.first()` without a business reason.
- CSS is the last resort and needs an entry in `governance/waivers.yaml`; inline `eslint-disable` comments are banned.
- Locators live in page objects and modules, never in specs.

## Inputs and outputs
- **In:** the element description; the page object; an ARIA snapshot (error context or `browser_snapshot`)
- **Out:** the locator and a one-line rationale

## Procedure
1. Walk the priority and stop at the first locator that is unique and meaningful: `getByRole(role, { name })`, `getByLabel`, `getByPlaceholder`, `getByText` (scoped), `getByTestId` (attribute from `framework.testIdAttribute`).
2. Fix strict-mode violations by narrowing to a container, `filter({ hasText })` or `exact: true`.
3. Convert legacy selectors: `//button[text()='Save']` → `getByRole('button', { name: 'Save', exact: true })`; `[data-testid=x]` → `getByTestId('x')`; positional XPath has no mapping — resolve on the page or request a test id.
4. Prove uniqueness with `await expect(locator).toHaveCount(1)` in a quick local check.

## Verify
- `no-xpath` passes
- the locator resolves to exactly one element

## Evidence
Add to the evidence block: strategy chosen per locator. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every changed locator follows the priority and is unique on its page.
