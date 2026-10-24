---
name: playwright-test-generation
description: >-
  Primary code-generation skill for Playwright TypeScript tests: feature, smoke, regression,
  functional and end-to-end flows. Turns a requirement, ticket, user story, acceptance criteria or
  plain description into a test plan, test cases and specs that use the repository's fixtures,
  page objects and modules, grounding the plan in past test knowledge when a knowledge MCP server
  is configured. Use whenever the user asks to write, add, generate, automate or extend UI or E2E
  tests, cover a story or ticket, or turn test cases into automation. Not for selectors alone
  (locator-strategy), page object design (page-object-engineering), API-only tests (api-testing)
  or fixing a failing test (defect-analysis).
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Playwright test generation

Generate tests that look like the best existing tests in this repository, not like a tutorial.

## Non-negotiables
- Explore before writing: find existing pages, modules, fixtures and similar specs, and reuse them. Never create a second page object for a route.
- Specs import `test` and `expect` from the fixtures entry point (`@fixtures`, or `framework.fixturesImport` in `.agents/qa.config.json`). Never `new` a page or module in a spec.
- Every action sits inside `test.step()`. One behaviour per test.
- Tags through the details object: exactly one of `@P0`/`@P1`/`@P2`, one feature tag, plus suite tags (`@smoke`, `@regression`) as needed.
- Web-first assertions only. No `waitForTimeout`, no `networkidle`, no XPath, no hard-coded data or credentials.
- Never claim a test passes without running it in this session.

## Procedure
1. **Understand the requirement.** If the user gives a ticket key and a tracker MCP server is configured (`requirements.mcpServer`), fetch the item: title, description, acceptance criteria, priority, labels. Number the acceptance criteria AC1..n. Otherwise use the user's description.
2. **Ground in history (optional).** If a knowledge server is configured (`knowledge.mcpServer`), call `rag_search` on the `plans` and `cases` collections with the summary and criteria. Use only hits above `knowledge.minScore`, and cite their ids in the plan. If nothing qualifies, say "no historical grounding". Never invent history.
3. **Plan.** For more than one test, write `test-plan.md`: scope mapped to ACs, approach, environments and roles (not credentials), risks, traceability (AC → cases), knowledge references and open questions. Ask about open questions before writing code for a P0 item.
4. **Design cases.** Cover positive, negative, boundary and permission paths per AC. Cases about an endpoint contract belong to `api-testing`; load, latency or SLA cases to `performance-testing`; auth, roles and input-injection cases to `web-app-security-assessment`, which delegates them to the focused checks. Hand those off.
5. **Explore the UI layer.** List `src/pages` and `src/modules`. Missing pages or locators go to `page-object-engineering` (bottom-up: data → pages → modules → fixtures → specs). When an element's accessible name is unclear and a Playwright MCP server is available, open the page in a test environment and take a snapshot.
6. **Write the spec** in `tests/e2e/<feature>/<behaviour>.spec.ts` following the template below. Data comes from `test-data-management` factories or fixtures; setup state through API fixtures, not the UI.
7. **Run narrowly.** Run `npx playwright test <file> --project=chromium`, then `--repeat-each=3` for new tests. Fix failures from evidence; hand persistent failures to `defect-analysis`.
8. **Verify** with the repository's verify script (lint, typecheck, governance) and report with the Evidence block.

## Spec template
```typescript
// @skill-example: fragment
import { test, expect } from '@fixtures';

test.describe('Checkout coupons', () => {
  test('applies a valid coupon to the cart total', {
    tag: ['@P0', '@checkout', '@smoke'],
    annotation: [{ type: 'requirement', description: 'PROJ-123' }],
  }, async ({ cartPage, checkoutModule, testData }) => {
    const coupon = testData.coupon('valid');
    await test.step('Open a cart with one item', async () => {
      await checkoutModule.openCartWithItems(1);
    });
    await test.step('Apply the coupon', async () => {
      await cartPage.applyCoupon(coupon.code);
    });
    await test.step('Total reflects the discount', async () => {
      await expect(cartPage.discountRow).toContainText(coupon.label);
      await expect(cartPage.total).toHaveText(coupon.expectedTotal);
    });
  });
});
```

## Test types
| Type | Selection | Notes |
|---|---|---|
| Smoke | `@smoke`, a handful of P0 journeys | must run in minutes; no flaky tests allowed |
| Regression | `@regression` | broad, sharded in CI |
| Functional | one feature, many cases | data-driven loops generate one `test()` per row |
| E2E | cross-feature journey | long journeys split into steps, state set through API |

## Definition of Done
- Every AC maps to at least one test (or a stated reason it's manual).
- New specs pass `--repeat-each=3` and the verify script.
- No new page object duplicates an existing route.
- The Evidence block lists the files changed, the commands run and their results, and any risks.
