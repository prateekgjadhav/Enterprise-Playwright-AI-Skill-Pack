// Retrieval-aware test scenario design: Requirement → existing tests → executions → defects → RCA → scenarios.
// The brief is deterministic and cites every element, so the model that writes the specs works from grounded
// scenarios instead of inventing them: what is already covered (do not duplicate), what is missing, which past
// defects need a regression guard, which tests are unstable and why, and what to ask before writing code.
import { getState, retrieveContext, visibleGraph } from './pipeline.mjs';
import { coverage } from '../graph/graph.mjs';
import { extractTickets } from '../lib/util.mjs';

const VAGUE = /\b(fast|quick(ly)?|appropriate(ly)?|user[- ]friendly|intuitive|properly|correct(ly)?|reasonable|as expected|etc\.?|tbd|tbc|some|various|seamless(ly)?|easy)\b/i;
const ROLES = /\b(admin(istrator)?s?|guest|anonymous|logged[- ]out|customer|another user|other users?|owner|manager|support agent|role|permission|unauthori[sz]ed)\b/i;
const NEGATIVE = /\b(invalid|expired|wrong|incorrect|error|reject\w*|denied|must not|cannot|can't|not allowed|only|unless|fail\w*|blocked|locked)\b/i;
const INPUT = /\b(enter|apply|submit|input|field|form|type|upload|code|password|email|quantity|amount)\b/i;
const REPEAT = /\b(again|twice|already|repeat\w*|once|duplicate|refresh|back button|concurrent\w*)\b/i;
const HANDOFF = [
  [/\b(latency|load time|under load|\d+\s*(?:seconds?|ms)|performance|speed|quick(?:ly)?|fast|response time|core web vitals|lcp|inp)\b/i, 'performance-vitals', 'timing or load expectations'],
  [/\b(accessib\w*|screen reader|keyboard|wcag|contrast|focus)\b/i, 'accessibility-audit', 'accessibility expectations'],
  [/\b(api|endpoint|status code|json|schema|contract)\b/i, 'api-test-authoring', 'endpoint or contract behaviour'],
  [/\b(idor|another user|other users?|unauthori[sz]ed|role|permission|session|token|csrf|xss|inject\w*)\b/i, 'security-scope-verify', 'authorisation or input-handling controls'],
  [/\b(mobile|phone|touch|responsive|tablet|orientation)\b/i, 'mobile-emulation', 'device behaviour'],
];

function boundaries(text) {
  const out = [];
  for (const m of String(text).matchAll(/(?:(up to|at most|maximum(?: of)?|max|no more than|at least|minimum(?: of)?|min|over|under|more than|less than|exactly)\s+)?([£$€]?)(\d+(?:\.\d+)?)\s*((?:[a-z-]+\s+)?(?:%|characters?|chars?|items?|days?|hours?|minutes?|seconds?|attempts?|times|units?|orders?|coupons?)\b|%)?/gi)) {
    const n = Number(m[3]); const unit = (m[4] ?? '').trim(); const cur = m[2] ?? ''; const q = (m[1] ?? '').toLowerCase();
    if (!Number.isFinite(n) || (!q && !unit && !cur)) continue;
    const step = Number.isInteger(n) ? 1 : 0.01;
    const fmt = (x) => `${cur}${Number.isInteger(n) ? x : x.toFixed(2)}${unit ? ' ' + unit : ''}`;
    out.push({ value: n, label: `${q ? q + ' ' : ''}${fmt(n)}`, probes: [fmt(n - step), fmt(n), fmt(n + step)] });
  }
  return out;
}

function scenariosForAc(req, ac, covered, cite) {
  const s = [];
  const pri = String(req.priority ?? 'P1').toUpperCase();
  const lower = { P0: 'P1', P1: 'P2', P2: 'P2', P3: 'P3' }[pri] ?? 'P2';
  const base = { requirement: req.requirement, ac: ac.id.split('#')[1] ?? ac.id, evidence: [cite] };
  const isNegative = NEGATIVE.test(ac.text) && !/\bonly one\b/i.test(ac.text);
  s.push({ ...base, category: isNegative ? 'negative' : 'positive', primary: true, priority: pri, title: ac.text,
    given: 'the preconditions the criterion implies, set through API fixtures', when: 'the user performs the action the criterion describes', then: ac.text,
    status: covered.length ? 'covered' : 'new', coveredBy: covered });
  if (!VAGUE.test(ac.text) && INPUT.test(ac.text)) {
    const inverted = /\bvalid\b/i.test(ac.text) && !isNegative ? ac.text.replace(/\ba valid\b/i, 'an invalid').replace(/\bvalid\b/i, 'invalid').replace(/\b(shows|reduces|applies|lands|succeeds)\b.*$/i, 'is rejected with a clear message and nothing changes') : null;
    s.push({ ...base, category: 'negative', priority: lower,
      title: inverted ?? (isNegative ? `Other rejected inputs for the same rule: empty, malformed, surrounding whitespace, wrong case — ${ac.id.split('#')[1] ?? ac.id}` : `Empty or malformed input is refused — ${ac.text}`),
      given: 'the same preconditions', when: 'an input the rule excludes is used', then: 'the action is refused with a clear message and no state changes', status: 'new', dataDriven: isNegative });
  }
  for (const b of boundaries(ac.text)) {
    s.push({ ...base, category: 'boundary', priority: lower, title: `Boundary around ${b.label}`, given: 'the preconditions', when: `values ${b.probes.join(', ')} are used`, then: `behaviour changes exactly at ${b.label} and not before`, probes: b.probes, status: 'new', dataDriven: true });
  }
  if (ROLES.test(ac.text)) {
    s.push({ ...base, category: 'permission', priority: pri, title: `Role matrix — ${ac.text}`, given: 'one context per role (apiAs(role)): owner, other customer, admin, signed out', when: 'each role attempts the action', then: 'permitted roles succeed; others are refused and see nothing they should not', status: 'new', handoff: 'authz-session-testing' });
  }
  if (REPEAT.test(ac.text)) {
    s.push({ ...base, category: 'state', priority: lower, title: `Repeated or concurrent attempt: ${ac.text}`, given: 'the action has already happened once', when: 'it is repeated (again, refresh, back, a second tab)', then: 'the outcome is idempotent and consistent', status: 'new' });
  }
  return s;
}

/** Build the scenario brief for a requirement id, or for a free-text feature request. */
export async function scenarioBrief(cfg, { requirement = null, query = null, budgetTokens = null } = {}) {
  const st = getState(cfg);
  let reqId = requirement ?? extractTickets(query ?? '').find((t) => st.graph.nodes[t]?.type === 'requirement') ?? null;
  const ctxQuery = query ?? (reqId ? `${reqId} ${st.graph.nodes[reqId]?.title ?? ''}` : '');
  const ctx = await retrieveContext(cfg, `generate test scenarios ${ctxQuery}`, { intent: 'generate_tests', budgetTokens });
  if (!reqId) reqId = ctx.items.find((i) => i.type === 'requirement')?.docId ?? null;
  const graph = visibleGraph(cfg, st);
  const cov = reqId ? coverage(graph, { requirement: reqId }).requirements[0] : null;
  const cite = (docId) => ctx.items.find((i) => i.docId === docId)?.cite ?? docId;

  const scenarios = [];
  const questions = [];
  const handoffs = new Map();
  if (cov) {
    for (const ac of cov.acceptanceCriteria) {
      const coveredBy = ac.tests.length ? ac.tests : cov.tests.filter((t) => t.title.toUpperCase().includes(ac.id.split('#')[1])).map((t) => t.id);
      scenarios.push(...scenariosForAc(cov, ac, coveredBy, cite(reqId)));
      if (VAGUE.test(ac.text)) questions.push({ ac: ac.id, question: `"${ac.text}" is not measurable (${ac.text.match(VAGUE)[0]}): what exact outcome or threshold should the test assert?` });
      for (const [re, skill, why] of HANDOFF) if (re.test(ac.text)) handoffs.set(skill, { skill, why, acs: [...(handoffs.get(skill)?.acs ?? []), ac.id] });
    }
    if (!cov.acceptanceCriteria.length && !cov.epic) questions.push({ ac: null, question: `${reqId} has no numbered acceptance criteria: confirm the expected behaviours before writing a P0 test.` });
  }
  if (!cov) questions.push({ ac: null, question: 'No requirement in the knowledge index matches this request: share the ticket id or its acceptance criteria (or add it under knowledge/requirements/ and re-ingest) before designing scenarios.' });
  // regression guards from past defects and their root causes
  const defects = cov?.defects ?? ctx.items.filter((i) => i.type === 'defect').map((i) => ({ id: i.docId, title: i.title, status: null, rca: [] }));
  for (const d of defects) {
    const dd = st.docsById.get(d.id);
    const rcaDoc = (d.rca ?? []).map((r) => st.docsById.get(r)).find(Boolean);
    const cause = rcaDoc?.meta?.rootCause ?? dd?.meta?.rootCause ?? /Root cause:\s*(.+)/i.exec(rcaDoc?.text ?? dd?.text ?? '')?.[1] ?? null;
    scenarios.push({ requirement: reqId, ac: null, category: 'regression', priority: String(cov?.priority ?? 'P1').toUpperCase(), title: `Regression guard for ${d.id}: ${d.title}`,
      given: 'the conditions that produced the defect', when: 'the same flow is exercised', then: cause ? `the defect does not recur (root cause: ${cause})` : 'the defect does not recur', status: 'new',
      evidence: [cite(d.id), ...(rcaDoc ? [cite(rcaDoc.id)] : [])] });
  }
  // security findings on this requirement become guard scenarios for the security skills (findings are ACL-filtered)
  for (const f of cov?.findings ?? []) {
    scenarios.push({ requirement: reqId, ac: null, category: 'security', priority: 'P0', title: `Security guard for ${f.id}: ${f.title}`,
      given: 'two customers and an admin, each with their own data', when: 'the control the finding describes is exercised against staging', then: 'the control holds (no data from another user, correct status code)',
      status: /closed|resolved|fixed|verified/i.test(f.status ?? '') ? 'regression' : 'new', handoff: 'authz-session-testing', evidence: [cite(f.id)] });
    handoffs.set('security-scope-verify', { skill: 'security-scope-verify', why: `open finding ${f.id}`, acs: [...(handoffs.get('security-scope-verify')?.acs ?? []), f.id] });
  }
  // stability notes from unstable tests and retrieved patterns
  const stability = [];
  for (const t of cov?.tests ?? []) if (t.flaky || t.retries) stability.push({ test: t.id, note: `${t.flaky} flaky run(s), ${t.retries} retries: fix the cause before extending this test (flake-triage)` });
  for (const p of ctx.items.filter((i) => i.type === 'pattern' || i.type === 'memory-team' || i.type === 'memory-project').slice(0, 4)) stability.push({ pattern: p.docId, note: `apply: ${p.title}`, evidence: [p.cite] });
  // pages the scenarios can reuse
  const pages = [...new Set((cov?.tests ?? []).flatMap((t) => (graph.adj[t.id] ?? []).filter((e) => e.rel === 'uses').map((e) => e.to)))];
  for (const i of ctx.items.filter((x) => x.type === 'page')) if (!pages.includes(i.docId)) pages.push(i.docId);

  scenarios.forEach((s, i) => { s.id = `${reqId ?? 'REQ'}-S${String(i + 1).padStart(2, '0')}`; s.tags = [`@${s.priority}`, `@${cov?.feature ?? 'feature'}`, s.category === 'regression' ? '@regression' : s.priority === 'P0' && s.category === 'positive' ? '@smoke' : '@regression']; });
  const brief = {
    requirement: reqId, title: cov?.title ?? null, priority: cov?.priority ?? null, feature: cov?.feature ?? null, risk: cov?.risk ?? null,
    coverage: cov ? { acs: cov.acceptanceCriteria.length, covered: cov.acceptanceCriteria.filter((a) => a.covered).length, tests: cov.tests } : null,
    scenarios, newScenarios: scenarios.filter((s) => s.status === 'new').length,
    stability, reusablePages: pages, handoffs: [...handoffs.values()], openQuestions: questions,
    grounding: ctx.items.length ? ctx.items.map((i) => ({ cite: i.cite, title: i.title, type: i.type, trust: i.trust })) : 'no historical grounding',
    context: ctx, nextStep: 'spec-authoring: write specs for the scenarios with status "new"; skip "covered" ones unless strengthening them',
  };
  return brief;
}

export function briefMarkdown(b) {
  const L = [];
  L.push(`# Test scenario brief — ${b.requirement ?? 'free-text request'}${b.title ? `: ${b.title}` : ''}`, '');
  if (b.coverage) L.push(`Priority ${b.priority ?? '—'} · feature ${b.feature ?? '—'} · risk ${b.risk} · ACs covered ${b.coverage.covered}/${b.coverage.acs} · existing tests ${b.coverage.tests.length}`, '');
  L.push('| ID | AC | Category | Priority | Scenario | Status | Evidence |', '|---|---|---|---|---|---|---|');
  for (const s of b.scenarios) L.push(`| ${s.id} | ${s.ac ?? '—'} | ${s.category} | ${s.priority} | ${s.title.replace(/\|/g, '\\|')}${s.probes ? ` (probes: ${s.probes.join(', ')})` : ''} | ${s.status}${s.coveredBy?.length ? ` by ${s.coveredBy.length} test(s)` : ''} | ${(s.evidence ?? []).map((e) => `[ctx:${e}]`).join(' ')} |`);
  if (b.stability.length) { L.push('', '## Stability notes'); for (const n of b.stability) L.push(`- ${n.test ?? n.pattern}: ${n.note}`); }
  if (b.handoffs.length) { L.push('', '## Hand-offs'); for (const h of b.handoffs) L.push(`- ${h.skill}: ${h.why} (${h.acs.join(', ')})`); }
  if (b.reusablePages.length) L.push('', `Reusable page objects: ${b.reusablePages.join(', ')}`);
  if (b.openQuestions.length) { L.push('', '## Open questions (ask before writing a P0 test)'); for (const q of b.openQuestions) L.push(`- ${q.question}`); }
  L.push('', `Grounding: ${Array.isArray(b.grounding) ? b.grounding.map((g) => `[ctx:${g.cite}] ${g.title}`).join('; ') : b.grounding}`);
  return L.join('\n');
}
