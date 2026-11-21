#!/usr/bin/env node
// The knowledge layer from the command line. Every MCP tool has a CLI twin, so CI and people can run the
// same thing the agent runs. Add --root <dir> to point at another repository and --json for machine output.
//
//   ingest                                   build or refresh the index (incremental: unchanged chunks reuse embeddings)
//   status                                   index health, staleness and quarantined documents
//   search   "<query>" [--collections a,b] [--k 8]
//   plan     "<query>"                       show the query plan (intent, entities, sub-queries, hops, weights)
//   context  "<query>" [--intent x] [--budget 2400]
//   scenarios <REQ-ID> | --query "<text>"   retrieval-aware scenario brief (--md for Markdown)
//   trace    <node-id> [--depth 2] [--rels a,b]
//   coverage [--requirement ID] [--feature f]
//   impact   <file> [file…]                  changed files → tests → requirements
//   kpi      [spec…]                         AI test-quality KPIs (writes evals/results/kpis.json with --write)
//   bench    [--goldens f] [--scenarios f]   retrieval benchmark (writes evals/results/retrieval.json with --write)
//   guard    scan <file> | check-output <file> [--context id,id]
//   memory   list [--scope s] | pending | write --scope s --kind k --title t --content c --evidence a,b
//            | approve <id> --by <identity> --attestation <bundle> | reject <id> | feedback <docId> --helpful|--unhelpful
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { ensureDir, appendJsonl, nowIso } from './lib/util.mjs';
import { ingest, status } from './ingestion/ingest.mjs';
import { search, retrieveContext, getState, visibleGraph } from './orchestration/pipeline.mjs';
import { planQuery } from './orchestration/planner.mjs';
import { scenarioBrief, briefMarkdown } from './orchestration/scenarios.mjs';
import { trace, coverage, impact } from './graph/graph.mjs';
import { scoreSpecs } from './evaluation/kpi.mjs';
import { runBenchmark } from './evaluation/benchmark.mjs';
import { scanInjection, validateOutput, redact } from './security/guard.mjs';
import { listMemory, listPending, proposeMemory, approveMemory, rejectMemory, recordFeedback } from './memory/memory.mjs';

const argv = process.argv.slice(2);
const opt = (name, def = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const flag = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['json', 'md', 'write', 'helpful', 'unhelpful', 'strict'].includes(argv[i - 1].slice(2))));
const [cmd, ...args] = positional;
const cfg = loadConfig(opt('root', process.cwd()));
const out = (obj, human) => { if (flag('json') || !human) console.log(JSON.stringify(obj, null, 2)); else console.log(human(obj)); };
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);
const resultsDir = () => ensureDir(join(cfg.root, 'evals/results'));

