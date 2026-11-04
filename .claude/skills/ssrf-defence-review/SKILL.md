---
name: ssrf-defence-review
description: >-
  Server-side request forgery defence checks with Playwright, for applications the team owns and
  may test: on features where the server fetches a user-supplied URL, assert that requests to
  internal, loopback, link-local and cloud-metadata targets are refused and only allow-listed
  destinations are reached. Covers OWASP A10. Use whenever the user asks for SSRF testing or
  assessment, URL-fetch / webhook / image-proxy security, or "can the server be made to call
  internal hosts". Not for other injection (injection-handling-review), outbound CORS/headers
  (security-headers-review), or cloud IAM posture (cloud-security-review). This asserts internal
  targets are blocked; it does not reach a metadata endpoint or exfiltrate anything.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# SSRF defence review

Confirm that a feature which fetches a URL on the user's behalf cannot be pointed at the internal
network. Every check asserts the server *refuses* a non-allow-listed target; none of them try to
read what sits behind one.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- **Assert refusal, never retrieval.** Use canary internal targets purely to confirm they are blocked; never attempt to read a metadata response, pivot, port-scan, or exfiltrate. If an internal target is ever reachable, stop, record a redacted finding, and do not probe further.
- Use a destination the test controls (an allow-listed public canary) for the positive case; no third-party hosts.
- Findings get restricted visibility, no exploit detail. Each check names A10.

## Target set and expectations
A small list, used only to confirm the destination is rejected:
- Loopback / internal: `http://127.0.0.1`, `http://localhost`, an RFC1918 host (`http://10.0.0.1`).
- Link-local / cloud metadata: `http://169.254.169.254/` (and the IMDS path) — must be refused, not fetched.
- Scheme abuse: `file://`, `gopher://`, `http://` with an `@`/redirect trick → rejected.
- DNS/redirect rebinding: a URL that redirects toward an internal host → still refused after the redirect.

| Surface | Assert |
|---|---|
| URL / webhook / callback field | internal + metadata targets → 400/422/blocked; never a 200 proxying internal content |
| Allowed destination | reaches only the allow-listed host; everything else refused |
| Redirects | the fetcher does not follow a redirect into an internal range |
| Error response | generic; no internal body, header, or IP echoed back |

## Spec template
```typescript
// @skill-example: fragment — tests/security/ssrf-defence.security.spec.ts
import { test, expect } from '@fixtures';

// governance-disable-next-line no-hard-coded-data -- SSRF targets the server must refuse, not environment URLs (SEC-101)
const BLOCKED = ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'file:///etc/hostname'];

test.describe('image-proxy refuses internal targets (A10)', () => {
  for (const url of BLOCKED) {
    test(`blocks ${url}`, { tag: ['@security', '@P0', '@proxy'] }, async ({ apiAs }) => {
      const api = await apiAs('user');
      const res = await api.post('/api/fetch-image', { data: { url } });
      expect([400, 403, 422]).toContain(res.status());          // refused, not proxied
      expect(await res.text()).not.toMatch(/ami-id|instance-id|root:x:|BEGIN .*PRIVATE KEY/); // no internal content leaked
    });
  }
});
```

## Procedure
1. Confirm authorisation and environment; list the features that fetch a user-supplied URL.
2. For each, submit the blocked-target set and assert refusal and no internal content in the response.
3. Confirm the allow-list positive case reaches only the permitted host, and that redirects aren't followed into internal ranges.
4. Route root-cause fixes (allow-list destinations, block internal ranges and the metadata IP, disable unused schemes, resolve-then-validate, network egress controls) to `secure-code-review` and `cloud-security-review`.
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Each URL-fetch feature exercised with the blocked-target set; all name A10.
- Refusal asserted with no retrieval/pivot/exfiltration attempts; redirect handling checked.
- Confirmed issues recorded (redacted) and routed to code/cloud remediation; verify green.
