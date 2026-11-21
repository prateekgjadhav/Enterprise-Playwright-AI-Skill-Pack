// Runs only in the security project, which exists only when a signed, current scope is named (QA_SCOPE_FILE) and
// verified by the verify-scope hook and the CI job. GET requests only.
import { test, expect } from '@fixtures';

test('responses carry the hardening headers', { tag: ['@P1', '@security', '@headers'] }, async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(h['content-security-policy']).toBeTruthy();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBeTruthy();
});
