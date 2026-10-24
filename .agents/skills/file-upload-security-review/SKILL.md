---
name: file-upload-security-review
description: >-
  File-upload handling checks with Playwright, for applications the team owns and may test: assert
  that upload endpoints reject disallowed types and spoofed content-types, enforce size limits,
  strip or reject path-traversal filenames, store files outside the web root / non-executable, and
  never return executable content. Covers OWASP A05 and the upload side of A03. Use whenever the
  user asks for file-upload security testing or review, malicious-upload handling, content-type or
  extension validation, or avatar/document/attachment upload checks. Not for other injection
  (injection-handling-review), stored XSS in rendered content (xss-output-encoding-review), or
  storage IAM (cloud-security-review). This asserts dangerous uploads are rejected; it uses benign
  marker files and never creates a web shell or executable payload.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# File upload security review

Confirm the upload feature only accepts what it should, and that what it stores can never be
executed or escape its directory. Checks use harmless marker files to assert *rejection* — no
payloads, no shells.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`.
- **Benign markers only.** Test files contain harmless, inert content (a plain-text marker). Never author a web shell, script payload, macro, or polyglot. The success signal is a *rejection* or safe, non-executable storage.
- If a disallowed file is accepted or served executable, stop, record a redacted finding, and do not attempt to execute or chain it. Findings get restricted visibility.
- Clean up uploaded test artifacts. Each check names A05 (or A03 for traversal).

## Coverage map
| Check | Expect |
|---|---|
| Disallowed extension (e.g. `.php`, `.svg`, `.html` where not permitted) | rejected |
| Content-type spoof (benign text sent as `image/png`, or `.txt` renamed `.png`) | detected by content inspection, not trusted header |
| Oversize file | rejected at the configured limit (413/400) |
| Path-traversal filename (`../../x.txt`, encoded) | stored under a safe generated name; no directory escape |
| Stored file retrieval | served with a safe `Content-Type` and `Content-Disposition`; never executed |
| Storage location | outside web root / non-executable path; random server-side name |

## Spec template
```typescript
// @skill-example: fragment — tests/security/file-upload.security.spec.ts
import { test, expect } from '@fixtures';

test('rejects a disallowed type and a content-type spoof (A05)', { tag: ['@security', '@P1', '@uploads'] }, async ({ apiAs }) => {
  const api = await apiAs('user');
  const marker = Buffer.from('inert-upload-marker');                 // harmless content, not a payload
  const bad = await api.post('/api/avatar', { multipart: { file: { name: 'note.php', mimeType: 'image/png', buffer: marker } } });
  expect([400, 415, 422]).toContain(bad.status());                   // disallowed type rejected despite spoofed mime
});

test('a traversal filename cannot escape the upload dir (A03)', { tag: ['@security', '@P1', '@uploads'] }, async ({ apiAs }) => {
  const api = await apiAs('user');
  const marker = Buffer.from('inert-upload-marker');
  const res = await api.post('/api/avatar', { multipart: { file: { name: '../../evil.txt', mimeType: 'text/plain', buffer: marker } } });
  expect(res.status()).toBeLessThan(500);
  if (res.ok()) expect((await res.json()).storedName ?? '').not.toContain('..'); // name sanitised
});
```

## Procedure
1. Confirm authorisation and environment; list the upload endpoints and their allowed types/limits.
2. Assert rejection of disallowed types, content-type spoofs, and oversize files using benign markers.
3. Assert traversal filenames are sanitised and stored files are served non-executable from a safe location.
4. Route fixes (allow-list by inspected content, size limits, generated names, store outside web root, serve with safe headers / sandboxed domain, AV scan) to `secure-code-review`.
5. Clean up test uploads; run `--project=security`, then `npm run verify`; classify findings.

## Definition of Done
- Type, content-type-spoof, size, traversal and retrieval checks present; each names A05/A03.
- Only benign markers used; no executable payloads created; test artifacts cleaned up.
- Confirmed issues recorded (redacted) and routed to code review; verify green.
