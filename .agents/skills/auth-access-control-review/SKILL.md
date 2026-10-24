---
name: auth-access-control-review
description: >-
  Authentication, authorisation and session security checks with Playwright, for applications the
  team owns and may test: access control and IDOR (403/404), privilege-escalation prevention,
  session and cookie flags, login rate limiting and lockout, logout invalidation, session renewal
  on login, token-leakage checks, and password-reset non-enumeration. Covers OWASP A01 and A07.
  Use whenever the user asks for auth tests, authorisation or permission checks, role-based access
  tests, IDOR, session or cookie security, MFA enforcement, brute-force protection, or a
  "Playwright auth/session security tester". Not for injection (injection-handling-review), headers
  and CORS (security-headers-review), or endpoint schemas (api-testing). This asserts controls
  hold; it does not brute-force credentials or bypass authentication.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Auth & access control review

Prove that identity and permission boundaries hold. Every check asserts the application
*rejects* the wrong thing; none of them attempt to defeat a control.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- Use seeded **test accounts** from fixtures (`apiAs(role)`); never real users, never real credentials in code.
- Control tests use a **bounded** number of attempts (enough to trip the control, then stop); this is a control check, not a credential attack. No password lists, no spraying.
- Never print tokens or session values; redact in evidence. Findings get restricted visibility.
- Each check names its OWASP category (A01 or A07).

## Coverage map
| OWASP | Check | Expect |
|---|---|---|
| A01 | Standard user reads another user's resource (IDOR) | 403 or 404, no data leak |
| A01 | Standard user calls an admin-only endpoint | 403 |
| A01 | User attempts to raise their own role / edit someone else's record | 403, role unchanged |
| A01 | Path/parameter variations (`//`, encoding, trailing data) on a protected route | still enforced |
| A07 | Repeated failed logins (bounded) | rate limited (429) and/or lockout |
| A07 | Session cookie attributes | `Secure`, `HttpOnly`, `SameSite` |
| A07 | Session after logout | invalidated; the old cookie no longer authenticates |
| A07 | Session id before vs after login | renewed (no fixation) |
| A07 | Password reset for unknown vs known email | identical response (no account enumeration) |
| A07 | Token in URL / referrer / storage | never present |

## Spec template
```typescript
// @skill-example: fragment — tests/security/access-control.security.spec.ts
import { test, expect } from '@fixtures';

test('a standard user cannot read another user\'s order (A01)', { tag: ['@security', '@P0', '@orders'] }, async ({ apiAs, otherUsersOrder }) => {
  const api = await apiAs('user');
  expect([403, 404]).toContain((await api.get(`/api/orders/${otherUsersOrder.id}`)).status());
});

test('the session cookie is hardened and dies on logout (A07)', { tag: ['@security', '@P1', '@auth'] }, async ({ page, loginAs }) => {
  await loginAs('user');
  const cookie = (await page.context().cookies()).find(c => c.name === 'session');
  expect(cookie, 'session cookie present').toBeTruthy();
  expect(cookie!.httpOnly && cookie!.secure).toBe(true);
  expect(cookie!.sameSite).toMatch(/Lax|Strict/);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
```

## Procedure
1. Confirm authorisation and environment; list the roles and protected resources in scope.
2. For each protected resource, add the negative access cases from the table with fixture roles.
3. Add the session and account-safety checks (cookie flags, logout, renewal, reset enumeration).
4. For rate-limit/lockout, loop a small bounded count and assert the control engages; never exceed it.
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Every protected resource has IDOR and wrong-role cases; each names A01/A07.
- Session hardening, logout invalidation, renewal and reset-enumeration checks present.
- No real credentials, no unbounded attempts, tokens redacted; verify green.
