---
name: xss-output-encoding-review
description: >-
  Cross-site scripting handling checks with Playwright, for applications the team owns and may
  test: submit a small set of benign XSS markers and assert they are stored and rendered as inert,
  escaped text (never executed), that a Content-Security-Policy is present, and that no script
  dialog fires. Covers the XSS part of OWASP A03. Use whenever the user asks for XSS detection or
  testing, output-encoding checks, stored/reflected/DOM XSS handling, or a "Playwright CSP/XSS
  tester". Not for other injection (injection-handling-review), full header coverage
  (security-headers-review), or source review (secure-code-review). This proves payloads are
  neutralised; it does not craft working exploits or steal sessions.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# XSS output-encoding review

Confirm that user-supplied content is rendered as data, not script. The checks submit a benign
marker and assert nothing executes and the marker comes back escaped; defence-in-depth (CSP) is
checked too. They never exfiltrate cookies or build a real exploit.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- **Benign markers only** (a harmless `alert`/marker token). No payloads that call out to an external host, read `document.cookie`, or exfiltrate anything. The success signal is a *dialog that must NOT appear* and a marker that must come back escaped.
- Fail the test if script executes; do not then escalate or weaponise. Record it as a finding.
- Findings get restricted visibility, no exploit detail. Each check names A03 (XSS).

## Coverage map
| Vector | Assert |
|---|---|
| Reflected (query/search renders input) | marker shown escaped; no `dialog` event |
| Stored (comment/profile field persisted) | on re-render, marker escaped; no `dialog` event |
| DOM (client reads URL fragment/param) | no sink executes the marker; no `dialog` event |
| Defence in depth | `content-security-policy` header present; no `unsafe-inline`/`unsafe-eval` in script-src |

## Spec template
```typescript
// @skill-example: fragment — tests/security/xss-handling.security.spec.ts
import { test, expect } from '@fixtures';

const MARKER = '<script>window.__xss=1</script>';

test('stored comment is escaped and never executes (A03)', { tag: ['@security', '@P0', '@comments'] }, async ({ page, loginAs, commentsPage }) => {
  let dialog = false;
  page.on('dialog', async d => { dialog = true; await d.dismiss(); });
  await loginAs('user');
  await commentsPage.add(MARKER);                       // page object encapsulates the UI
  await commentsPage.reload();
  expect(dialog, 'no script dialog should fire').toBe(false);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  await expect(commentsPage.lastComment).toContainText('<script>');  // shown as text, i.e. escaped
});
```

## Procedure
1. Confirm authorisation and environment; list the fields and views that render user input.
2. For each, submit the benign marker and assert no dialog/execution and an escaped round-trip.
3. Check the CSP header and flag `unsafe-inline`/`unsafe-eval` in `script-src`.
4. Route root-cause fixes (context-aware output encoding, templating auto-escape, CSP hardening) to `secure-code-review`.
5. Run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Reflected, stored and DOM vectors exercised with a benign marker; all name A03.
- CSP presence and strength checked; no cookie/exfiltration payloads used.
- Confirmed issues recorded (redacted) and handed to code review; verify green.
