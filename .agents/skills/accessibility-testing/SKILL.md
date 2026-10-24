---
name: accessibility-testing
description: >-
  WCAG accessibility validation with Playwright: automated axe-core scans scoped to WCAG 2.2 A and
  AA, keyboard navigation and focus order tests, accessible-name checks with aria snapshots, and
  reporting of violations with impact and remediation. Use whenever the user asks for
  accessibility, a11y or WCAG tests, keyboard-only navigation checks, screen reader or ARIA checks,
  focus management, colour contrast or an accessibility audit of a page. Not for visual
  regression (visual-testing) or general functional tests (playwright-test-generation).
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Accessibility testing

Automated scans catch part of what matters. Keyboard and accessible-name tests catch more. Say
which is which in the report.

## Non-negotiables
- Scan with `@axe-core/playwright` against `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` tags.
- Never disable a rule or exclude a region without a ticket reference in a comment.
- Critical user journeys get a keyboard-only test: reachable, operable, visible focus, logical order, no traps.
- Report that automated scans do not prove conformance; list what needs manual review.

## Templates
```typescript
// @skill-example: fragment — tests/a11y/checkout.a11y.spec.ts
import { test, expect } from '@fixtures';
import AxeBuilder from '@axe-core/playwright';

test('checkout has no WCAG A/AA violations', { tag: ['@a11y', '@P1', '@checkout'] }, async ({ page, checkoutPage }) => {
  await checkoutPage.goto();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await test.info().attach('axe-results.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  expect(results.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length} nodes`)).toEqual([]);
});

test('checkout is operable by keyboard alone', { tag: ['@a11y', '@P1', '@checkout'] }, async ({ page, checkoutPage }) => {
  await checkoutPage.goto();
  await page.keyboard.press('Tab');
  await expect(checkoutPage.skipToContentLink).toBeFocused();
  await checkoutPage.tabTo(checkoutPage.placeOrderButton);
  await expect(checkoutPage.placeOrderButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(checkoutPage.confirmationHeading).toBeVisible();
});
```
Structure checks: `await expect(page.getByRole('navigation')).toMatchAriaSnapshot(...)` pins landmarks and names for key regions.

## Procedure
1. List the journeys and pages in scope; start with P0 flows.
2. Add an axe scan per page state that matters (after dialogs open, after validation errors appear).
3. Add keyboard tests for each journey: tab order, Enter and Space activation, Escape closes dialogs, focus returns after closing.
4. Group violations by rule and impact (critical, serious, moderate, minor) with the affected selectors and the fix.
5. Record what still needs manual review: screen reader announcements, meaningful alt text, reading order, cognitive load.

## Definition of Done
- Scans attached to the report; zero critical or serious violations, or each one ticketed.
- Keyboard tests pass for every P0 journey.
- The report separates automated findings from items needing manual review.
