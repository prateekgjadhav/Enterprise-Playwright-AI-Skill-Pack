---
name: visual-testing
description: >-
  Visual regression and screenshot comparison testing with Playwright: toHaveScreenshot on pages
  and components, masking dynamic content, disabling animations, stable baselines generated in
  the pinned Playwright container, per-platform snapshot handling, and a reviewed update process.
  Use whenever the user asks for visual tests, screenshot comparison, pixel diffs, layout or style
  regression checks, updating or reviewing baselines, or fixing flaky screenshots. Not for
  functional assertions (playwright-test-generation) or accessibility (accessibility-testing).
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Visual testing

A screenshot test should fail only when a person would notice a difference.

## Non-negotiables
- Generate and compare baselines **in the pinned Playwright container**, never on a developer laptop, so fonts and rendering match CI.
- Mask or hide anything that changes run to run: dates, avatars, ads, carousels, live counters.
- Animations disabled; wait for the page's ready indicator, never for time.
- Baseline updates (`--update-snapshots`) need the user's approval and a reviewed diff.

## Template
```typescript
// @skill-example: fragment — tests/visual/cart.visual.spec.ts
import { test, expect } from '@fixtures';

test('cart summary matches the baseline', { tag: ['@visual', '@P2', '@checkout'] }, async ({ cartPage, checkoutModule }) => {
  await checkoutModule.openCartWithItems(2);
  await expect(cartPage.summaryPanel).toHaveScreenshot('cart-summary.png', {
    mask: [cartPage.deliveryDate, cartPage.recommendations],
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
```
Set defaults once in `playwright.config.ts` (`expect.toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 }`) and keep visual tests in their own `visual` project so they can be run and updated separately.

## Choosing scope
| Scope | Use when |
|---|---|
| Component (`locator.toHaveScreenshot`) | most cases: stable, small diffs, easy review |
| Full page (`page.toHaveScreenshot({ fullPage: true })`) | layout-critical pages only |
| Several viewports | responsive breakpoints that matter to the business (one project per viewport) |

## Procedure
1. Pick components or pages whose look matters; avoid snapshotting everything.
2. Make the state deterministic: fixed data from factories, masks for dynamic regions, fonts loaded.
3. Create baselines in the container: `docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v<version>-noble npx playwright test --project=visual --update-snapshots`.
4. Commit baselines with the test; review the images in the pull request.
5. On a failure, open the HTML report's diff view. A real change → update with approval; noise → mask or tighten the state, never just raise the threshold.

## Definition of Done
- Tests pass three times in the container.
- Every dynamic region is masked; thresholds are at or below the defaults.
- Baseline changes were approved and reviewed.
