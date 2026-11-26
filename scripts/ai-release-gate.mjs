#!/usr/bin/env node
// The AI release gate: one decision from every AI-quality signal the pack produces.
//   evals/results/retrieval.json  node rag/cli.mjs bench --write     (recall@k, MRR, scenario accuracy)
//   evals/results/kpis.json       node rag/cli.mjs kpi --write       (hallucination rate, assertion/locator quality, flakiness)
//   evals/results/deepeval.json   python evals/deepeval/run_evals.py (LLM-judged output quality)
//   evals/results/ragas.json      python evals/ragas/run_ragas.py    (faithfulness, context precision/recall, relevancy)
// Thresholds come from qa.config.json "aiGates": a number is a minimum, { "max": n } a maximum. Groups named in
// aiGates.required must have results; the others are checked when present and reported as skipped when not.
// A required group that cannot apply yet — no retrieval goldens written, no specs to score — is reported as
// "n/a" with the reason, not failed, so a freshly installed repository is not red on its first push.
// --strict turns "n/a" into a failure once a team has its goldens and specs in place.
// Usage: node scripts/ai-release-gate.mjs [--root <dir>] [--json] [--strict]      exit 1 when any check fails
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const root = resolve(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : '.');
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const gates = readJson(join(root, '.claude/qa.config.json'))?.aiGates ?? {};
const dir = join(root, 'evals/results');
const required = new Set(gates.required ?? []);
const strict = argv.includes('--strict');
const NA = (reason) => ({ __na: reason });
const hasGoldens = existsSync(join(root, 'evals/goldens/retrieval.jsonl'));

const sources = {
  retrieval: () => { const r = readJson(join(dir, 'retrieval.json')); if (!r) return hasGoldens ? null : NA('no evals/goldens/retrieval.jsonl yet: copy and adapt retrieval.example.jsonl'); const k = r.k ?? 5;
    return { [`recall@${k}`]: r.context?.[`recall@${k}`], 'recall@5': r.context?.[`recall@${k}`], mrr: r.context?.mrr, [`ndcg@${k}`]: r.context?.[`ndcg@${k}`], scenarioAccuracy: r.scenarios?.accuracy ?? null, intentAccuracy: r.intentAccuracy }; },
  kpis: () => { const r = readJson(join(dir, 'kpis.json')); return r && r.counts?.tests === 0 ? NA('no specs to score yet') : r; },
  deepeval: () => { const r = readJson(join(dir, 'deepeval.json')); return r ? { averageScore: r.averageScore, ...(r.metrics ?? {}) } : null; },
  ragas: () => readJson(join(dir, 'ragas.json'))?.metrics ?? null,
};

const rows = [];
for (const [group, checks] of Object.entries(gates)) {
  if (group === 'required' || !sources[group]) continue;
  const values = sources[group]();
  if (values?.__na) { rows.push({ group, metric: '(results)', value: null, threshold: null, status: strict && required.has(group) ? 'fail' : 'n/a', note: values.__na }); continue; }
  if (!values) { rows.push({ group, metric: '(results)', value: null, threshold: null, status: required.has(group) ? 'fail' : 'skipped', note: `no evals/results/${group}.json` }); continue; }
  for (const [metric, th] of Object.entries(checks)) {
    const v = values[metric];
    const isMax = th && typeof th === 'object';
    const limit = isMax ? th.max : th;
    if (v === undefined || v === null) { rows.push({ group, metric, value: null, threshold: limit, status: required.has(group) ? 'fail' : 'skipped', note: 'metric not in results' }); continue; }
    const ok = isMax ? v <= limit : v >= limit;
    rows.push({ group, metric, value: v, threshold: `${isMax ? '≤' : '≥'} ${limit}`, status: ok ? 'pass' : 'fail' }); // qa-scan: not-a-secret
  }
}
const failed = rows.filter((r) => r.status === 'fail');
const decision = { at: new Date().toISOString(), decision: failed.length ? 'no-go' : 'go', failed: failed.length, rows };
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'gate.json'), JSON.stringify(decision, null, 2));
appendFileSync(join(dir, 'history.jsonl'), JSON.stringify({ at: decision.at, kind: 'gate', decision: decision.decision, failed: failed.length }) + '\n');
if (argv.includes('--json')) console.log(JSON.stringify(decision, null, 2));
else {
  console.log('AI release gate');
  for (const r of rows) console.log(`  ${r.status.toUpperCase().padEnd(7)} ${`${r.group}.${r.metric}`.padEnd(34)} ${String(r.value ?? '—').padEnd(8)} ${r.threshold ?? ''}${r.note ? `  (${r.note})` : ''}`);
  console.log(`Decision: ${decision.decision.toUpperCase()}${failed.length ? ` — ${failed.length} check(s) failed` : ''}`);
}
process.exit(failed.length ? 1 : 0);
