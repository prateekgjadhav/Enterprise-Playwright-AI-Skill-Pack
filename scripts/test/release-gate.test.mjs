// The AI release gate: a fresh repository is n/a rather than red; --strict, thresholds and maxima behave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = join(dirname(fileURLToPath(import.meta.url)), '..', 'ai-release-gate.mjs');
const aiGates = { required: ['retrieval', 'kpis'], retrieval: { 'recall@5': 0.8, mrr: 0.6 }, kpis: { hallucination_rate: { max: 0.05 }, assertion_quality: 0.7 } };
function repo({ goldens = false, retrieval = null, kpis = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'qa-gate-'));
  mkdirSync(join(root, '.agents'), { recursive: true });
  mkdirSync(join(root, 'evals/results'), { recursive: true });
  mkdirSync(join(root, 'evals/goldens'), { recursive: true });
  writeFileSync(join(root, '.agents/qa.config.json'), JSON.stringify({ aiGates }));
  if (goldens) writeFileSync(join(root, 'evals/goldens/retrieval.jsonl'), '{}\n');
  if (retrieval) writeFileSync(join(root, 'evals/results/retrieval.json'), JSON.stringify(retrieval));
  if (kpis) writeFileSync(join(root, 'evals/results/kpis.json'), JSON.stringify(kpis));
  return root;
}
const run = (root, ...args) => { const r = spawnSync(process.execPath, [gate, '--root', root, '--json', ...args], { encoding: 'utf8' }); return { code: r.status, out: JSON.parse(r.stdout) }; };

test('a fresh repository (no goldens, no specs) is GO with n/a rows, and NO-GO under --strict', () => {
  const root = repo({ kpis: { counts: { tests: 0 } } });
  const a = run(root);
  assert.equal(a.code, 0);
  assert.deepEqual(a.out.rows.map((r) => r.status), ['n/a', 'n/a']);
  assert.equal(run(root, '--strict').code, 1);
});

test('goldens present but no results is a failure: the benchmark was skipped or broke', () => {
  assert.equal(run(repo({ goldens: true, kpis: { counts: { tests: 0 } } })).code, 1);
});

test('minimums and maxima', () => {
  const good = run(repo({ goldens: true, retrieval: { k: 5, context: { 'recall@5': 0.9, mrr: 0.7 } }, kpis: { hallucination_rate: 0.01, assertion_quality: 0.8, counts: { tests: 3 } } }));
  assert.equal(good.code, 0);
  assert.equal(good.out.decision, 'go');
  const bad = run(repo({ goldens: true, retrieval: { k: 5, context: { 'recall@5': 0.9, mrr: 0.7 } }, kpis: { hallucination_rate: 0.2, assertion_quality: 0.8, counts: { tests: 3 } } }));
  assert.equal(bad.code, 1);
  assert.deepEqual(bad.out.rows.filter((r) => r.status === 'fail').map((r) => r.metric), ['hallucination_rate']);
});
