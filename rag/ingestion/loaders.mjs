// Loaders turn repository artefacts into normalised documents with typed metadata and links, which the
// chunker, the indexes and the knowledge graph all share. Each loader is deterministic and read-only.
import { basename, extname } from 'node:path';
import { parseFrontMatter, extractTickets, splitCamel } from '../lib/util.mjs';

const PRIORITY = /^@P[0-3]$/;
const NON_FEATURE = new Set(['@smoke', '@regression', '@api', '@security', '@visual', '@a11y', '@perf', '@mobile', '@synthetic', '@resilience', '@flaky', '@quarantine']);
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(/\s*,\s*/)).map(String).filter(Boolean);
const titleFrom = (body, fallback) => /^#\s+(.+)$/m.exec(body)?.[1].trim() ?? fallback;

/** Acceptance criteria: "AC1: …", "- AC2 …", or a numbered list under an "Acceptance criteria" heading. */
export function extractAcceptanceCriteria(body) {
  const acs = [];
  for (const m of body.matchAll(/^\s*(?:[-*]|\d+[.)])?\s*\**(AC\d+)\**\s*[:.)\-–]\s*(.+)$/gim)) acs.push({ id: m[1].toUpperCase(), text: m[2].trim() });
  if (acs.length) return acs;
  const sec = /^#{1,4}\s*acceptance criteria\s*$([\s\S]*?)(?=^#{1,4}\s|$(?![\s\S]))/im.exec(body);
  if (sec) {
    let n = 0;
    for (const m of sec[1].matchAll(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/gm)) acs.push({ id: `AC${++n}`, text: m[1].trim() });
  }
  return acs;
}

function markdownDoc(path, raw, type, collection) {
  const { data, body } = parseFrontMatter(raw);
  const fileKey = basename(path).replace(/\.sample$/, '').replace(extname(path.replace(/\.sample$/, '')), '');
  const ticket = extractTickets(fileKey)[0];
  const id = String(data.id ?? ticket ?? `${type}:${fileKey}`);
  const meta = {
    priority: data.priority ?? null, status: data.status ?? null, feature: data.feature ?? null,
    parent: data.parent ?? data.epic ?? null, tags: asList(data.tags), owner: data.owner ?? null,
    requirements: asList(data.requirements ?? data.requirement), defects: asList(data.defects ?? data.defect),
    tests: asList(data.tests), relates: asList(data.relates), severity: data.severity ?? null,
    rootCause: data.rootCause ?? data['root-cause'] ?? null, signature: data.signature ?? null,
  };
  if (type === 'requirement') meta.acceptanceCriteria = extractAcceptanceCriteria(body);
  const links = [];
  if (meta.parent) links.push({ rel: 'child-of', target: meta.parent });
  for (const r of meta.requirements) links.push({ rel: type === 'defect' ? 'affects' : 'relates', target: r });
  for (const d of meta.defects) links.push({ rel: type === 'rca' ? 'explains' : 'relates', target: d });
  for (const r of meta.relates) links.push({ rel: 'relates', target: r });
  for (const t of meta.tests) links.push({ rel: type === 'defect' ? 'affects' : 'relates', target: t });
  // ticket keys mentioned in the body become weak "mentions" links (graph search can follow them)
  for (const t of extractTickets(body)) if (t !== id && !links.some((l) => l.target === t)) links.push({ rel: 'mentions', target: t });
  return { id, type, collection, format: 'markdown', title: data.title ?? titleFrom(body, id), text: body, meta, acl: data.acl ? asList(data.acl) : null, links };
}

