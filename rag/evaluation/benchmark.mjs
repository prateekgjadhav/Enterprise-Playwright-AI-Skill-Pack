// Deterministic retrieval benchmark (no LLM, no key): recall@k, precision@k, MRR, nDCG@k and hit rate over
// golden queries, for both plain hybrid search and the planned, multi-hop context pack, plus a scenario-brief
// check (are the known uncovered ACs and past defects turned into scenarios?). RAGAS and DeepEval add the
// LLM-judged view on top of this; this one always runs in CI.
import { readJsonl, round } from '../lib/util.mjs';
import { search, retrieveContext } from '../orchestration/pipeline.mjs';
import { scenarioBrief } from '../orchestration/scenarios.mjs';

const dcg = (rels) => rels.reduce((a, r, i) => a + r / Math.log2(i + 2), 0);
export function metricsAt(rankedDocIds, relevant, k) {
  const rel = new Set(relevant);
  const uniq = [...new Set(rankedDocIds)].slice(0, k);
  const hits = uniq.filter((d) => rel.has(d)).length;
  const firstRank = uniq.findIndex((d) => rel.has(d));
  const ideal = dcg(Array.from({ length: Math.min(k, rel.size) }, () => 1));
  return {
    recall: rel.size ? hits / rel.size : 0,
    precision: uniq.length ? hits / Math.min(k, uniq.length) : 0,
    mrr: firstRank >= 0 ? 1 / (firstRank + 1) : 0,
    ndcg: ideal ? dcg(uniq.map((d) => (rel.has(d) ? 1 : 0))) / ideal : 0,
    hit: hits > 0 ? 1 : 0,
  };
}
const mean = (rows, key) => (rows.length ? round(rows.reduce((a, r) => a + r[key], 0) / rows.length) : 0);

export async function runBenchmark(cfg, { goldens, scenarioGoldens = null, k = 5 } = {}) {
  const cases = readJsonl(goldens);
  const rows = [];
  for (const c of cases) {
    const s = await search(cfg, c.query, { k: k * 2 });
    const ctx = await retrieveContext(cfg, c.query, { intent: c.intent ?? null, k: k * 2 });
    const searchM = metricsAt(s.results.map((r) => r.docId), c.relevant, k);
    const ctxM = metricsAt(ctx.items.map((r) => r.docId), c.relevant, Math.max(k, 8));
    rows.push({ id: c.id, query: c.query, intent: ctx.plan.intent, expectedIntent: c.intent ?? null, search: searchM, context: ctxM, missed: c.relevant.filter((r) => !ctx.items.some((i) => i.docId === r)) });
  }
  const agg = (mode) => ({ [`recall@${k}`]: mean(rows.map((r) => r[mode]), 'recall'), [`precision@${k}`]: mean(rows.map((r) => r[mode]), 'precision'), mrr: mean(rows.map((r) => r[mode]), 'mrr'), [`ndcg@${k}`]: mean(rows.map((r) => r[mode]), 'ndcg'), hitRate: mean(rows.map((r) => r[mode]), 'hit') });
  const intentAcc = rows.filter((r) => r.expectedIntent).length ? round(rows.filter((r) => r.expectedIntent && r.expectedIntent === r.intent).length / rows.filter((r) => r.expectedIntent).length) : null;

  let scenarios = null;
  if (scenarioGoldens) {
    const sc = readJsonl(scenarioGoldens);
    const srows = [];
    for (const g of sc) {
      const b = await scenarioBrief(cfg, { requirement: g.requirement });
      const newAcs = new Set(b.scenarios.filter((s) => s.status === 'new' && s.primary).map((s) => s.ac));
      const regress = new Set(b.scenarios.filter((s) => s.category === 'regression').map((s) => s.title.split(':')[0].replace('Regression guard for ', '')));
      const cats = new Set(b.scenarios.map((s) => s.category));
      const checks = [
        ...(g.expect.uncoveredAcs ?? []).map((a) => newAcs.has(a)),
        ...(g.expect.coveredAcs ?? []).map((a) => !newAcs.has(a)),
        ...(g.expect.regressionFor ?? []).map((d) => regress.has(d)),
        ...(g.expect.categories ?? []).map((c) => cats.has(c)),
        ...(g.expect.handoffs ?? []).map((h) => b.handoffs.some((x) => x.skill === h)),
        ...(g.expect.minQuestions != null ? [b.openQuestions.length >= g.expect.minQuestions] : []),
      ];
      srows.push({ requirement: g.requirement, passed: checks.filter(Boolean).length, total: checks.length });
    }
    scenarios = { accuracy: round(srows.reduce((a, r) => a + r.passed, 0) / Math.max(1, srows.reduce((a, r) => a + r.total, 0))), cases: srows };
  }
  return { k, cases: rows.length, search: agg('search'), context: agg('context'), intentAccuracy: intentAcc, scenarios, rows };
}
