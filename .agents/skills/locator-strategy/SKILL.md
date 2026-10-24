---
name: locator-strategy
description: >-
  Centralised selector governance for Playwright: chooses, reviews and fixes locators using the
  priority getByRole, getByLabel, getByPlaceholder, getByText, getByTestId, with CSS only as a
  ticketed last resort and XPath forbidden. Converts legacy Selenium, Robot Framework or Cypress
  selectors, resolves strict-mode violations, and upgrades brittle locators against the live page.
  Use whenever the user asks which locator to use, why an element can't be found, how to fix a
  strict mode violation, how to replace XPath or CSS selectors, or to audit selectors. Not for page
  class structure (page-object-engineering) or diagnosing a whole failing run (defect-analysis).
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Locator strategy

A locator is a promise about what the user sees. Choose the one that breaks only when the
experience really changes.

## Non-negotiables
- **XPath is forbidden**, and so are positional selectors (`nth-child`, `:nth(3)`) and `.first()` without a business reason.
- Walk the priority below in order and stop at the first locator that is unique and meaningful; CSS is the last resort and needs an `eslint-disable-next-line` that cites a ticket.
- Locators live in page objects, never in specs.

## Priority (in order)
1. `getByRole(role, { name })` — buttons, links, headings, form controls, regions. Add `exact: true` when names overlap; `level` for headings.
2. `getByLabel(label)` — form fields with a visible or `aria-label` label.
3. `getByPlaceholder(text)` — only when there is no label (and raise the missing label as an accessibility issue).
4. `getByText(text)` — non-interactive content, scoped to a region.
5. `getByTestId(id)` — when the UI has no stable accessible name. The attribute comes from `testIdAttribute` in `playwright.config.ts`.
6. CSS — last resort, with an `eslint-disable-next-line` that cites a ticket.

## Fixing problems
| Symptom | Fix |
|---|---|
| strict mode violation: resolved to N elements | narrow by container (`page.getByRole('dialog').getByRole('button', { name: 'Save' })`), `filter({ hasText })`, or `exact: true` |
| element not found but visible to a person | check the accessible name in the aria snapshot (error context, or Playwright MCP `browser_snapshot`); the name differs from the visible text |
| works locally, fails in CI | timing, not locator — remove any wait, use a web-first assertion; check viewport-dependent rendering |
| breaks after copy changes | prefer a role plus a stable test id for content that marketing edits often |

## Converting legacy selectors
| Legacy | Playwright |
|---|---|
| `//button[text()='Save']`, `By.linkText('Help')`, `link=Help` | `getByRole('button' or 'link', { name, exact: true })` |
| `//label[text()='Email']/following-sibling::input` | `getByLabel('Email')` |
| `[placeholder='Search']` | `getByPlaceholder('Search')` |
| `//*[contains(text(),'Welcome')]`, `text=Welcome` | `getByText('Welcome')`, scoped |
| `[data-testid='cart-total']`, `//*[@data-testid='cart-total']` | `getByTestId('cart-total')` |
| `#email`, `By.id`, `By.name`, `.btn-primary` | low confidence: confirm the role and name on the live page, then upgrade |
| `//div[3]/span` (positional) | no mapping: resolve against the live page or request a test id |

## Procedure
1. Read the target in context: the page object, the screen, and the aria snapshot if available.
2. Walk the priority list and stop at the first locator that is unique and meaningful.
3. Prove uniqueness: `await expect(locator).toHaveCount(1)` in a quick check, or the MCP snapshot.
4. Put the locator in the page object, never in the spec.
5. Audit mode: grep `src/pages` for `locator(`, `xpath`, `nth`, `.first()`; report each with the suggested replacement and confidence.

## Definition of Done
- Every changed locator follows the priority and is unique on the page.
- No XPath, no positional selectors, no unexplained `.first()`.
- CSS fallbacks carry a ticket reference.
