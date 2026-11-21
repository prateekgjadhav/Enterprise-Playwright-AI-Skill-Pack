---
name: page-object-authoring
description: >-
  Creates or extends exactly one page object per route under src/pages — a readonly path, locators
  initialised in the constructor, intent-revealing methods and no assertions — after checking that no
  class or path already covers the route. Use whenever a page or screen has no page object, an
  existing one needs new elements or actions, or duplicate page objects must be consolidated, or a
  field, button or element must be added to a page object such as CartPage. Not for choosing one
  locator (locator-selection), multi-page journeys (module-authoring), or fixture wiring
  (fixture-authoring).
allowed-tools: Read Grep Glob Edit(src/pages/**) Write(src/pages/**) Bash(npx eslint:*) Bash(npx tsc --noEmit)
---

# Page object authoring

One route, one class, one place to fix when the page changes.

## Non-negotiables
- Search for an existing class or `readonly path` first; the `unique-route` rule fails duplicates.
- Initialise locators in the constructor: with `useDefineForClassFields` (Playwright 1.65 and later), a field initialiser that reads `this.page` throws.
- No assertions and no test data inside page objects; no XPath.

## Inputs and outputs
- **In:** the route; an ARIA snapshot or the live page through `locator-selection`
- **Out:** `src/pages/<route>.page.ts`

## Procedure
1. Search `src/pages` for the class name and the path.
2. Declare `readonly path` and `readonly` locator fields; assign them in the constructor.
3. Expose intent methods (`signIn(user)`, `applyCoupon(code)`) that return domain results, not locators, where it helps.
4. Register the page object in `src/fixtures/index.ts` (`fixture-authoring`).
5. Run lint and typecheck.

## Verify
- `unique-route` passes
- typecheck clean

## Evidence
Add to the evidence block: class, path, members added. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The page has exactly one page object and specs reach it only through fixtures.
