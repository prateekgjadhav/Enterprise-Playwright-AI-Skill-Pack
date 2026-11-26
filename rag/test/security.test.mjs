// Security controls of the knowledge layer: the injection tripwire against its red-team corpus, redaction,
// target checks, index and cache encryption, memory-id validation and path containment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanInjection, redact } from '../security/guard.mjs';
import { checkTarget } from '../lib/targets.mjs';
import { encrypt, decrypt, keyFor, saveIndex, loadIndex, saveCache, loadCache } from '../store/store.mjs';
import { loadConfig } from '../lib/config.mjs';
import { approveMemory, rejectMemory } from '../memory/memory.mjs';
import { scoreSpecs } from '../evaluation/kpi.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(here, 'fixtures/injection-corpus.json'), 'utf8'));
const rate = (xs) => xs.filter((x) => scanInjection(x).flagged).length / xs.length;

test('injection tripwire: every tuned case flagged, no benign QA text flagged', () => {
  for (const x of corpus.tuned) assert.ok(scanInjection(x).flagged, `missed tuned case: ${x}`);
  for (const x of corpus.benign) assert.ok(!scanInjection(x).flagged, `false positive: ${x}`);
});

test('injection tripwire: held-out detection rate does not regress (a tripwire, not a boundary)', (t) => {
  const r = rate(corpus.heldOut);
  t.diagnostic(`held-out detection ${Math.round(r * 100)}% over ${corpus.heldOut.length} cases`);
  assert.ok(r >= 7 / 15, `held-out detection fell to ${r}`);
});

test('redaction: SSNs, URI credentials and unquoted assignments; code references stay', () => {
  const r = redact('ssn 123-45-6789 · postgres://admin:S3cr3t@db.internal/app · password = hunter22 · const password = process.env.QA_PW · password: string');
  assert.match(r.text, /\[REDACTED:SSN\]/);
  assert.match(r.text, /postgres:\/\/admin:\[REDACTED:SECRET\]@db\.internal/);
  assert.match(r.text, /password = \[REDACTED:SECRET\]/);
  assert.match(r.text, /process\.env\.QA_PW/);
  assert.match(r.text, /password: string/);
  assert.equal(redact('build 2024-01-15 · order 000-12-3456').counts.SSN, undefined);
});

test('target check: allowlist required, production-like and production hosts refused, raw IPs only when listed', () => {
  const none = { environments: [] };
  assert.equal(checkTarget('https://staging.acme.test', none).ok, false);
  const qa = { productionHosts: ['acme.com'], environments: [{ name: 'staging', hosts: ['qa.acme.test', 'localhost', '10.1.2.3'] }] };
  assert.equal(checkTarget('https://app.qa.acme.test/x', qa).ok, true);
  assert.equal(checkTarget('https://QA.acme.test./', qa).ok, true);
  assert.equal(checkTarget('https://staging.acme.test', qa).ok, false);
  assert.equal(checkTarget('https://api.acme.com', qa).ok, false);
  assert.equal(checkTarget('https://prod.qa.acme.test', qa).ok, false);
  assert.equal(checkTarget('https://www.qa.acme.test', qa).ok, false);
  assert.equal(checkTarget('http://localhost:3000', qa).ok, true);
  assert.equal(checkTarget('http://127.0.0.1:3000', qa).ok, false);
  assert.equal(checkTarget('http://10.1.2.3', qa).ok, true);
  assert.equal(checkTarget('http://10.1.2.4', qa).ok, false);
  assert.equal(checkTarget('not a url at all', qa).ok, false);
});

test('encryption: hex, base64 and passphrase keys round-trip; a wrong key fails; index and cache leave no plaintext', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-enc-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude/qa.config.json'), JSON.stringify({ rag: { security: { encryption: { enabled: true, keyEnv: 'QA_TEST_KEY' } } } }));
  const cfg = loadConfig(root);
  for (const key of ['ab'.repeat(32), Buffer.alloc(32, 7).toString('base64'), 'a long passphrase']) {
    process.env.QA_TEST_KEY = key;
    const k = keyFor(cfg);
    assert.equal(k.length, 32);
    assert.equal(decrypt(encrypt(Buffer.from('hello'), k), k).toString(), 'hello');
  }
  saveIndex(cfg, { docs: [{ id: 'SECRET-DOC' }], chunks: [], graph: { nodes: {}, edges: [] } });
  saveCache(cfg, { 'local-hash:abc': [0.1, 0.2] });
  assert.ok(!existsSync(cfg.paths.index) && !existsSync(cfg.paths.embedCache));
  assert.ok(!readFileSync(cfg.paths.indexEnc).toString('latin1').includes('SECRET-DOC'));
  assert.equal(loadIndex(cfg).docs[0].id, 'SECRET-DOC');
  assert.deepEqual(loadCache(cfg), { 'local-hash:abc': [0.1, 0.2] });
  process.env.QA_TEST_KEY = 'cd'.repeat(32);
  assert.throws(() => loadIndex(cfg));
  delete process.env.QA_TEST_KEY;
});

test('memory approval rejects ids that are not memory ids (no path traversal)', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-mem-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude/qa.config.json'), '{}');
  writeFileSync(join(root, 'package.json'), '{}');
  const cfg = loadConfig(root);
  assert.equal(approveMemory(cfg, '../../package', 'alice').ok, false);
  assert.equal(rejectMemory(cfg, '../../package').ok, false);
  assert.ok(existsSync(join(root, 'package.json')));
  assert.equal(approveMemory(cfg, 'mem-0123456789ab', 'alice').error, 'no pending memory mem-0123456789ab');
});

test('score_spec refuses paths outside the repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-kpi-'));
  cpSync(join(here, '../fixtures/sample-repo/.claude'), join(root, '.claude'), { recursive: true });
  assert.throws(() => scoreSpecs(loadConfig(root), ['../../etc/passwd']), /outside the repository/);
});
