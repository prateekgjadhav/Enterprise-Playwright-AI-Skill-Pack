import { test, expect } from '@fixtures';

test('health endpoint reports ok', { tag: ['@P0', '@platform', '@smoke'] }, async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(await res.json()).toMatchObject({ status: 'ok' });
});
