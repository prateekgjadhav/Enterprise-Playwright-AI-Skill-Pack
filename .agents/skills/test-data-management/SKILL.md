---
name: test-data-management
description: >-
  Dynamic, factory-driven test data for Playwright: data factories, API-based seeding, unique data
  per worker, cleanup in fixture teardown, environment configuration validated at start, and
  secrets kept out of code. Use whenever the user asks to create test data, users, orders or
  accounts for tests, remove hard-coded data, make tests parallel-safe, seed state before a UI
  test, clean up after tests, or manage environment variables and credentials for tests. Not for
  API contract testing (api-testing) or selector work (locator-strategy).
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Test data management

Every test owns its data: it creates what it needs, uses unique values, and cleans up.

## Non-negotiables
- **No hard-coded test data** in specs or pages: no literal emails, card numbers, passwords or absolute URLs. Governance blocks them.
- **Secrets only from the environment.** `.env` is local and gitignored; CI uses its secret store. Never read or print `.env` contents.
- **Unique per test and worker.** Factories add a worker-scoped suffix so parallel tests never collide.
- **Set state through the API**, not the UI, and clean it up in the same fixture.

## Structure
| Piece | Location | Role |
|---|---|---|
| Environment schema | `src/config/env.ts` | validates required variables at start (fail fast with a clear message) |
| Factories | `src/data/factories/` | build realistic objects with `@faker-js/faker`, overridable fields |
| Static reference data | `src/data/static/*.json` | non-sensitive lookups (countries, product codes) |
| Data fixtures | `src/fixtures/data.fixture.ts` | inject factories, `credentials`, seeded entities with teardown |

## Templates
```typescript
// @skill-example: fragment — src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';
const Env = z.object({
  BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  TEST_USER_EMAIL: z.string().min(1),
  TEST_USER_PASSWORD: z.string().min(1),
});
const parsed = Env.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid test environment:\n${parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`);
export const env = parsed.data;
```
```typescript
// @skill-example: fragment — src/data/factories/UserFactory.ts
import { faker } from '@faker-js/faker';
export type NewUser = { email: string; name: string; role: 'user' | 'admin' };
export const buildUser = (workerIndex: number, overrides: Partial<NewUser> = {}): NewUser => ({
  email: `qa+w${workerIndex}-${faker.string.alphanumeric(8).toLowerCase()}@example.test`,
  name: faker.person.fullName(),
  role: 'user',
  ...overrides,
});
```
```typescript
// @skill-example: fragment — src/fixtures/data.fixture.ts
import { test as base } from '@playwright/test';
import { buildUser, type NewUser } from '@data/factories/UserFactory';

export const test = base.extend<{ seededUser: NewUser & { id: string } }>({
  seededUser: async ({ request }, use, testInfo) => {
    const user = buildUser(testInfo.workerIndex);
    const res = await request.post('/api/test-support/users', { data: user });
    if (!res.ok()) throw new Error(`Seeding failed: ${res.status()} ${await res.text()}`);
    const created = (await res.json()) as { id: string };
    await use({ ...user, id: created.id });
    await request.delete(`/api/test-support/users/${created.id}`);
  },
});
```

## Procedure
1. Find what the test needs and whether a factory or fixture already provides it.
2. Add or extend a factory; keep fields overridable; derive uniqueness from `testInfo.workerIndex`.
3. Seed through the API in a fixture and tear down after `use()`. If the app has no seeding endpoint, record that as a risk and propose one.
4. Replace every literal in the affected specs with factory values or `credentials`.
5. Add any new variable to the environment schema and to `.env.example` (key only).
6. Run the tests in parallel (`--workers=4 --repeat-each=2`) to prove isolation.

## Definition of Done
- No literals flagged by governance in the changed files.
- Tests pass in parallel and leave no data behind.
- New variables are in the schema and `.env.example`.
