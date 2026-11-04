---
name: page-object-engineering
description: >-
  Designs and maintains the page object architecture for a Playwright TypeScript framework: page
  classes that encapsulate locators and atomic actions, modules that hold business workflows,
  shared components, and the fixtures that inject them. Use whenever the user asks to create,
  refactor, split, merge or review page objects, page classes, components or modules, add locators
  to a page, or reduce duplication between pages. Not for choosing a specific selector
  (locator-strategy), writing the test itself (playwright-test-generation) or governance audits
  (framework-governance).
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Page object engineering

Pages describe what is on the screen. Modules describe what a user does. Specs describe what
should be true. Keep the three apart.

## Non-negotiables
- **One page object per route or screen.** Search before creating (`grep -rn "path = '/route'" src/pages`). Duplicates are a governance failure.
- **Pages hold locators and atomic actions only.** No assertions, no `expect` import, no conditionals, no multi-step business logic.
- **Modules hold workflows** (`doLogin()`, `completeCheckout()`); conditionals and multi-page flows live here.
- **Fixtures construct everything.** Pages and modules are injected; specs never call `new`.
- **No waits.** A page exposes a ready indicator instead of waiting for network idle.

## Layer map
| Layer | Folder | Holds | May import |
|---|---|---|---|
| Pages | `src/pages/` | `readonly` locators, atomic actions (`fill`, `click`, `goto`) | Playwright types, other pages' components |
| Components | `src/pages/components/` | reusable widgets (tables, dialogs, date pickers) | Playwright types |
| Modules | `src/modules/` | business workflows across pages | pages, data, utilities |
| Fixtures | `src/fixtures/` | construction and lifetime of pages, modules, API contexts | everything above |
| Specs | `tests/` | assertions and steps | fixtures only |

## Templates
```typescript
// @skill-example: fragment — src/pages/BasePage.ts
import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  abstract readonly path: string;
  constructor(protected readonly page: Page) {}
  /** A user-visible element proving the page is usable. Replaces network-idle waits. */
  protected abstract readyIndicator(): Locator;
  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.readyIndicator().waitFor({ state: 'visible' });
  }
}
```
```typescript
// @skill-example: fragment — src/pages/CartPage.ts
import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly path = '/cart';
  readonly couponInput = this.page.getByLabel('Coupon code');
  readonly applyCouponButton = this.page.getByRole('button', { name: 'Apply coupon' });
  readonly discountRow = this.page.getByRole('row', { name: /discount/i });
  readonly total = this.page.getByTestId('cart-total');
  protected readyIndicator(): Locator { return this.applyCouponButton; }
  async applyCoupon(code: string): Promise<void> {
    await this.couponInput.fill(code);
    await this.applyCouponButton.click();
  }
}
```
```typescript
// @skill-example: fragment — src/fixtures/pages.fixture.ts
import { test as base } from '@playwright/test';
import { CartPage } from '@pages/CartPage';
import { CheckoutModule } from '@modules/CheckoutModule';

export const test = base.extend<{ cartPage: CartPage; checkoutModule: CheckoutModule }>({
  cartPage: async ({ page }, use) => { await use(new CartPage(page)); },
  checkoutModule: async ({ page, cartPage }, use) => { await use(new CheckoutModule(page, cartPage)); },
});
```
The fixtures index merges the page, API, data and guard fixtures with `mergeTests` and re-exports `expect`.

## Procedure
1. Inventory: list existing pages, components and modules, and the routes they claim (`readonly path`).
2. Decide: a new screen means a new page; a repeated widget means a component; a repeated multi-step flow means a module method.
3. Write the page bottom-up: locators first (ask `locator-strategy` when a selector is unclear), then atomic actions, then the ready indicator.
4. Register it in the pages fixture and the barrel export.
5. Refactors: move one responsibility at a time, keep public names stable, and run the affected specs after each move.
6. Run the verify script; dependency rules must show pages as leaves.

## Definition of Done
- [ ] No `expect` import and no assertions in `src/pages/**`.
- [ ] Every locator is `readonly` and follows the locator priority.
- [ ] One class per route; components reused rather than copied.
- [ ] Modules contain the conditionals; pages contain none.
- [ ] Fixtures are the only constructors.
