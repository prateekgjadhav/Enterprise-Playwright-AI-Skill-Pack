// The QA knowledge graph: Requirements ↔ ACs ↔ Tests ↔ Executions ↔ Defects ↔ RCA ↔ Pages/Modules ↔ Pipelines
// ↔ Security findings ↔ Skills. Built deterministically from the ingested documents; every edge says where it
// came from, so a traceability claim can be checked. Edges are stored both ways (an inverse is "~rel").
const CLOSED = new Set(['closed', 'resolved', 'done', 'fixed', 'verified', 'wontfix', "won't fix", 'accepted']);
const PRIORITY_WEIGHT = { P0: 1.0, P1: 0.8, P2: 0.6, P3: 0.4 };
const norm = (s) => String(s ?? '').toLowerCase().replace(/\d+/g, '#').replace(/https?:\/\/\S+/g, 'URL').replace(/\s+/g, ' ').trim();

export function buildGraph(docs, { skills = [] } = {}) {
  const nodes = {}, edges = [];
  const node = (id, n) => { nodes[id] = { ...(nodes[id] ?? {}), id, ...n }; return id; };
  const edge = (from, rel, to, source) => { if (from && to && from !== to) edges.push({ from, rel, to, source }); };

  for (const d of docs) node(d.id, { acl: d.acl ?? ['*'], type: d.type, title: d.title, docId: d.id, path: d.provenance?.path, status: d.meta?.status ?? null, priority: d.meta?.priority ?? null, feature: d.meta?.feature ?? null });

  // requirements and their acceptance criteria
  for (const d of docs.filter((x) => x.type === 'requirement')) {
    for (const ac of d.meta.acceptanceCriteria ?? []) { const id = node(`${d.id}#${ac.id}`, { acl: d.acl ?? ['*'], type: 'ac', title: ac.text, docId: d.id }); edge(d.id, 'has-ac', id, 'requirement text'); }
  }
  // tests inside spec files
  const pagesByFixture = new Map(docs.filter((x) => x.type === 'page' || x.type === 'module').map((p) => [p.meta.fixture, p.id]));
  for (const d of docs.filter((x) => x.type === 'test')) {
    for (const t of d.meta.tests ?? []) {
      node(t.id, { acl: d.acl ?? ['*'], type: 'test-case', title: t.title, docId: d.id, path: d.provenance?.path, priority: t.priority, feature: t.feature, tags: t.tags, stats: { runs: 0, passed: 0, failed: 0, flaky: 0, retries: 0, lastStatus: null, lastError: null } });
      edge(d.id, 'contains', t.id, 'spec file');
      for (const r of t.requirements) edge(t.id, 'covers', r, 'test annotation or title');
      for (const ac of t.acs) edge(t.id, 'covers-ac', ac, 'test annotation');
      for (const f of t.fixtures) if (pagesByFixture.has(f)) edge(t.id, 'uses', pagesByFixture.get(f), 'fixture injection');
    }
  }
  const testNodes = Object.values(nodes).filter((n) => n.type === 'test-case');
  // playwright-bdd reports the generated file (.features-gen/<path>.feature.spec.js): map it back to the .feature
  const fromBddGen = (f) => String(f).replace(/^\.?\//, '').replace(/^(?:.*\/)?\.features-gen\//, '').replace(/\.feature\.spec\.[cm]?[jt]s$/, '.feature');
  const findTest = (file, title) => testNodes.find((n) => n.title === title && (!file || String(n.path ?? '').replace(/\.sample$/, '').endsWith(fromBddGen(file))));
  const resolve = (target) => {
    if (nodes[target]) return target;
    if (String(target).includes('::')) {
      const [file, title] = String(target).replace(/^test:/, '').split('::');
      return findTest(file, title)?.id ?? null;
    }
    return testNodes.find((n) => n.title === target)?.id ?? null;
  };
  // executions update test statistics
  for (const d of docs.filter((x) => x.type === 'execution')) {
    for (const r of d.meta.runs ?? []) {
      const t = findTest(r.file, r.title);
      if (!t) continue;
      const s = t.stats;
      s.runs++; s.retries += r.retries ?? 0;
      if (r.status === 'flaky') s.flaky++; else if (r.status === 'passed') s.passed++; else if (['failed', 'timedOut', 'interrupted'].includes(r.status)) s.failed++;
      s.lastStatus = r.status; if (r.error) s.lastError = r.error;
      edge(t.id, 'executed-in', d.id, 'test results');
    }
  }
  // declared links (defects, RCA, findings, front matter)
  for (const d of docs) for (const l of d.links ?? []) { const to = resolve(l.target); if (to) edge(d.id, l.rel, to, `${d.type} metadata`); else node(l.target, { type: 'unresolved', title: l.target }), edge(d.id, l.rel, l.target, `${d.type} metadata (target not ingested)`); }
  // a defect's signature seen in a test's last error links the two
  for (const d of docs.filter((x) => x.type === 'defect' && x.meta.signature)) {
    for (const t of testNodes) if (t.stats.lastError && norm(t.stats.lastError).includes(norm(d.meta.signature))) edge(d.id, 'observed-in', t.id, 'failure signature');
  }
  // pipelines run tests by tag
  for (const p of docs.filter((x) => x.type === 'pipeline')) for (const g of p.meta.greps) for (const t of testNodes) if ((t.tags ?? []).includes(g)) edge(p.id, 'runs', t.id, `--grep ${g}`);
  // findings that name a route attach to the page that serves it
  const pageByRoute = new Map(docs.filter((x) => x.type === 'page' && x.meta.route).map((p) => [p.meta.route, p.id]));
  for (const f of docs.filter((x) => x.type === 'finding' && x.meta.route)) if (pageByRoute.has(f.meta.route)) edge(f.id, 'affects', pageByRoute.get(f.meta.route), 'route');
  // skills and their "Not for" neighbours
  for (const s of skills) { node(`skill:${s.name}`, { type: 'skill', title: s.name, tier: s.tier }); for (const n of s.notForSkills ?? []) edge(`skill:${s.name}`, 'excludes', `skill:${n}`, 'Not for line'); }

  return finalize({ nodes, edges });
}

export function finalize(g) {
  const adj = {};
  const seen = new Set();
  g.edges = g.edges.filter((e) => { const k = `${e.from}|${e.rel}|${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; });
  for (const e of g.edges) {
    (adj[e.from] ??= []).push({ rel: e.rel, to: e.to });
    (adj[e.to] ??= []).push({ rel: `~${e.rel}`, to: e.from });
  }
  return { nodes: g.nodes, edges: g.edges, adj };
}

/** Breadth-first trace from a node, optionally restricted to relation names (with or without "~"). */
export function trace(g, start, { depth = 2, rels = null } = {}) {
  if (!g.nodes[start]) return { start, found: false, nodes: [], edges: [] };
  const seen = new Map([[start, 0]]), out = [], q = [start];
  while (q.length) {
    const n = q.shift(), d = seen.get(n);
    if (d >= depth) continue;
    for (const e of g.adj[n] ?? []) {
      if (rels && !rels.includes(e.rel) && !rels.includes(e.rel.replace(/^~/, ''))) continue;
      out.push({ from: n, rel: e.rel, to: e.to });
      if (!seen.has(e.to)) { seen.set(e.to, d + 1); q.push(e.to); }
    }
  }
  return { start, found: true, nodes: [...seen].map(([id, hops]) => ({ ...g.nodes[id], hops })), edges: out };
}

const neighbours = (g, id, rel) => (g.adj[id] ?? []).filter((e) => e.rel === rel).map((e) => e.to);

/** Requirement → Test → Execution → Defect → Risk, per requirement, with the gaps that matter. */
export function coverage(g, { requirement = null, feature = null } = {}) {
  const reqs = Object.values(g.nodes).filter((n) => n.type === 'requirement' && (!requirement || n.id === requirement) && (!feature || String(n.feature ?? '').toLowerCase() === String(feature).toLowerCase() || n.id === requirement));
  const rows = reqs.map((r) => {
    const children = neighbours(g, r.id, '~child-of').filter((c) => g.nodes[c]?.type === 'requirement');
    const acs = neighbours(g, r.id, 'has-ac');
    const childTests = children.flatMap((c) => [...neighbours(g, c, '~covers'), ...neighbours(g, c, 'has-ac').flatMap((a) => neighbours(g, a, '~covers-ac'))]);
    const tests = [...childTests, ...new Set([...neighbours(g, r.id, '~covers'), ...acs.flatMap((a) => neighbours(g, a, '~covers-ac'))])].map((t) => g.nodes[t]).filter((t) => t?.type === 'test-case');
    const acRows = acs.map((a) => ({ id: a, text: g.nodes[a].title, tests: neighbours(g, a, '~covers-ac') }));
    const defects = [...new Set([...neighbours(g, r.id, '~affects'), ...tests.flatMap((t) => [...neighbours(g, t.id, '~affects'), ...neighbours(g, t.id, '~observed-in')])])].map((d) => g.nodes[d]).filter((d) => d?.type === 'defect');
    const findings = neighbours(g, r.id, '~affects').map((f) => g.nodes[f]).filter((f) => f?.type === 'finding');
    const open = (x) => !CLOSED.has(String(x.status ?? '').toLowerCase());
    const failing = tests.filter((t) => ['failed', 'timedOut'].includes(t.stats?.lastStatus));
    const flaky = tests.filter((t) => (t.stats?.flaky ?? 0) > 0 || (t.stats?.retries ?? 0) > 0);
    const uncovered = acRows.filter((a) => !a.tests.length && !tests.some((t) => t.title.toUpperCase().includes(a.id.split('#')[1])));
    const w = PRIORITY_WEIGHT[String(r.priority ?? 'P2').toUpperCase()] ?? 0.6;
    const parts = {
      uncovered: acRows.length ? uncovered.length / acRows.length : (tests.length || children.length ? 0 : 1),
      failing: tests.length ? failing.length / tests.length : 0,
      flaky: tests.length ? flaky.length / tests.length : 0,
      openDefects: Math.min(1, defects.filter(open).length / 2),
      openFindings: Math.min(1, findings.filter(open).length),
    };
    const risk = Math.round(w * (0.4 * parts.uncovered + 0.2 * parts.failing + 0.1 * parts.flaky + 0.2 * parts.openDefects + 0.1 * parts.openFindings) * 100) / 100;
    return {
      requirement: r.id, title: r.title, priority: r.priority, feature: r.feature,
      acceptanceCriteria: acRows.map((a) => ({ ...a, covered: !uncovered.includes(a) })),
      tests: tests.map((t) => ({ id: t.id, title: t.title, lastStatus: t.stats?.lastStatus ?? 'not-run', flaky: t.stats?.flaky ?? 0, retries: t.stats?.retries ?? 0 })),
      defects: defects.map((d) => ({ id: d.id, title: d.title, status: d.status, rca: neighbours(g, d.id, '~explains').concat(neighbours(g, d.id, 'explained-by')) })),
      findings: findings.map((f) => ({ id: f.id, title: f.title, status: f.status })),
      risk, riskParts: parts, epic: children.length > 0, children,
    };
  });
  const gaps = rows.flatMap((r) => [
    ...r.acceptanceCriteria.filter((a) => !a.covered).map((a) => ({ kind: 'uncovered-ac', requirement: r.requirement, id: a.id, detail: a.text })),
    ...(r.tests.length || r.epic ? [] : [{ kind: 'untested-requirement', requirement: r.requirement, id: r.requirement, detail: r.title }]),
    ...r.defects.filter((d) => !d.rca.length && !CLOSED.has(String(d.status ?? '').toLowerCase())).map((d) => ({ kind: 'defect-without-rca', requirement: r.requirement, id: d.id, detail: d.title })),
    ...r.tests.filter((t) => t.flaky || t.retries).map((t) => ({ kind: 'unstable-test', requirement: r.requirement, id: t.id, detail: `${t.flaky} flaky run(s), ${t.retries} retries` })),
  ]);
  return { requirements: rows.sort((a, b) => b.risk - a.risk), gaps };
}

/** Changed files → pages/modules/specs → tests → requirements: the narrowest tests a change needs. */
export function impact(g, files) {
  const changed = files.map((f) => String(f).replace(/^\.\//, ''));
  const hit = Object.values(g.nodes).filter((n) => n.path && changed.some((f) => String(n.path).replace(/\.sample$/, '') === f));
  const tests = new Set();
  for (const n of hit) {
    if (n.type === 'page' || n.type === 'module') neighbours(g, n.id, '~uses').forEach((t) => tests.add(t));
    if (n.type === 'test') neighbours(g, n.id, 'contains').forEach((t) => tests.add(t));
    if (n.type === 'test-case') tests.add(n.id);
  }
  const requirements = new Set([...tests].flatMap((t) => [...neighbours(g, t, 'covers'), ...neighbours(g, t, 'covers-ac').map((a) => a.split('#')[0])]));
  return {
    changed, matched: hit.map((n) => n.id),
    tests: [...tests].map((t) => ({ id: t, title: g.nodes[t]?.title, path: g.nodes[t]?.path, grep: g.nodes[t]?.title })),
    requirements: [...requirements],
    note: hit.length ? null : 'no ingested node matches these files; run ingest, or the change touches nothing the graph knows',
  };
}
