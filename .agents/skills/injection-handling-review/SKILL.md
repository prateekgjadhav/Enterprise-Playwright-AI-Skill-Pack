---
name: injection-handling-review
description: >-
  SQL, NoSQL, OS-command and path-traversal handling checks with Playwright, for applications the
  team owns and may test: feed a small, non-destructive marker set to inputs and assert the
  application handles it safely (no 5xx, no database or stack-trace text, no path escape) rather
  than returning an exploitable response. Covers OWASP A03 (injection, excluding XSS). Use whenever
  the user asks for SQL injection testing, injection handling, command-injection or
  path-traversal checks, or "does input get sanitised". Not for XSS (xss-output-encoding-review),
  SSRF (ssrf-defence-review), or source-level review (secure-code-review). This proves safe
  handling; it does not extract data, exploit a database, or run commands.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Injection handling review

Confirm that untrusted input never reaches an interpreter as code. These checks assert the
application *rejects or safely handles* known-bad markers — they do not attempt to extract data or
execute anything. The real fix lives in the code; see `secure-code-review`.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- **Markers, not weapons.** Use a tiny, well-known, non-destructive marker set purely to observe handling. Never attempt data extraction, stacking/`;`-chained destructive statements, time-based blind exfiltration, or command execution. If a marker ever appears to succeed, stop, record it as a finding, and do not probe further.
- No writes that mutate real data; prefer read paths and seeded fixtures. Findings get restricted visibility, with no exploit detail.
- Each check names A03 and the surface (SQL / NoSQL / command / path).

## Marker set and expectations
A small list, used only to confirm safe handling:
- SQL / NoSQL markers (e.g. `' OR '1'='1`, `{"$ne": null}`) → response is a normal 200/400/422, **never** a 500 and **never** contains SQL/DB error text.
- Path markers (e.g. `../../etc/passwd`, encoded variants) → no file contents returned; request is rejected or normalised.
- Command markers (benign separators around a harmless token) → no evidence of shell interpretation; no 500.

| Surface | Assert |
|---|---|
| Query / filter params | no 5xx; no database error string; result set unchanged in shape |
| Body fields | validation error (400/422) or safe acceptance; never 500 |
| File path / name inputs | path escape rejected; no file content leak |
| Error responses | generic; no stack trace, driver name, or query text |

## Spec template
```typescript
// @skill-example: fragment — tests/security/injection-handling.security.spec.ts
import { test, expect } from '@fixtures';

const MARKERS = ["' OR '1'='1", '{"$ne": null}', '../../etc/passwd'];

test.describe('search handles hostile input safely (A03)', () => {
  for (const marker of MARKERS) {
    test(`marker is handled, not executed: ${marker}`, { tag: ['@security', '@P1', '@search'] }, async ({ apiAs }) => {
      const api = await apiAs('user');
      const res = await api.get(`/api/search?q=${encodeURIComponent(marker)}`);
      expect(res.status(), await res.text()).toBeLessThan(500);
      expect((await res.text()).toLowerCase()).not.toMatch(/sql syntax|odbc|sqlstate|stack trace|at .*\(.*:\d+\)/);
    });
  }
});
```

## Procedure
1. Confirm authorisation and environment; list the input surfaces in scope (params, body fields, file inputs).
2. Loop the marker set over each surface; assert no 5xx and no interpreter/error leakage.
3. On any apparent success, stop probing, capture a redacted finding, and route the root cause to `secure-code-review` (parameterised queries, safe APIs, input validation).
4. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Each in-scope surface exercised with the marker set; all name A03.
- No destructive or extraction attempts; error hygiene asserted.
- Confirmed issues recorded (redacted) and handed to code review; verify green.
