// The query planning agent. Before any retrieval it decides what the request is (intent), what it names
// (entities), which collections hold the answer, which sub-queries to run, which graph hops to follow
// (multi-hop: Requirement → Test → Execution → Defect → RCA → Resolution), and how to weight the retrievers.
// Deterministic, so the plan is explainable and testable; an LLM can refine it with prompts/query-planner.md.
import { TICKET_RE, CVE_RE, tokenize } from '../lib/util.mjs';

export const INTENTS = {
  generate_tests: {
    re: /\b(generat|write|add|automat|creat|cover|extend|design)\w*\b.*\b(tests?|specs?|scenarios?|cases?|e2e|smoke|regression)\b|\btest (scenarios?|cases?|plan|ideas)\b|\bscenarios?\b/i,
    types: ['requirement', 'test-case', 'test-plan', 'test', 'defect', 'rca', 'pattern', 'memory-project', 'memory-team', 'page', 'app-flow', 'app-page'],
    rels: ['has-ac', '~covers', '~covers-ac', '~affects', '~observed-in', '~explains', 'explained-by', 'uses', 'child-of', '~child-of', 'executed-in'],
    templates: ['{f} acceptance criteria', '{f} existing tests', '{f} defect root cause regression', '{f} flaky unstable timing', '{f} test data pattern'],
    skill: 'scenario-design',
  },
  analyse_failure: {
    re: /\b(fail|failing|failed|failure|error|broke|broken|red|flaky|intermittent|trace|root cause|rca|why did)\w*\b/i,
    types: ['rca', 'defect', 'execution', 'test', 'pattern', 'memory-project'],
    rels: ['executed-in', '~observed-in', '~affects', '~explains', 'explained-by', 'covers', 'uses'],
    templates: ['{f} root cause', '{f} known defect', '{f} flaky fix pattern'],
    skill: 'failure-rca',
  },
  coverage: {
    re: /\b(coverage|traceab\w*|gaps?|untested|uncovered|matrix|which requirements)\b/i,
    types: ['requirement', 'test', 'execution', 'defect'],
    rels: ['has-ac', '~covers', '~covers-ac', 'executed-in', '~affects'],
    templates: ['{f} requirements', '{f} tests'],
    skill: 'knowledge-retrieval',
  },
  impact: {
    re: /\b(impact\w*|affected tests|which tests (?:should|to|do i) run|test selection|changed files?|blast radius)\b/i,
    types: ['page', 'module', 'test', 'requirement', 'app-page'],
    rels: ['~uses', 'contains', 'covers', 'covers-ac'],
    templates: ['{f} page object', '{f} tests'],
    skill: 'test-impact-selection',
  },
  migrate: {
    re: /\b(migrat\w*|selenium|cypress|robot framework|testng|convert\w*|port(?:ing)?)\b/i,
    types: ['pattern', 'memory-team', 'decision', 'test'],
    rels: ['relates'],
    templates: ['{f} migration pattern', '{f} equivalent playwright'],
    skill: 'migration-analysis',
  },
  security: {
    re: /\b(security|idor|xss|sqli|injection|csrf|ssrf|owasp|cve|vulnerab\w*|finding|authoris\w*|authoriz\w*|access control)\b/i,
    types: ['finding', 'requirement', 'pattern', 'memory-team', 'test'],
    rels: ['affects', '~affects', 'relates'],
    templates: ['{f} security finding', '{f} access control requirement'],
    skill: 'security-scope-verify',
  },
  general: { re: /./, types: [], rels: ['relates', 'has-ac', '~covers', '~affects', '~explains'], templates: [], skill: null },
};

/** Entities the query names, resolved against what the index actually knows. */
export function extractEntities(query, known = { ids: new Set(), features: [] }) {
  const q = String(query);
  const tickets = [...new Set(q.match(TICKET_RE) ?? [])];
  const cves = [...new Set((q.match(CVE_RE) ?? []).map((c) => c.toUpperCase()))];
  const quoted = [...q.matchAll(/["“'`]([^"”'`]{4,160})["”'`]/g)].map((m) => m[1]);
  const errors = [...q.matchAll(/((?:Error|TimeoutError|expect\(.*?\))[^\n]{0,160})/g)].map((m) => m[1].trim());
  const files = [...new Set(q.match(/[\w./-]+\.(?:spec\.)?[jt]sx?\b/g) ?? [])];
  const pages = [...new Set(q.match(/\b[A-Z][A-Za-z]+(?:Page|Module|Component)\b/g) ?? [])];
  const qt = new Set(tokenize(q));
  const features = known.features.filter((f) => tokenize(f).every((t) => qt.has(t)));
  const resolved = [...tickets, ...cves, ...pages.map((p) => `page:${p}`), ...pages.map((p) => `module:${p}`)].filter((id) => known.ids.has(id));
  return { tickets, cves, quoted, errors, files, pages, features, resolved };
}

export function classify(query) {
  const scores = Object.entries(INTENTS).filter(([k]) => k !== 'general').map(([k, v]) => [k, (String(query).match(new RegExp(v.re.source, 'gi')) ?? []).length]);
  scores.sort((a, b) => b[1] - a[1]);
  const top = scores[0][1] > 0 ? scores[0][0] : 'general';
  return { intent: top, secondary: scores.filter(([k, s]) => s > 0 && k !== top).map(([k]) => k), scores: Object.fromEntries(scores) };
}

export function planQuery(query, known, cfg, { intent: forced = null } = {}) {
  const cls = classify(query);
  const intent = forced && INTENTS[forced] ? forced : cls.intent;
  const spec = INTENTS[intent];
  const entities = extractEntities(query, known);
  const focus = entities.features[0] ?? entities.tickets[0] ?? tokenize(query).filter((t) => t.length > 3).slice(0, 3).join(' ');
  const subQueries = [{ q: query, why: 'the request as asked' }];
  for (const tk of entities.tickets) subQueries.push({ q: tk, why: `exact identifier ${tk}` });
  for (const e of [...entities.errors, ...entities.quoted].slice(0, 3)) subQueries.push({ q: e, why: 'exact error or phrase (BM25)' });
  for (const t of spec.templates) if (focus) subQueries.push({ q: t.replace('{f}', focus), why: `intent ${intent}` });
  const exact = entities.tickets.length + entities.cves.length + entities.errors.length + entities.quoted.length > 0;
  const w = cfg.rag.retrieval.weights;
  const weights = { bm25: w.bm25 * (exact ? 1.3 : 1), vector: w.vector * (exact ? 0.9 : 1.2), graph: w.graph * (entities.resolved.length ? 1.3 : 1) };
  return {
    query, intent, secondaryIntents: cls.secondary, suggestedSkill: spec.skill, entities, focus,
    collections: spec.types, subQueries: dedupe(subQueries), graph: { seeds: entities.resolved, rels: spec.rels, maxHops: cfg.rag.retrieval.multiHop ? cfg.rag.retrieval.maxHops : 1 },
    weights,
  };
}
const dedupe = (list) => { const s = new Set(); return list.filter((x) => (s.has(x.q.toLowerCase()) ? false : s.add(x.q.toLowerCase()))); };
