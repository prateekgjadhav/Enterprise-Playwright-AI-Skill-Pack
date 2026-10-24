---
name: api-security-review
description: >-
  API-layer security checks with Playwright's request API, aligned to the OWASP API Security Top
  10, for services the team owns and may test: object- and function-level authorisation (BOLA /
  BFLA), unrestricted resource consumption (rate limits), mass assignment, excessive data exposure,
  security misconfiguration, and token handling at the endpoint. Use whenever the user asks for an
  API security assessment, OWASP API Top 10 checks, BOLA/IDOR at the API, broken function-level
  authorisation, API rate-limit or mass-assignment checks, or a "Playwright API security tester".
  Not for UI/browser auth flows (auth-access-control-review), API contracts and schemas
  (api-testing), or JWT internals (jwt-validation-review). Asserts API controls hold; it does not
  exploit them or exfiltrate data.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# API security review

The endpoint-level counterpart to `auth-access-control-review`, mapped to the OWASP API Security
Top 10. Prove each endpoint enforces who may call it, on whose data, how often, and with which
fields — then report gaps.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- Use per-role contexts from a fixture (`apiAs(role)`); never paste tokens into specs; redact tokens in evidence.
- Non-destructive: operate on seeded/disposable resources; assert status before body; never bulk-pull real data to "prove" exposure.
- Each check names its OWASP API category (e.g. API1 BOLA, API5 BFLA, API4 resource consumption). Findings get restricted visibility.

## Coverage map (OWASP API Top 10)
| Category | Check | Expect |
|---|---|---|
| API1 BOLA | user requests another user's object by id | 403/404, no data leak |
| API2 Broken auth | missing/expired token on a protected route | 401 |
| API3 Property-level authz / mass assignment | POST/PATCH with extra fields (`role`, `isAdmin`, `ownerId`) | ignored or rejected; privilege unchanged |
| API3 Excessive data exposure | response includes only needed fields | no secrets/PII beyond contract |
| API4 Resource consumption | bounded burst of requests; huge `page_size` | rate limited (429); size capped |
| API5 BFLA | standard user calls an admin-only function | 403 |
| API8 Misconfiguration | verbose errors, wrong CORS, missing auth on a sibling route | hardened (see security-headers-review) |

## Spec template
```typescript
// @skill-example: fragment — tests/security/api-authz.security.spec.ts
import { test, expect } from '@fixtures';

test('mass assignment cannot escalate role (API3)', { tag: ['@security', '@P0', '@accounts'] }, async ({ apiAs, disposableUser }) => {
  const api = await apiAs('user');
  const res = await api.patch(`/api/users/${disposableUser.id}`, { data: { name: 'New Name', role: 'admin', isAdmin: true } });
  expect(res.status(), await res.text()).toBeLessThan(500);
  const after = await (await api.get(`/api/users/${disposableUser.id}`)).json();
  expect(after.role).not.toBe('admin');                        // extra fields ignored/rejected
});

test('list endpoint enforces a sane page size (API4)', { tag: ['@security', '@P1', '@accounts'] }, async ({ apiAs }) => {
  const res = await (await apiAs('user')).get('/api/users?page_size=1000000');
  expect([200, 400, 422]).toContain(res.status());
  if (res.ok()) expect((await res.json()).items.length).toBeLessThanOrEqual(200); // capped
});
```

## Procedure
1. Confirm authorisation and environment; enumerate endpoints and their intended roles/owners (OpenAPI or routes).
2. For each, add BOLA, BFLA and broken-auth cases with fixture roles and disposable resources.
3. Add mass-assignment, data-exposure and resource-consumption (bounded burst, oversized page) checks.
4. Pull misconfiguration/CORS/error hygiene from `security-headers-review`; token internals from `jwt-validation-review`.
5. Run `--project=security`, then `npm run verify`; classify findings and route fixes to `secure-code-review`.

## Definition of Done
- Every in-scope endpoint has object- and function-level authz and a broken-auth case; each names its API category.
- Mass-assignment, data-exposure and resource-consumption checks present; attempts bounded and non-destructive.
- Tokens redacted; confirmed issues routed to code review; verify green.
