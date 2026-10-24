---
name: csrf-protection-review
description: >-
  Cross-site request forgery protection checks with Playwright, for applications the team owns and
  may test: assert that state-changing requests require a valid anti-CSRF token, that a missing or
  wrong token is rejected, that session cookies use SameSite, and that unsafe methods reject
  cross-origin/forged requests. Covers the CSRF part of OWASP A01/A05. Use whenever the user asks
  for CSRF testing or analysis, anti-CSRF token checks, SameSite cookie checks, or state-changing
  request protection. Not for read-side access control (auth-access-control-review), header hygiene
  in general (security-headers-review), or server-side URL fetching (ssrf-defence-review). This
  asserts protections are enforced; it does not build a working CSRF attack against a victim.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# CSRF protection review

Confirm that a logged-in user's state can only be changed by requests the application actually
intended. The checks assert the server *rejects* unprotected or forged state changes using the
test's own authenticated context — they never target a real victim.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- Use seeded test accounts; operate on disposable fixture data for any state-changing probe, and prefer idempotent or reversible actions. Never change real users' data.
- Assert rejection of the missing/forged case; do not then craft or host a working exploit page aimed at anyone. Findings get restricted visibility.
- Each check names the category (CSRF under A01/A05).

## Coverage map
| Check | Expect |
|---|---|
| State-changing request **without** the CSRF token | rejected (403) |
| Request with a **wrong/old** token | rejected (403) |
| Request with the **valid** token (control) | succeeds (baseline) |
| Session cookie `SameSite` | `Lax` or `Strict` |
| Unsafe method from a **foreign Origin/Referer** | rejected |
| Token scope | per-session/per-user, not a fixed global value |

## Spec template
```typescript
// @skill-example: fragment — tests/security/csrf-protection.security.spec.ts
import { test, expect } from '@fixtures';
import { buildUser } from '@data/factories/UserFactory';

test('changing email requires a valid CSRF token (A01/A05)', { tag: ['@security', '@P1', '@account'] }, async ({ apiAs, disposableUser }) => {
  const api = await apiAs('user');                           // authenticated context from a fixture
  const forged = await api.post('/api/account/email', {
    data: { userId: disposableUser.id, email: buildUser().email },
    // governance-disable-next-line no-hard-coded-data -- a forged origin is the test input (SEC-102)
    headers: { origin: 'https://evil.example' },             // no/bad CSRF token, foreign origin
  });
  expect(forged.status(), await forged.text()).toBe(403);     // server rejects the forged change
});
```

## Procedure
1. Confirm authorisation and environment; list the state-changing endpoints/forms in scope.
2. For each, assert the missing-token and wrong-token cases are rejected and the valid-token control succeeds, on disposable data.
3. Check `SameSite` on session cookies and that unsafe methods reject a foreign Origin/Referer.
4. Route fixes (synchroniser/double-submit tokens, `SameSite` cookies, origin checks on unsafe methods) to `secure-code-review`.
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Each state-changing endpoint has missing-token, wrong-token and valid-token cases; all name the CSRF category.
- SameSite and foreign-origin rejection checked; only disposable data touched.
- Confirmed issues recorded and routed to code review; verify green.
