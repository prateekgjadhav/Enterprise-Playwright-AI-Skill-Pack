// Self-tests for self-healing: node --test scripts/self-healing/heal.test.mjs (no browser needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failuresFrom, parseLocator, render, rankCandidates, similarity, heal } from './heal.mjs';

const report = (errors) => ({ suites: [{ file: 'tests/e2e/auth/login.spec.ts', specs: errors.map(([title, message]) => ({ title, file: 'tests/e2e/auth/login.spec.ts',
  tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message } }] }] })) }] });

test('locator failures are read from the JSON report, other failures are ignored', () => {
  const f = failuresFrom(report([
    ['signs in', "Error: locator.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Sign in' })"],
    ['shows total', "Error: expect(received).toBe(expected)\nExpected: 10\nReceived: 9"],
  ]));
  assert.equal(f.length, 1);
  assert.equal(f[0].expression, "getByRole('button', { name: 'Sign in' })");
});

test('locators parse and render without changing their meaning', () => {
  const l = parseLocator("getByRole('button', { name: 'Sign in' })");
  assert.deepEqual([l.kind, l.role, l.name], ['role', 'button', 'Sign in']);
  assert.equal(render({ ...l, name: 'Log in' }), "getByRole('button', { name: 'Log in' })");
  assert.equal(parseLocator('getByTestId("cart-total")').value, 'cart-total');
  assert.ok(similarity('Sign in', 'Log in') >= 0.9);
});

test('only true drift is healed', () => {
  const aria = '- button "Log in"\n- textbox "Email"\n- button "Help"';
  assert.equal(rankCandidates(parseLocator("getByRole('button', { name: 'Sign in' })"), { aria, testIds: [] }).candidates[0].loc.name, 'Log in');
  assert.equal(rankCandidates(parseLocator("getByRole('button', { name: 'Help' })"), { aria, testIds: [] }).verdict, 'target-still-present');
  assert.equal(rankCandidates(parseLocator("getByRole('checkbox', { name: 'Remember me' })"), { aria, testIds: [] }).verdict, 'kind-absent');
  assert.equal(rankCandidates(parseLocator("locator('#submit')"), { aria, testIds: [] }).verdict, 'governance');
});

test('proposes a diff, applies only with --apply, never touches specs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-heal-'));
  mkdirSync(join(root, '.claude/discovery/pages'), { recursive: true });
  mkdirSync(join(root, 'src/pages'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  writeFileSync(join(root, '.claude/qa.config.json'), JSON.stringify({ framework: { pagesDir: 'src/pages' } }));
  const po = `import type { Locator, Page } from '@playwright/test';\nexport class LoginPage {\n  readonly path = '/login';\n  readonly signInButton: Locator;\n  readonly total: Locator;\n  constructor(private readonly page: Page) {\n    this.signInButton = page.getByRole('button', { name: 'Sign in' });\n    this.total = page.getByTestId('cart-total');\n  }\n}\n`;
  writeFileSync(join(root, 'src/pages/LoginPage.ts'), po);
  writeFileSync(join(root, '.claude/discovery/pages/login.md'), '---\nid: route:/login\n---\n# Sign in\n\n## Test ids\n`cart-total-amount`, `help`\n\n## Accessibility tree (aria snapshot)\n```yaml\n- button "Log in"\n- textbox "Email"\n```\n');
  writeFileSync(join(root, 'reports/results.json'), JSON.stringify(report([
    ['signs in', "Error: locator.click: Timeout 5000ms exceeded.\n  - waiting for getByRole('button', { name: 'Sign in' })"],
    ['total', "Error: expect(locator).toHaveText(expected) failed\nLocator: getByTestId('cart-total')\n  - waiting for getByTestId('cart-total')"],
  ])));
  const dry = await heal({ root });
  assert.equal(dry.summary.proposed, 2);
  assert.match(dry.diff, /\+\s+this\.signInButton = page\.getByRole\('button', \{ name: 'Log in' \}\);/);
  assert.equal(readFileSync(join(root, 'src/pages/LoginPage.ts'), 'utf8'), po, 'a dry run changes nothing');
  const applied = await heal({ root, apply: true });
  assert.equal(applied.summary.applied, 2);
  const after = readFileSync(join(root, 'src/pages/LoginPage.ts'), 'utf8');
  assert.ok(after.includes("getByRole('button', { name: 'Log in' })") && after.includes("getByTestId('cart-total-amount')"));
  assert.ok(!existsSync(join(root, 'reports/healing/backup')), 'no backup copies: git is the rollback');
  assert.ok(existsSync(join(root, 'reports/healing/healing-report.md')));
});
