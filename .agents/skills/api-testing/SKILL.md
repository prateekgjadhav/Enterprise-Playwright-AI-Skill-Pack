---
name: api-testing
description: >-
  API, contract and schema validation testing with Playwright's request API: per-role API contexts,
  status-before-body assertions, Zod schema validation, negative and authorisation cases, and
  API-based setup for UI tests. Use whenever the user asks to test REST or HTTP endpoints, validate
  responses or schemas, check contracts between services, test API authentication or permissions at
  the endpoint level, or convert RestAssured, requests or Robot RequestsLibrary tests. Not for load
  testing (performance-testing), OWASP attack patterns (api-security-review) or UI flows
  (playwright-test-generation).
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# API testing

Fast, deterministic checks at the boundary. Most behaviour belongs here before it belongs in a
browser.

## Non-negotiables
- Assert the status **before** parsing the body, and include the body in the failure message.
- Validate response shape with a schema, not field-by-field spot checks.
- Use per-role contexts from a fixture (`apiAs(role)`); never paste tokens into specs.
- Every endpoint gets at least one negative case (invalid input, missing auth, wrong role).
- API tests live in `tests/api/` and run in the `api` project, without launching a browser.

## Fixture
```typescript
// @skill-example: fragment — src/fixtures/api.fixture.ts
import { test as base, type APIRequestContext } from '@playwright/test';
import { env } from '@config/env';
type Role = 'user' | 'admin' | 'anonymous';
const STATE: Record<Exclude<Role, 'anonymous'>, string> = { user: 'playwright/.auth/user.json', admin: 'playwright/.auth/admin.json' };

export const test = base.extend<{ apiAs: (role: Role) => Promise<APIRequestContext> }>({
  apiAs: async ({ playwright }, use) => {
    const opened: APIRequestContext[] = [];
    await use(async role => {
      const ctx = await playwright.request.newContext({
        baseURL: env.API_BASE_URL,
        storageState: role === 'anonymous' ? { cookies: [], origins: [] } : STATE[role],
      });
      opened.push(ctx);
      return ctx;
    });
    await Promise.all(opened.map(c => c.dispose()));
  },
});
```

## Spec template
```typescript
// @skill-example: fragment — tests/api/orders/get-order.spec.ts
import { test, expect } from '@fixtures';
import { z } from 'zod';
const Order = z.object({ id: z.string(), status: z.enum(['NEW', 'PAID', 'SHIPPED']), total: z.number().nonnegative() });

test.describe('GET /api/orders/:id', () => {
  test('returns the order for its owner', { tag: ['@api', '@P1', '@orders'] }, async ({ apiAs, seededOrder }) => {
    const api = await apiAs('user');
    const res = await test.step('Request the order', () => api.get(`/api/orders/${seededOrder.id}`));
    expect(res.status(), await res.text()).toBe(200);
    expect(Order.safeParse(await res.json()).success).toBe(true);
  });
  test('rejects an anonymous caller', { tag: ['@api', '@P1', '@orders'] }, async ({ apiAs, seededOrder }) => {
    const anon = await apiAs('anonymous');
    expect((await anon.get(`/api/orders/${seededOrder.id}`)).status()).toBe(401);
  });
});
```

## Coverage per endpoint
| Case | Expect |
|---|---|
| Happy path | documented status and a schema-valid body |
| Invalid input | 400 or 422 with a useful error, never 500 |
| Missing or expired auth | 401 |
| Wrong role or someone else's resource | 403 or 404 (no data leak) |
| Not found | 404 |
| Idempotency or duplicates (where relevant) | 409, or the same result on retry |

## Procedure
1. List the endpoints in scope (OpenAPI spec, route files, or the requirement).
2. Define schemas once in `src/api/schemas/`.
3. Write cases from the table, with data from `test-data-management`.
4. Contract checks between services: pin the schema the consumer relies on and fail on breaking changes (removed fields, changed types, new required inputs).
5. Run `npx playwright test --project=api`, then the verify script.

## Definition of Done
- Every endpoint in scope has a happy path, an invalid-input case and an auth case.
- Status-before-body, schema validation, no tokens in code.
- The `api` project passes in parallel.
