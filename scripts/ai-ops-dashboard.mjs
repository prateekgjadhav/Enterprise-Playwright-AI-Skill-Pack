#!/usr/bin/env node
// AI-Ops dashboard: a self-contained HTML page and a Prometheus text file built from what the pack records.
//   .agents/telemetry/ai-ops.jsonl     retrieval, ingest and MCP tool events (rag/telemetry/aiops.mjs)
//   .agents/telemetry/llm-calls.jsonl  LLM-call metadata from telemetry-instrumentation (model, tokens, cost, prompt, ok)
//   evals/results/history.jsonl        retrieval benchmark, KPIs, DeepEval, RAGAS and gate decisions over time
//   the knowledge index                documents, chunks, graph size, staleness, quarantine
// Usage: node scripts/ai-ops-dashboard.mjs [--root <dir>] [--out reports/ai-ops]
// Decision metadata only: no prompt text, no retrieved content. The output never leaves the machine unless
// someone publishes it (an approval attestation for dashboard-publish).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const root = resolve(opt('root', '.'));
const outDir = join(root, opt('out', 'reports/ai-ops'));
const jsonl = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const events = jsonl(join(root, '.agents/telemetry/ai-ops.jsonl'));
const llm = jsonl(join(root, '.agents/telemetry/llm-calls.jsonl'));
const history = jsonl(join(root, 'evals/results/history.jsonl'));
let status = null;
try { const { loadConfig } = await import(new URL('../rag/lib/config.mjs', import.meta.url)); const { status: st } = await import(new URL('../rag/ingestion/ingest.mjs', import.meta.url)); status = st(loadConfig(root)); } catch { status = null; }

const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (x) => (x === null || x === undefined ? '—' : Math.round(x * 100) / 100);
const ctx = events.filter((e) => e.event === 'context' || e.event === 'search');
const tools = events.filter((e) => e.event === 'tool');
const ingests = events.filter((e) => e.event === 'ingest');
const byTool = {};
for (const t of tools) { const x = (byTool[t.tool] ??= { calls: 0, ok: 0, ms: [] }); x.calls++; if (t.ok) x.ok++; x.ms.push(t.ms); }
const byPrompt = {};
for (const c of llm) { const k = c.prompt ?? c.skill ?? 'unlabelled'; const x = (byPrompt[k] ??= { calls: 0, ok: 0, tokens: 0, cost: 0 }); x.calls++; if (c.ok !== false) x.ok++; x.tokens += (c.promptTokens ?? 0) + (c.completionTokens ?? 0); x.cost += c.costUsd ?? 0; }