async function main() {
  switch (cmd) {
    case 'ingest': return out(await ingest(cfg), (s) => `ingested ${s.docs} documents → ${s.chunks} chunks, graph ${s.nodes} nodes / ${s.edges} edges` +
      `\n  added ${s.diff.added}, changed ${s.diff.changed}, removed ${s.diff.removed}; embeddings reused ${s.embeddingsReused}; redactions ${s.redactions}; injection-flagged ${s.injectionFlagged}` +
      `${s.quarantined.length ? `\n  quarantined: ${s.quarantined.join(', ')}` : ''}${s.errors.length ? `\n  errors: ${s.errors.map((e) => `${e.path}: ${e.error}`).join('; ')}` : ''}` +
      `\n  by collection: ${Object.entries(s.byCollection).map(([k, v]) => `${k} ${v}`).join(', ')}\n  ${s.timings.totalMs} ms${s.encrypted ? ' · encrypted at rest' : ''}`);
    case 'status': case 'doctor': { const s = status(cfg); out(s, (x) => x.error ?? `${x.advice}\n  built ${x.builtAt} (${x.ageHours} h ago) · ${x.docs} docs · ${x.chunks} chunks · ${x.nodes} nodes · ${x.edges} edges · ${x.embedder.id}` +
      `${x.staleSources.length ? `\n  stale: ${x.staleSources.join(', ')}` : ''}${x.missingSources.length ? `\n  missing: ${x.missingSources.join(', ')}` : ''}${x.quarantined.length ? `\n  quarantined: ${x.quarantined.join(', ')}` : ''}`); if (flag('strict') && !s.ok) process.exitCode = 1; return; }
    case 'search': return out(await search(cfg, args.join(' '), { collections: list(opt('collections')), k: Number(opt('k', 0)) || null }), (r) => r.results.map((h, i) => `${i + 1}. [${h.cite}] ${h.title} (${h.type}, trust ${h.trust}, score ${h.score})`).join('\n') || 'no results');
    case 'plan': { const st = getState(cfg); return out(planQuery(args.join(' '), st.known, cfg)); }
    case 'context': return out(await retrieveContext(cfg, args.join(' '), { intent: opt('intent'), budgetTokens: Number(opt('budget', 0)) || null }), (c) => `intent ${c.plan.intent} · ${c.items.length} items · ${c.stats.tokensOut}/${c.stats.tokensIn} tokens (×${c.stats.compressionRatio}) · reranker ${c.stats.reranker}\n` + c.items.map((i) => `- [ctx:${i.cite}] ${i.title} (${i.type}, trust ${i.trust})`).join('\n') + (c.warnings.length ? `\nwarnings: ${c.warnings.join('; ')}` : ''));
    case 'scenarios': { const b = await scenarioBrief(cfg, { requirement: args[0] ?? null, query: opt('query') }); const { context, ...rest } = b; if (flag('md')) return console.log(briefMarkdown(b)); return out(flag('json') ? rest : b, () => briefMarkdown(b)); }
    case 'trace': { const st = getState(cfg); return out(trace(visibleGraph(cfg, st), args[0], { depth: Number(opt('depth', 2)), rels: list(opt('rels')) }), (t) => (t.found ? t.edges.map((e) => `${e.from} -${e.rel}-> ${e.to}`).join('\n') : `no node ${t.start}`)); }
    case 'coverage': { const st = getState(cfg); return out(coverage(visibleGraph(cfg, st), { requirement: opt('requirement'), feature: opt('feature') }), (c) => c.requirements.map((r) => `${r.requirement} risk ${r.risk} · ACs ${r.acceptanceCriteria.filter((a) => a.covered).length}/${r.acceptanceCriteria.length} · tests ${r.tests.length} · open defects ${r.defects.filter((d) => !/closed|resolved|done|fixed/i.test(d.status ?? '')).length}`).join('\n') + `\n\ngaps:\n` + c.gaps.map((g) => `- ${g.kind} ${g.id}: ${g.detail}`).join('\n')); }
    case 'impact': { const st = getState(cfg); return out(impact(visibleGraph(cfg, st), args), (r) => r.note ?? `run: ${r.tests.map((t) => `"${t.title}"`).join(', ')}\nrequirements touched: ${r.requirements.join(', ') || 'none'}`); }
    case 'kpi': {
      let graph = null; try { graph = getState(cfg).graph; } catch { /* KPIs work without an index; history is then predicted */ }
      const r = scoreSpecs(cfg, args, graph);
      if (flag('write')) { writeFileSync(join(resultsDir(), 'kpis.json'), JSON.stringify({ at: nowIso(), ...r.metrics, counts: r.counts }, null, 2)); appendJsonl(join(resultsDir(), 'history.jsonl'), { at: nowIso(), kind: 'kpis', ...r.metrics }); }
      return out(r, (x) => Object.entries(x.metrics).map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n') + `\n${x.counts.tests} tests in ${x.counts.files} files · ${x.counts.unresolved} unresolved reference(s)` + x.specs.flatMap((s) => [...s.tests.filter((t) => t.unresolved.length).map((t) => `\n  ${t.title}: ${t.unresolved.join(', ')}`), ...s.badImports.map((b) => `\n  ${s.file}: import ${b} does not resolve`)]).join(''));
    }
    case 'bench': {
      const r = await runBenchmark(cfg, { goldens: opt('goldens', join(cfg.root, 'evals/goldens/retrieval.jsonl')), scenarioGoldens: opt('scenarios', join(cfg.root, 'evals/goldens/scenarios.jsonl')), k: Number(opt('k', 5)) });
      if (flag('write')) { writeFileSync(join(resultsDir(), 'retrieval.json'), JSON.stringify({ at: nowIso(), ...r }, null, 2)); appendJsonl(join(resultsDir(), 'history.jsonl'), { at: nowIso(), kind: 'retrieval', ...r.context, intentAccuracy: r.intentAccuracy, scenarioAccuracy: r.scenarios?.accuracy ?? null }); }
      return out(r, (x) => `retrieval over ${x.cases} golden queries (k=${x.k})\n  search : ${JSON.stringify(x.search)}\n  context: ${JSON.stringify(x.context)}\n  intent accuracy: ${x.intentAccuracy}${x.scenarios ? `\n  scenario accuracy: ${x.scenarios.accuracy}` : ''}` + x.rows.filter((r) => r.missed.length).map((r) => `\n  ${r.id} missed ${r.missed.join(', ')}`).join(''));
    }
    case 'guard': {
      const text = readFileSync(args[1], 'utf8');
      if (args[0] === 'scan') return out({ injection: scanInjection(text), redaction: (({ counts, total }) => ({ counts, total }))(redact(text, { allowDomains: cfg.rag.security.allowDomains })) });
      if (args[0] === 'check-output') { const v = validateOutput(text, { contextIds: list(opt('context')) ?? [], protectedHosts: cfg.productionHosts, allowDomains: cfg.rag.security.allowDomains }); out(v); if (!v.ok) process.exitCode = 1; return; }
      throw new Error('guard scan <file> | guard check-output <file>');
    }
    case 'memory': {
      const sub = args[0];
      if (sub === 'list') return out(listMemory(cfg, { scope: opt('scope'), kind: opt('kind') }));
      if (sub === 'pending') return out(listPending(cfg));
      if (sub === 'write') return out(proposeMemory(cfg, { scope: opt('scope'), kind: opt('kind'), title: opt('title'), content: opt('content'), evidence: list(opt('evidence')) ?? [], tags: list(opt('tags')) ?? [], author: opt('by', 'cli') }));
      if (sub === 'approve') { const r = approveMemory(cfg, args[1], opt('by'), opt('attestation')); out(r); if (!r.ok) process.exitCode = 1; return; }
      if (sub === 'reject') return out(rejectMemory(cfg, args[1]));
      if (sub === 'feedback') return out(recordFeedback(cfg, args[1], !flag('unhelpful')));
      throw new Error('memory list|pending|write|approve|reject|feedback');
    }
    default:
      console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      if (cmd) process.exitCode = 64;
  }
}
main().catch((e) => { console.error(`rag: ${e.message}`); process.exit(1); });
