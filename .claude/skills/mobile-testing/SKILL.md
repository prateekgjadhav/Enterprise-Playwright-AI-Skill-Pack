---
name: mobile-testing
description: >-
  Mobile-web testing with Playwright device emulation, for applications the team owns: emulated
  iOS/Android viewports and user agents, touch and tap gestures, responsive layout and breakpoint
  checks, orientation, and optional real-device cloud grids. Use whenever the user asks to test
  mobile web, responsive design, touch interactions, small-screen layouts, device-specific
  rendering, or to run the suite on emulated phones and tablets. Not for native app automation
  (out of Playwright's scope — use a device framework), desktop visual diffs (visual-testing), or
  Core Web Vitals budgets (performance-testing).
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Mobile testing

Prove the application works on the screens and inputs most users actually have. Playwright emulates
device viewport, user agent and touch; real-device grids cover the gaps emulation can't.

## Non-negotiables
- Use Playwright's `devices` descriptors for emulation; declare the device in a dedicated `mobile` project, don't hand-roll viewports in specs.
- Touch targets and gestures use `tap()`/touch events, not `click()`, when the device has touch enabled.
- Locators stay in page objects in priority order (governance); reuse existing page objects — no mobile-only duplicates of a route.
- State device and viewport in the report; emulation is not a substitute for a real-device check on release-critical flows.

## Coverage map
| Area | Check |
|---|---|
| Viewport & breakpoints | layout renders without horizontal overflow at phone and tablet widths; breakpoint-specific elements appear/hide |
| Touch & gestures | tap, swipe/scroll, long-press where used; no reliance on hover-only affordances |
| Orientation | portrait and landscape both usable |
| Input | virtual-keyboard-friendly forms; correct input types; no desktop-only interactions |
| Device rendering | representative iOS (WebKit) and Android (Chromium) devices |
| Real device (release) | critical journeys verified on a real-device grid where configured |

## Spec template
```typescript
// @skill-example: fragment — playwright.config.ts (mobile project)
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  projects: [
    { name: 'mobile-ios', testDir: 'tests/mobile', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-android', testDir: 'tests/mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```
```typescript
// @skill-example: fragment — tests/mobile/checkout.mobile.spec.ts
import { test, expect } from '@fixtures';

test('checkout is usable on a phone', { tag: ['@mobile', '@P1', '@checkout'] }, async ({ page, checkoutPage }) => {
  await checkoutPage.open();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.evaluate(() => document.documentElement.clientWidth)); // no h-overflow
  await checkoutPage.payNow.tap();                       // touch, not click
  await expect(checkoutPage.confirmation).toBeVisible();
});
```

## Procedure
1. Pick representative devices (one WebKit/iOS, one Chromium/Android) and add a `mobile` project per device.
2. Reuse page objects; write journeys in `tests/mobile/` with touch interactions and breakpoint assertions.
3. Check orientation and virtual-keyboard behaviour on form-heavy flows.
4. For release-critical journeys, run on a real-device grid if one is configured; record device coverage.
5. Run `npx playwright test --project=mobile-ios --project=mobile-android`, then `npm run verify`.

## Definition of Done
- A `mobile` project per representative device; critical journeys covered with touch and breakpoint checks.
- No horizontal overflow at target widths; no hover-only dependencies; orientation handled.
- Device and viewport recorded; verify green.