const m = {
  retrievals: ctx.length,
  latencyP50: pct(ctx.map((e) => e.totalMs).filter(Number.isFinite), 50), latencyP95: pct(ctx.map((e) => e.totalMs).filter(Number.isFinite), 95),
  avgHits: avg(ctx.map((e) => e.hits ?? 0)), avgCompression: avg(ctx.map((e) => e.compression).filter(Number.isFinite)),
  contextTokens: ctx.reduce((a, e) => a + (e.tokensOut ?? 0), 0), tokensSaved: ctx.reduce((a, e) => a + Math.max(0, (e.tokensIn ?? 0) - (e.tokensOut ?? 0)), 0),
  contextCost: ctx.reduce((a, e) => a + (e.costUsd ?? 0), 0), rerankFallbacks: ctx.filter((e) => e.reranker === 'lexical-cross').length,
  aclFiltered: ctx.reduce((a, e) => a + (e.filtered?.deniedAcl ?? 0), 0), quarantinedFiltered: ctx.reduce((a, e) => a + (e.filtered?.quarantined ?? 0), 0),
  llmCalls: llm.length, llmTokens: llm.reduce((a, c) => a + (c.promptTokens ?? 0) + (c.completionTokens ?? 0), 0), llmCost: llm.reduce((a, c) => a + (c.costUsd ?? 0), 0),
  toolSuccess: tools.length ? tools.filter((t) => t.ok).length / tools.length : null,
};
const series = (kind, key) => history.filter((h) => h.kind === kind && Number.isFinite(h[key])).map((h) => h[key]);
const spark = (xs, { min = 0, max = 1 } = {}) => {
  if (xs.length < 2) return '<span class="muted">not enough runs yet</span>';
  const w = 160, h = 36, lo = Math.min(min, ...xs), hi = Math.max(max, ...xs);
  const pts = xs.map((v, i) => `${(i / (xs.length - 1)) * w},${h - ((v - lo) / ((hi - lo) || 1)) * h}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="trend"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts}"/></svg>`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gate = (() => { try { return JSON.parse(readFileSync(join(root, 'evals/results/gate.json'), 'utf8')); } catch { return null; } })();
const card = (label, value, sub = '') => `<div class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${sub}</div></div>`;
const trends = [
  ['Context recall@5', series('retrieval', 'recall@5')], ['MRR', series('retrieval', 'mrr')], ['Scenario accuracy', series('retrieval', 'scenarioAccuracy')],
  ['Hallucination rate', series('kpis', 'hallucination_rate')], ['Assertion quality', series('kpis', 'assertion_quality')], ['Locator quality', series('kpis', 'locator_quality')],
  ['Flakiness prediction', series('kpis', 'flakiness_prediction')], ['DeepEval average', series('deepeval', 'averageScore')], ['RAGAS faithfulness', series('ragas', 'faithfulness')],
];

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>AI Ops — knowledge layer and AI quality</title>
<style>:root{--bg:#f7f8fa;--surface:#fff;--ink:#18202b;--muted:#56606e;--rule:#dde2e8;--accent:#1f5f8b;--ok:#2d7d4f;--bad:#b3261e;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#11161d;--surface:#161c24;--ink:#e3e8ee;--muted:#9aa5b2;--rule:#2a333e;--accent:#7db7e0;--ok:#6cc596;--bad:#f2b8b5;color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:1.5rem clamp(1rem,4vw,3rem)}
h1{font-size:1.6rem;margin:0 0 .25rem}h2{font-size:1.1rem;margin:2rem 0 .75rem;border-top:1px solid var(--rule);padding-top:1rem}.muted,.sub{color:var(--muted);font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem}.card{background:var(--surface);border:1px solid var(--rule);border-radius:10px;padding:.8rem 1rem}
.label{color:var(--muted);font-size:.8rem}.value{font-size:1.4rem;font-weight:600}.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:var(--surface)}
th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid var(--rule);font-size:.9rem}.pass{color:var(--ok)}.fail{color:var(--bad)}.skipped{color:var(--muted)}</style></head><body>
<h1>AI Ops</h1><p class="muted">Generated ${esc(new Date().toISOString())} from local telemetry and eval results. Decision metadata only.</p>
<h2>Release gate</h2>${gate ? `<p class="${gate.decision === 'go' ? 'pass' : 'fail'}"><strong>${gate.decision.toUpperCase()}</strong> · ${gate.failed} failed check(s) · ${esc(gate.at)}</p><div class="wrap"><table><tr><th>Check</th><th>Value</th><th>Threshold</th><th>Status</th></tr>${gate.rows.map((r) => `<tr><td>${esc(r.group)}.${esc(r.metric)}</td><td>${esc(r.value ?? '—')}</td><td>${esc(r.threshold ?? '')}</td><td class="${r.status}">${r.status}</td></tr>`).join('')}</table></div>` : '<p class="muted">No gate run yet: node scripts/ai-release-gate.mjs</p>'} // qa-scan: not-a-secret
<h2>Retrieval performance</h2><div class="grid">${card('Retrievals', m.retrievals)}${card('Latency p50 / p95', `${r2(m.latencyP50)} / ${r2(m.latencyP95)} ms`)}${card('Avg items per pack', r2(m.avgHits))}${card('Compression ratio', r2(m.avgCompression), 'tokens out ÷ tokens in')}${card('Context tokens served', m.contextTokens)}${card('Tokens saved', m.tokensSaved, 'by compression and de-duplication')}${card('Context cost (est.)', `$${r2(m.contextCost)}`)}${card('Reranker fallbacks', m.rerankFallbacks, 'lexical-cross used')}</div>
<h2>Knowledge index (vector store)</h2><div class="grid">${status?.docs !== undefined ? card('Documents / chunks', `${status.docs} / ${status.chunks}`) + card('Graph nodes / edges', `${status.nodes} / ${status.edges}`) + card('Embedder', status.embedder?.id ?? '—') + card('Index age', `${status.ageHours} h`, status.advice) + card('Stale sources', status.staleSources.length) + card('Quarantined', status.quarantined.length, status.quarantined.join(', ')) : card('Index', 'not built', 'node rag/cli.mjs ingest')}${card('Last ingest', ingests.length ? `${r2(ingests[ingests.length - 1].ms)} ms` : '—', ingests.length ? `${ingests[ingests.length - 1].reused ?? 0} embeddings reused` : '')}${card('ACL-filtered chunks', m.aclFiltered)}${card('Quarantine-filtered', m.quarantinedFiltered)}</div>
<h2>Tools, prompts and cost</h2><div class="grid">${card('MCP tool success', m.toolSuccess === null ? '—' : `${Math.round(m.toolSuccess * 100)}%`)}${card('LLM calls', m.llmCalls)}${card('LLM tokens', m.llmTokens)}${card('LLM cost', `$${r2(m.llmCost)}`)}</div>
<div class="wrap"><table><tr><th>MCP tool</th><th>Calls</th><th>Success</th><th>p95 ms</th></tr>${Object.entries(byTool).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.calls}</td><td>${Math.round((v.ok / v.calls) * 100)}%</td><td>${r2(pct(v.ms, 95))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">no tool calls recorded</td></tr>'}</table></div>
<div class="wrap" style="margin-top:.75rem"><table><tr><th>Prompt / skill</th><th>Calls</th><th>Success</th><th>Tokens</th><th>Cost</th></tr>${Object.entries(byPrompt).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.calls}</td><td>${Math.round((v.ok / v.calls) * 100)}%</td><td>${v.tokens}</td><td>$${r2(v.cost)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">no LLM-call records (telemetry-instrumentation writes .agents/telemetry/llm-calls.jsonl)</td></tr>'}</table></div>
<h2>Quality trends</h2><div class="wrap"><table><tr><th>Metric</th><th>Latest</th><th>Trend</th></tr>${trends.map(([n, xs]) => `<tr><td>${esc(n)}</td><td>${xs.length ? r2(xs[xs.length - 1]) : '—'}</td><td>${spark(xs)}</td></tr>`).join('')}</table></div>
</body></html>`;

const prom = [
  '# HELP qa_rag_retrievals_total Retrievals served by the knowledge layer', '# TYPE qa_rag_retrievals_total counter', `qa_rag_retrievals_total ${m.retrievals}`,
  '# HELP qa_rag_latency_ms Retrieval latency quantiles', '# TYPE qa_rag_latency_ms gauge', `qa_rag_latency_ms{quantile="0.5"} ${m.latencyP50 ?? 0}`, `qa_rag_latency_ms{quantile="0.95"} ${m.latencyP95 ?? 0}`,
  '# TYPE qa_rag_context_tokens_total counter', `qa_rag_context_tokens_total ${m.contextTokens}`, '# TYPE qa_rag_tokens_saved_total counter', `qa_rag_tokens_saved_total ${m.tokensSaved}`,
  '# TYPE qa_rag_index_documents gauge', `qa_rag_index_documents ${status?.docs ?? 0}`, '# TYPE qa_rag_index_stale_sources gauge', `qa_rag_index_stale_sources ${status?.staleSources?.length ?? 0}`,
  '# TYPE qa_llm_cost_usd_total counter', `qa_llm_cost_usd_total ${m.llmCost}`, '# TYPE qa_mcp_tool_success_ratio gauge', `qa_mcp_tool_success_ratio ${m.toolSuccess ?? 0}`,
  '# TYPE qa_ai_gate_go gauge', `qa_ai_gate_go ${gate ? (gate.decision === 'go' ? 1 : 0) : 0}`,
].join('\n') + '\n';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
writeFileSync(join(outDir, 'metrics.prom'), prom);
console.log(`ai-ops-dashboard: wrote ${join(outDir, 'index.html')} and metrics.prom (${events.length} events, ${llm.length} LLM calls, ${history.length} eval records)`);
