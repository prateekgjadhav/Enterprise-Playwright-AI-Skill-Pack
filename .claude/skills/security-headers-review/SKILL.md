---
name: security-headers-review
description: >-
  HTTP security-header, CORS and transport checks with Playwright, for applications the team owns:
  assert CSP, HSTS, X-Content-Type-Options, frame protection, Referrer-Policy and
  Permissions-Policy are present and well-formed, that CORS rejects unknown origins, that HTTPS is
  enforced, and that server fingerprinting headers are absent. Covers OWASP A05 and the transport
  side of A02. Use whenever the user asks for security headers analysis, a CSP validator, CORS
  checks, HSTS/HTTPS enforcement, or clickjacking protection. Not for auth or cookies
  (auth-access-control-review), XSS payload handling (xss-output-encoding-review), or cloud posture
  (cloud-security-review). This reads and evaluates response headers; it does not test CSP bypasses.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Security headers review

A fast, deterministic baseline every assessment runs. Fetch responses and assert the hardening
headers are present and sane, and that CORS and transport are locked down. Purely observational —
no bypass attempts.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- Read-only: fetch and inspect headers. Do not attempt to defeat CSP, forge preflights, or probe beyond the configured origins.
- Report the header value, the expectation, and the fix; no secrets in evidence.
- Each check names A05 (or A02 for transport).

## Expected headers
| Header | Expectation |
|---|---|
| `content-security-policy` | present; `default-src`/`script-src` set; no `unsafe-inline`/`unsafe-eval` in `script-src` |
| `strict-transport-security` | `max-age` ≥ 15552000; `includeSubDomains` where applicable |
| `x-content-type-options` | `nosniff` |
| frame protection | `X-Frame-Options: DENY/SAMEORIGIN` or CSP `frame-ancestors` |
| `referrer-policy` | present and restrictive (e.g. `strict-origin-when-cross-origin`) |
| `permissions-policy` | present; unused powerful features disabled |
| `x-powered-by` / `server` | absent or non-revealing |
| CORS | `Access-Control-Allow-Origin` reflects only allowed origins; unknown origin rejected; no `*` with credentials |
| Transport | HTTP redirects to HTTPS; cookies only over HTTPS |

## Spec template
```typescript
// @skill-example: fragment — tests/security/security-headers.security.spec.ts
import { test, expect } from '@fixtures';

const FOREIGN_ORIGIN = 'https://evil.example'; // governance-disable-line no-hard-coded-data -- a forged origin is the test input (SEC-102)

test('core security headers are present and sane (A05)', { tag: ['@security', '@P1', '@platform'] }, async ({ apiAs }) => {
  const res = await (await apiAs('anonymous')).get('/');
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
  expect(h['content-security-policy']).toBeTruthy();
  expect(h['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(h['x-powered-by']).toBeUndefined();
});

test('CORS rejects an unknown origin (A05)', { tag: ['@security', '@P1', '@platform'] }, async ({ apiAs }) => {
  const res = await (await apiAs('anonymous')).get('/api/profile', { headers: { Origin: FOREIGN_ORIGIN } });
  expect(res.headers()['access-control-allow-origin']).not.toBe(FOREIGN_ORIGIN);
});
```

## Procedure
1. Confirm authorisation and environment; list the hostnames/routes to sample (page loads and API).
2. Fetch representative responses; assert each header against the table.
3. Check CORS with a known-bad origin and confirm HTTPS enforcement.
4. For each gap, record value → expectation → fix (framework header middleware / CDN / CSP policy).
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- All table headers checked on at least one page and one API response; each names A05/A02.
- CORS unknown-origin and HTTPS-enforcement checks present.
- Gaps recorded with concrete remediation; verify green.
