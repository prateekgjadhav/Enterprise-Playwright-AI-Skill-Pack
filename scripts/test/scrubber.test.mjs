// Self-tests for the artifact scrubber: traces, nested archives, the HTML report's embedded ZIP, auth state, fail closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip, writeZip } from '../lib/zip.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SECRET = 'S3cr3t-Pa55-for-tests';
const scrub = (dir, env = {}) => spawnSync('node', [join(root, 'scripts/scrub-artifacts.mjs'), dir], { encoding: 'utf8', env: { ...process.env, QA_REDACTION_DIR: join(dir, '..', 'reg'), ...env } });

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'qa-scrub-'));
  const dir = join(base, 'test-results'); mkdirSync(join(dir, 'case', '.auth'), { recursive: true }); mkdirSync(join(base, 'reg'));
  writeFileSync(join(base, 'reg', 'qa-redaction-1.json'), JSON.stringify({ values: [SECRET] }));
  const network = JSON.stringify({ request: { headers: [{ name: 'Authorization', value: 'Bearer abcdefghijklmnop' }, { name: 'Cookie', value: 'sid=12345678' }], postData: `password=${SECRET}` } });
  const inner = writeZip([{ name: 'trace.network', data: Buffer.from(network + '\n') }, { name: 'resources/a.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]) }]);
  writeFileSync(join(dir, 'case', 'trace.zip'), writeZip([{ name: 'trace.trace', data: Buffer.from(`{"value":"${SECRET}","jwt":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl"}\n`) }, { name: 'nested.zip', data: inner }]));
  writeFileSync(join(dir, 'case', '.auth', 'admin.json'), '{"cookies":[]}');
  writeFileSync(join(dir, 'index.html'), `<script>window.playwrightReportBase64 = "data:application/zip;base64,${writeZip([{ name: 'report.json', data: Buffer.from(`{"x":"${SECRET}"}`) }]).toString('base64')}";</script>`);
  return { base, dir };
}

test('secrets, headers, tokens and auth state are removed from traces, nested archives and reports', () => {
  const { dir } = setup();
  const r = scrub(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(dir, 'case', '.auth')));
  const outer = readZip(readFileSync(join(dir, 'case', 'trace.zip')));
  const all = outer.map((e) => e.name.endsWith('.zip') ? readZip(e.data).map((x) => x.data.toString('latin1')).join('') : e.data.toString('utf8')).join('');
  assert.ok(!all.includes(SECRET)); assert.ok(!all.includes('abcdefghijklmnop')); assert.ok(!all.includes('sid=12345678')); assert.ok(!all.includes('eyJhbGciOiJIUzI1NiJ9.'));
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const embedded = readZip(Buffer.from(/base64,([A-Za-z0-9+/=]+)/.exec(html)[1], 'base64'))[0].data.toString();
  assert.ok(!embedded.includes(SECRET));
});

test('corrupt archives and secrets inside binaries fail closed', () => {
  const { dir } = setup();
  writeFileSync(join(dir, 'broken.zip'), Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]));
  assert.equal(scrub(dir).status, 1);
  const { dir: d2 } = setup();
  writeFileSync(join(d2, 'shot.bin'), Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from(SECRET)]));
  assert.equal(scrub(d2).status, 1);
});