/** Playwright spec: one document per file, with each test's title, tags, requirements and fixtures in meta.tests. */
export function parseSpec(path, src) {
  const tests = [];
  const re = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])(.*?)\1\s*,\s*(\{[\s\S]*?\})?\s*,?\s*async\s*\(\s*\{([^}]*)\}/g;
  for (const m of src.matchAll(re)) {
    const details = m[3] ?? '';
    const tags = [...details.matchAll(/['"`](@[\w-]+)['"`]/g)].map((x) => x[1]);
    const reqText = [...details.matchAll(/description:\s*['"`]([^'"`]+)['"`]/g)].map((x) => x[1]).join(' ') + ' ' + m[2];
    const requirements = extractTickets(reqText);
    const acs = [...reqText.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\s*[#/ ]\s*(AC\d+)\b/gi)].map((x) => `${x[1]}#${x[2].toUpperCase()}`);
    const fixtures = m[4].split(',').map((s) => s.trim().split(/[:\s]/)[0]).filter(Boolean);
    const line = src.slice(0, m.index).split('\n').length;
    tests.push({
      id: `test:${path.replace(/\.sample$/, '')}::${m[2]}`, title: m[2], line, tags, fixtures,
      priority: tags.find((t) => PRIORITY.test(t)) ?? null,
      feature: tags.find((t) => !PRIORITY.test(t) && !NON_FEATURE.has(t))?.slice(1) ?? null,
      requirements, acs,
    });
  }
  return tests;
}
function specDoc(path, raw, collection) {
  const tests = parseSpec(path, raw);
  const describe = /test\.describe(?:\.\w+)?\(\s*(['"`])(.*?)\1/.exec(raw)?.[2];
  return {
    id: `spec:${path.replace(/\.sample$/, '')}`, type: 'test', collection, format: 'code',
    title: describe ?? basename(path), text: raw,
    meta: { tests, feature: tests.find((t) => t.feature)?.feature ?? null }, acl: null, links: [],
  };
}

/** Gherkin feature (playwright-bdd, Cucumber): one document per file; each Scenario / Scenario Outline is a test.
 *  Tags inherit from the Feature; requirement links come from ticket tags (@PROJ-101) and AC tags (@PROJ-101:AC1). */
export function parseFeature(path, src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const tagsOf = (l) => (l.match(/@[^\s@]+/g) ?? []);
  let featureTags = [], pending = [], feature = null;
  const tests = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@')) { pending.push(...tagsOf(line)); return; }
    const f = /^(?:Feature|Ability|Business Need):\s*(.+)$/.exec(line);
    if (f) { feature = f[1].trim(); featureTags = pending; pending = []; return; }
    const s = /^(?:Scenario Outline|Scenario Template|Scenario|Example):\s*(.+)$/.exec(line);
    if (s) {
      const tags = [...new Set([...featureTags, ...pending])];
      pending = [];
      const title = s[1].trim();
      const text = `${tags.join(' ')} ${title}`;
      const acs = [...text.matchAll(/\b([A-Z][A-Z0-9]+-\d+)\s*[#/: ]\s*(AC\d+)\b/gi)].map((x) => `${x[1]}#${x[2].toUpperCase()}`);
      const isMeta = (t) => PRIORITY.test(t) || NON_FEATURE.has(t) || /^@[A-Z][A-Z0-9]+-\d+/.test(t) || /^@AC\d+$/i.test(t);
      const steps = [];
      for (let j = i + 1; j < lines.length; j++) {
        const st = lines[j].trim();
        if (/^(?:Scenario|Scenario Outline|Scenario Template|Example|Examples|Rule|Feature)\b|^@/.test(st)) break;
        if (/^(?:Given|When|Then|And|But|\*)\s/.test(st)) steps.push(st);
      }
      tests.push({ id: `test:${path.replace(/\.sample$/, '')}::${title}`, title, line: i + 1, tags, fixtures: [], steps,
        priority: tags.find((t) => PRIORITY.test(t)) ?? null, feature: tags.find((t) => !isMeta(t))?.slice(1) ?? null,
        requirements: extractTickets(text), acs: [...new Set(acs)], style: 'bdd' });
      return;
    }
    if (!/^(?:Given|When|Then|And|But|\*|Examples|Background|Rule|\|)/.test(line)) pending = [];
  });
  return { feature, tests };
}
function featureDoc(path, raw, collection) {
  const { feature, tests } = parseFeature(path, raw);
  return { id: `spec:${path.replace(/\.sample$/, '')}`, type: 'test', collection, format: 'gherkin', title: feature ?? basename(path), text: raw,
    meta: { tests, feature: tests.find((t) => t.feature)?.feature ?? null, style: 'bdd' }, acl: null, links: [] };
}

/** Page objects and modules: class name, route, public methods and the fixture name used to inject them. */
export function parseClass(src) {
  const cls = /export\s+(?:default\s+)?class\s+(\w+)/.exec(src)?.[1] ?? null;
  const route = /readonly\s+path\s*(?::\s*string)?\s*=\s*['"`]([^'"`]+)['"`]/.exec(src)?.[1] ?? null;
  const methods = [...src.matchAll(/^\s*(?:public\s+)?(?:async\s+)?([a-z]\w*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/gm)].map((m) => m[1]).filter((n) => !['constructor', 'if', 'for', 'while', 'switch', 'catch'].includes(n));
  const locators = [...src.matchAll(/readonly\s+(\w+)\s*(?::\s*Locator)?\s*[=;]/g)].map((m) => m[1]).filter((n) => n !== 'path');
  const ctorLocators = [...src.matchAll(/this\.(\w+)\s*=\s*(?:page|this\.page|root)\./g)].map((m) => m[1]);
  return { cls, route, methods: [...new Set(methods)], members: [...new Set([...locators, ...ctorLocators])] };
}
function classDoc(path, raw, type, collection) {
  const { cls, route, methods, members } = parseClass(raw);
  const name = cls ?? basename(path).replace(/\..*$/, '');
  const fixture = name[0].toLowerCase() + name.slice(1);
  return {
    id: `${type}:${name}`, type, collection, format: 'code', title: `${name} (${splitCamel(name).toLowerCase()})`,
    text: `${name}${route ? ` route ${route}` : ''}\nmethods: ${methods.join(', ')}\nmembers: ${members.join(', ')}\n\n${raw}`,
    meta: { className: name, fixture, route, methods, members }, acl: null, links: [],
  };
}

/** Playwright JSON reporter output, or a simple history array [{ file, title, status, date }]. */
export function parseExecutions(json) {
  const runs = [];
  if (Array.isArray(json)) {
    for (const r of json) runs.push({ file: r.file, title: r.title, status: r.status, retries: r.retries ?? 0, durationMs: r.durationMs ?? null, date: r.date ?? null, error: r.error ?? null });
    return runs;
  }
  const started = json?.stats?.startTime ?? null;
  const visit = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        const last = results[results.length - 1] ?? {};
        const status = t.status === 'expected' ? 'passed' : t.status === 'unexpected' ? 'failed' : t.status ?? last.status;
        const err = results.map((r) => r.error?.message ?? r.errors?.[0]?.message).find(Boolean) ?? null;
        runs.push({ file: spec.file ?? f, title: spec.title, status, retries: Math.max(0, results.length - 1), durationMs: results.reduce((a, r) => a + (r.duration ?? 0), 0), date: started, error: err ? String(err).split('\n')[0].slice(0, 300) : null });
      }
    }
    for (const s of suite.suites ?? []) visit(s, f);
  };
  for (const s of json?.suites ?? []) visit(s, s.file);
  return runs;
}
function executionDoc(path, raw, collection) {
  const runs = parseExecutions(JSON.parse(raw));
  const lines = runs.map((r) => `${r.status.toUpperCase()} ${r.file} › ${r.title}${r.retries ? ` (retries ${r.retries})` : ''}${r.error ? ` — ${r.error}` : ''}`);
  return { id: `execution:${path.replace(/\.sample$/, '')}`, type: 'execution', collection, format: 'records', title: `Test results ${basename(path)}`, text: lines.join('\n'), meta: { runs }, acl: null, links: [] };
}

/** Defects, findings and other record files: JSON object, JSON array or JSON lines. */
function recordDocs(path, raw, type, collection) {
  let records;
  const t = raw.trim();
  if (path.replace(/\.sample$/, '').endsWith('.jsonl')) records = t.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  else { const j = JSON.parse(t); records = Array.isArray(j) ? j : j.items ?? j.findings ?? j.defects ?? [j]; }
  return records.map((r, i) => {
    const id = String(r.id ?? r.key ?? `${type}:${basename(path)}:${i}`);
    const requirements = asList(r.requirements ?? r.requirement);
    const tests = asList(r.tests ?? r.test);
    const links = [
      ...requirements.map((x) => ({ rel: 'affects', target: x })),
      ...tests.map((x) => ({ rel: 'affects', target: x })),
      ...asList(r.defects ?? r.defect).map((x) => ({ rel: type === 'rca' ? 'explains' : 'relates', target: x })),
      ...(r.page ? [{ rel: 'affects', target: `page:${r.page}` }] : []),
      ...(r.rca ? [{ rel: 'explained-by', target: r.rca }] : []),
    ];
    const text = [r.title ?? r.summary, r.description, r.rootCause && `Root cause: ${r.rootCause}`, r.resolution && `Resolution: ${r.resolution}`,
      r.signature && `Signature: ${r.signature}`, r.recommendation && `Recommendation: ${r.recommendation}`, r.route && `Route: ${r.route}`,
      (r.owasp || r.cwe) && `Category: ${[r.owasp, r.cwe].filter(Boolean).join(' ')}`].filter(Boolean).join('\n');
    return {
      id, type, collection, format: 'record', title: r.title ?? r.summary ?? id, text,
      meta: { status: r.status ?? null, severity: r.severity ?? null, priority: r.priority ?? null, feature: r.feature ?? null, signature: r.signature ?? null, requirements, tests, rootCause: r.rootCause ?? null, route: r.route ?? null, date: r.date ?? r.created ?? null },
      acl: r.acl ? asList(r.acl) : null, links,
    };
  });
}

function pipelineDoc(path, raw, collection) {
  const greps = [...raw.matchAll(/--grep[= ]["']?(@[\w-]+)/g)].map((m) => m[1]);
  const projects = [...raw.matchAll(/--project[= ]["']?([\w-]+)/g)].map((m) => m[1]);
  const name = /^name:\s*(.+)$/m.exec(raw)?.[1].trim() ?? basename(path);
  const schedule = /cron:\s*['"]([^'"]+)['"]/.exec(raw)?.[1] ?? null;
  return { id: `pipeline:${path}`, type: 'pipeline', collection, format: 'code', title: name, text: raw, meta: { greps, projects, schedule }, acl: null, links: [] };
}

/** Pick a loader from the source's declared type and the file's extension. */
export function loadFile(path, raw, { type, collection }) {
  const key = path.replace(/\.sample$/, '');
  const ext = extname(key);
  if (ext === '.feature') return [featureDoc(path, raw, collection)];
  if (type === 'test' || /\.spec\.[jt]sx?$/.test(key)) return [specDoc(path, raw, collection)];
  if (type === 'page' || type === 'module') return [classDoc(path, raw, type, collection)];
  if (type === 'execution') return [executionDoc(path, raw, collection)];
  if (type === 'pipeline') return [pipelineDoc(path, raw, collection)];
  if (ext === '.json' || ext === '.jsonl') return recordDocs(path, raw, type, collection);
  if (ext === '.md' || ext === '.markdown' || ext === '.txt') return [markdownDoc(path, raw, type, collection)];
  return [{ id: `${type}:${key}`, type, collection, format: 'text', title: basename(key), text: raw, meta: {}, acl: null, links: [] }];
}
