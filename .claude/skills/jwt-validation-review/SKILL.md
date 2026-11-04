---
name: jwt-validation-review
description: >-
  JSON Web Token validation checks with Playwright, for applications the team owns and may test:
  assert the server rejects `alg:none`, tampered signatures, expired or not-yet-valid tokens, and
  wrong `aud`/`iss`, that algorithms are not confusable (RS↔HS), and that tokens never appear in
  URLs, logs or client storage. Covers OWASP A02/A07. Use whenever the user asks for JWT security
  analysis, token validation checks, `alg:none` or signature-tampering handling, token
  expiry/claims checks, or JWT leakage review. Not for login flows and sessions
  (auth-access-control-review) or endpoint authorisation in general (api-security-review). This
  asserts the server rejects manipulated tokens; it does not forge a valid token or bypass auth.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# JWT validation review

Confirm the server trusts a token only when it should. Every check sends a *deliberately invalid*
token and asserts the server **rejects** it; the skill never mints a token the server would accept.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- **Assert rejection, never forgery.** Construct manipulated tokens solely to confirm they are refused with 401/403. Do not attempt to produce a *valid* token for another user, crack a signing key, or exploit a confusion flaw to gain access. If a manipulated token is ever accepted, stop, record a redacted finding, and escalate no further.
- Never print token contents or signing material; redact in evidence. Findings get restricted visibility.
- Each check names A02/A07.

## Coverage map
| Check | Manipulated token | Expect |
|---|---|---|
| None algorithm | header `alg:none`, signature stripped | 401/403 |
| Signature tampering | payload claim altered, old signature | 401/403 |
| Expired / not-yet-valid | `exp` in the past / `nbf` in the future | 401/403 |
| Audience / issuer | wrong `aud` or `iss` | 401/403 |
| Algorithm confusion | RS256 token re-presented as HS256 | rejected (server pins the algorithm) |
| Leakage | token in URL / `Referer` / `localStorage` | never present |
| Lifetime | access-token TTL is short; refresh handled server-side | within policy |

## Spec template
```typescript
// @skill-example: fragment — tests/security/jwt-validation.security.spec.ts
import { test, expect } from '@fixtures';

// Builds an INVALID token (unsigned / alg:none) purely to confirm the server refuses it.
function noneAlgToken(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;   // empty signature
}

test('server rejects an alg:none token (A02/A07)', { tag: ['@security', '@P0', '@auth'] }, async ({ playwright }) => {
  const api = await playwright.request.newContext();
  const res = await api.get('/api/profile', { headers: { Authorization: `Bearer ${noneAlgToken({ sub: 'user', role: 'admin' })}` } });
  expect([401, 403]).toContain(res.status());                   // must NOT be 200
  await api.dispose();
});
```

## Procedure
1. Confirm authorisation and environment; identify the token-protected endpoints.
2. For each manipulation in the table, send the invalid token and assert 401/403 (never a 200).
3. Check algorithm pinning (no RS↔HS confusion), short access-token lifetime, and absence of token leakage in URLs/logs/storage.
4. Route fixes (verify signature with a pinned algorithm, validate `exp`/`nbf`/`aud`/`iss`, reject `none`, rotate/segregate keys, keep tokens out of URLs) to `secure-code-review`.
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Each manipulation asserted to be rejected; algorithm pinning and leakage checked; all name A02/A07.
- No valid token forged, no key cracked; token material redacted.
- Confirmed issues recorded and routed to code review; verify green.
