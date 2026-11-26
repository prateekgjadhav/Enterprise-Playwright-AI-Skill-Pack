#!/usr/bin/env node
// Self-healing for broken locators: reads the Playwright JSON report, finds failures caused by a locator that
// no longer matches, finds that locator in the page objects, ranks replacements from the page's current
// accessibility tree, and proposes a patch. By default it only proposes (report + unified diff). With
// --apply it patches page objects/modules/components only — never specs — for proposals at or above
// healing.minConfidence. No backup copies are made: git is the rollback (`git apply -R reports/healing/healing.patch`
// or `git checkout -- <file>`); the skill then re-runs verify and the failing tests.
//
// It heals only what is safely a locator drift. If the original target still exists, the failure is
// timing or state (flake-triage); if the page has no element of that kind at all, the page or
// the product changed (failure-rca). Those are reported, never patched.
//
// Usage, from the repository root:
//   node scripts/self-healing/heal.mjs [--results reports/results.json] [--snapshots .claude/discovery/pages]
//        [--live <non-production base URL>] [--apply] [--min-confidence 0.8] [--out reports/healing]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../../rag/lib/config.mjs';
import { findFiles } from '../../rag/lib/util.mjs';
import { checkTarget } from '../../rag/lib/targets.mjs';
import { parseClass } from '../../rag/ingestion/loaders.mjs';

export const DEFAULTS = { results: 'reports/results.json', snapshots: '.claude/discovery/pages', out: 'reports/healing', minConfidence: 0.8, proposeFrom: 0.5 };
const ANSI = /\u001b\[[0-9;]*m/g;

// ----------------------------------------------------------------------------------------- failures
const LOCATOR_EXPR = /((?:page\.)?(?:getBy(?:Role|TestId|Label|Text|Placeholder|AltText|Title)\((?:[^()]|\([^()]*\))*\)|locator\((?:[^()]|\([^()]*\))*\)))/;
export function failuresFrom(report) {
  const out = [];
  const visit = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) {
      const results = t.results ?? [];
      if (!results.some((r) => r.status === 'failed' || r.status === 'timedOut')) continue;
      const msg = results.flatMap((r) => [r.error?.message, ...(r.errors ?? []).map((e) => e.message)]).filter(Boolean).join('\n').replace(ANSI, '');
      const kind = /strict mode violation/i.test(msg) ? 'strict-mode' : /(waiting for|resolved to 0 elements|element\(s\) not found|Timeout \d+ms exceeded)/i.test(msg) ? 'not-found' : null;
      const expr = (/waiting for ([^\n]+)/i.exec(msg)?.[1] ?? /strict mode violation: ([^\n]+?) resolved/i.exec(msg)?.[1] ?? /expect\((.+?)\)\./.exec(msg)?.[1] ?? '').match(LOCATOR_EXPR)?.[1];
      if (kind && expr) out.push({ file: spec.file ?? f, title: spec.title, kind, expression: expr.replace(/^page\./, ''), message: msg.split('\n').slice(0, 6).join('\n') });
    }
    for (const s of suite.suites ?? []) visit(s, f);
  };
  for (const s of report?.suites ?? []) visit(s, s.file);
  const seen = new Set();
  return out.filter((x) => { const k = `${x.kind}|${x.expression}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ----------------------------------------------------------------------------------------- locators
const str = `(['"\`])((?:\\\\.|(?!\\1).)*)\\1`;
export function parseLocator(expr) {
  let m;
  if ((m = new RegExp(`^getByRole\\(\\s*${str}\\s*(?:,\\s*\\{([^}]*)\\})?\\s*\\)$`).exec(expr))) {
    const opts = m[3] ?? '';
    const name = new RegExp(`name:\\s*${str}`).exec(opts);
    return { kind: 'role', role: m[2], name: name ? name[2] : null, exact: /exact:\s*true/.test(opts), quote: m[1] };
  }
  for (const k of ['TestId', 'Label', 'Text', 'Placeholder', 'AltText', 'Title']) {
    if ((m = new RegExp(`^getBy${k}\\(\\s*${str}\\s*(?:,\\s*\\{[^}]*\\})?\\s*\\)$`).exec(expr))) return { kind: k[0].toLowerCase() + k.slice(1), value: m[2], quote: m[1] };
  }
  if ((m = new RegExp(`^locator\\(\\s*${str}\\s*\\)$`).exec(expr))) return { kind: 'css', value: m[2], quote: m[1] };
  return null;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const q = `['"\`]`;
/** A regex that finds the same locator in source, whatever quotes or spacing the author used. */
export function sourcePattern(loc) {
  if (loc.kind === 'role') return new RegExp(`getByRole\\(\\s*${q}${esc(loc.role)}${q}\\s*${loc.name != null ? `,\\s*\\{[^}]*name:\\s*${q}${esc(loc.name)}${q}[^}]*\\}` : '(?:,\\s*\\{[^}]*\\})?'}\\s*\\)`, 'g');
  if (loc.kind === 'css') return new RegExp(`locator\\(\\s*${q}${esc(loc.value)}${q}\\s*\\)`, 'g');
  const fn = { testId: 'TestId', label: 'Label', text: 'Text', placeholder: 'Placeholder', altText: 'AltText', title: 'Title' }[loc.kind];
  return new RegExp(`getBy${fn}\\(\\s*${q}${esc(loc.value)}${q}\\s*(?:,\\s*\\{[^}]*\\})?\\s*\\)`, 'g');
}
export function render(loc, quote = "'") {
  const s = (v) => `${quote}${String(v).replace(new RegExp(quote, 'g'), `\\${quote}`)}${quote}`;
  if (loc.kind === 'role') return `getByRole(${s(loc.role)}${loc.name != null ? `, { name: ${s(loc.name)}${loc.exact ? ', exact: true' : ''} }` : ''})`;
  const fn = { testId: 'TestId', label: 'Label', text: 'Text', placeholder: 'Placeholder', altText: 'AltText', title: 'Title' }[loc.kind];
  return `getBy${fn}(${s(loc.value)})`;
}

// ----------------------------------------------------------------------------------------- the page as it is now
export function parseAria(yaml) {
  const nodes = [];
  for (const line of String(yaml ?? '').split('\n')) {
    const m = /^\s*-\s+([a-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?/.exec(line);
    if (m && !['url', 'text'].includes(m[1])) nodes.push({ role: m[1], name: (m[2] ?? '').replace(/\\"/g, '"') });
  }
  return nodes;
}
export function snapshotFromMarkdown(md) {
  return { aria: /```yaml\n([\s\S]*?)```/.exec(md)?.[1] ?? '', testIds: [...(/## Test ids\n([^\n]+)/.exec(md)?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((x) => x[1]) };
}

const SYNONYMS = [['sign in', 'log in', 'login', 'signin'], ['sign out', 'log out', 'logout'], ['sign up', 'register', 'create account'], ['submit', 'send', 'save', 'confirm'],
  ['delete', 'remove'], ['cart', 'basket', 'bag'], ['search', 'find'], ['checkout', 'check out', 'pay'], ['close', 'dismiss'], ['next', 'continue'], ['email', 'e-mail', 'email address']];
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function similarity(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  for (const group of SYNONYMS) {
    const hit = (s) => group.find((g) => s === g || s.includes(g));
    const gx = hit(x), gy = hit(y);
    if (gx && gy && x.replace(gx, '').trim() === y.replace(gy, '').trim()) return 0.92;
  }
  const edit = 1 - lev(x, y) / Math.max(x.length, y.length);
  const tx = new Set(x.split(' ')), ty = new Set(y.split(' '));
  const jac = [...tx].filter((t) => ty.has(t)).length / new Set([...tx, ...ty]).size;
  const contains = x.includes(y) || y.includes(x) ? 0.85 : 0;
  return Math.round(Math.max(edit, jac, contains) * 100) / 100;
}
const ROLE_OF = { label: ['textbox', 'combobox', 'checkbox', 'radio', 'spinbutton', 'searchbox', 'slider', 'switch'], placeholder: ['textbox', 'searchbox', 'combobox'], text: null, altText: ['img'], title: null };

/** Rank replacements. Returns { verdict, candidates } where verdict explains why no patch is safe. */
export function rankCandidates(loc, snap) {
  const nodes = parseAria(snap.aria);
  if (!nodes.length && !snap.testIds.length) return { verdict: 'no-snapshot', candidates: [] };
  if (loc.kind === 'testId') {
    if (snap.testIds.includes(loc.value)) return { verdict: 'target-still-present', candidates: [] };
    const c = snap.testIds.map((t) => ({ loc: { kind: 'testId', value: t }, confidence: similarity(loc.value.replace(/[-_]/g, ' '), t.replace(/[-_]/g, ' ')) }));
    return { verdict: c.length ? 'drifted' : 'kind-absent', candidates: c.sort((a, b) => b.confidence - a.confidence).slice(0, 3) };
  }
  if (loc.kind === 'css') {
    return { verdict: 'governance', candidates: [], note: 'CSS locator: replace it with a role, label or test-id locator through locator-selection rather than healing it in place' };
  }
  const want = loc.kind === 'role' ? loc.name : loc.value;
  const roles = loc.kind === 'role' ? [loc.role] : ROLE_OF[loc.kind];
  const pool = nodes.filter((n) => !roles || roles.includes(n.role));
  if (!pool.length) return { verdict: 'kind-absent', candidates: [] };
  if (want == null) return { verdict: 'unnamed', candidates: [] };
  const exact = pool.filter((n) => norm(n.name) === norm(want));
  if (exact.length === 1) return { verdict: 'target-still-present', candidates: [] };
  if (exact.length > 1) return { verdict: 'ambiguous', candidates: [] };
  const scored = new Map();
  for (const n of pool) {
    const confidence = similarity(want, n.name);
    const next = loc.kind === 'role' ? { kind: 'role', role: n.role, name: n.name, exact: loc.exact } : loc.kind === 'text' ? { kind: 'text', value: n.name } : { kind: 'label', value: n.name };
    const key = render(next);
    if (!scored.has(key) || scored.get(key).confidence < confidence) scored.set(key, { loc: next, confidence });
  }
  const c = [...scored.values()].sort((a, b) => b.confidence - a.confidence);
  // a near-tie between the top two is not a safe heal: lower the confidence of the winner
  if (c.length > 1 && c[0].confidence - c[1].confidence < 0.1) c[0] = { ...c[0], confidence: Math.round(c[0].confidence * 0.8 * 100) / 100, note: 'near-tie with the next candidate' };
  return { verdict: 'drifted', candidates: c.slice(0, 3) };
}
// strict mode: the same name now matches several elements; exact matching may be enough
export function strictModeFix(loc, snap) {
  if (loc.kind !== 'role' || loc.name == null || loc.exact) return null;
  const nodes = parseAria(snap.aria).filter((n) => n.role === loc.role && norm(n.name).includes(norm(loc.name)));
  const exact = nodes.filter((n) => n.name === loc.name);
  return nodes.length > 1 && exact.length === 1 ? { loc: { ...loc, exact: true }, confidence: 0.9 } : null;
}

// ----------------------------------------------------------------------------------------- diff
export function unifiedDiff(path, before, after, context = 2) {
  const a = before.split('\n'), b = after.split('\n');
  const changed = a.map((l, i) => l !== b[i]).map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  if (!changed.length) return '';
  const out = [`--- a/${path}`, `+++ b/${path}`];
  let i = 0;
  while (i < changed.length) {
    let start = Math.max(0, changed[i] - context), end = Math.min(a.length - 1, changed[i] + context);
    while (i + 1 < changed.length && changed[i + 1] - context <= end + 1) { i++; end = Math.min(a.length - 1, changed[i] + context); }
    out.push(`@@ -${start + 1},${end - start + 1} +${start + 1},${end - start + 1} @@`);
    for (let k = start; k <= end; k++) out.push(a[k] === b[k] ? ` ${a[k]}` : `-${a[k]}\n+${b[k]}`);
    i++;
  }
  return out.join('\n') + '\n';
}

// ----------------------------------------------------------------------------------------- live snapshot (optional)
async function liveSnapshot(root, baseUrl, route, storageState) {
  const { createRequire } = await import('node:module');
  const req = createRequire(join(root, 'package.json'));
  let chromium;
  for (const n of ['@playwright/test', 'playwright']) { try { chromium = (await import(pathToFileURL(req.resolve(n)).href)).chromium; break; } catch { /* next */ } }
  if (!chromium) throw new Error('--live needs Playwright installed in the repository');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: storageState && existsSync(storageState) ? storageState : undefined });
  await ctx.route('**/*', (r) => (['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) ? r.continue() : r.abort()));   // read-only
  const page = await ctx.newPage();
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'load' });
  const aria = await page.locator('body').ariaSnapshot();
  const testIds = await page.evaluate((attr) => [...new Set([...document.querySelectorAll(`[${attr}]`)].map((e) => e.getAttribute(attr)))], 'data-testid');
  await browser.close();
  return { aria, testIds };
}

// ----------------------------------------------------------------------------------------- main
export async function heal({ root = process.cwd(), ...o } = {}) {
  const cfg = loadConfig(root);
  const opt = { ...DEFAULTS, ...(cfg.qa.healing ?? {}), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) };
  if (opt.live) {
    const host = new URL(opt.live).hostname.toLowerCase();
    const target = checkTarget(opt.live, cfg.qa);
    if (!target.ok) throw Object.assign(new Error(`refusing --live against ${host}: ${target.reason}`), { code: 3 });
  }
  const resultsPath = resolve(root, opt.results);
  if (!existsSync(resultsPath)) throw new Error(`${opt.results} not found: run the tests with the JSON reporter first`);
  const failures = failuresFrom(JSON.parse(readFileSync(resultsPath, 'utf8')));
  const fw = cfg.qa.framework ?? {};
  const healable = findFiles(root, [`${fw.pagesDir ?? 'src/pages'}/**/*.ts`, `${fw.modulesDir ?? 'src/modules'}/**/*.ts`, 'src/components/**/*.ts']);
  const sources = new Map(healable.map((rel) => [rel, readFileSync(join(root, rel), 'utf8')]));
  const snapCache = new Map();
  const snapshotFor = async (route) => {
    if (snapCache.has(route)) return snapCache.get(route);
    let snap = { aria: '', testIds: [], source: null };
    const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const md = join(root, opt.snapshots, `${slug}.md`);
    if (opt.live) snap = { ...(await liveSnapshot(root, opt.live, route, opt.storageState && resolve(root, opt.storageState))), source: `live ${route}` };
    else if (existsSync(md)) snap = { ...snapshotFromMarkdown(readFileSync(md, 'utf8')), source: relative(root, md) };
    snapCache.set(route, snap);
    return snap;
  };

  const proposals = [];
  const patched = new Map();
  for (const f of failures) {
    const loc = parseLocator(f.expression);
    const row = { test: `${f.file} › ${f.title}`, kind: f.kind, locator: f.expression, status: 'not-healed', reason: null, file: null, line: null, replacement: null, confidence: 0, snapshot: null, alternatives: [] };
    proposals.push(row);
    if (!loc) { row.reason = 'locator expression not recognised'; continue; }
    const pattern = sourcePattern(loc);
    const hits = [...sources].flatMap(([rel, src]) => [...src.matchAll(pattern)].map((m) => ({ rel, index: m.index, text: m[0] })));
    if (!hits.length) { row.reason = 'locator not found in page objects, modules or components (inline in a spec? move it to a page object first)'; continue; }
    if (hits.length > 1 && new Set(hits.map((h) => h.rel)).size > 1) { row.reason = `the same locator appears in ${new Set(hits.map((h) => h.rel)).size} files: duplicate page objects (governance-lint)`; continue; }
    const hit = hits[0];
    row.file = hit.rel; row.line = sources.get(hit.rel).slice(0, hit.index).split('\n').length;
    const route = parseClass(sources.get(hit.rel)).route;
    if (!route) { row.reason = 'page object has no `readonly path`, so its current page cannot be read'; continue; }
    const snap = await snapshotFor(route);
    row.snapshot = snap.source;
    let best = null, verdict;
    if (f.kind === 'strict-mode') { best = strictModeFix(loc, snap); verdict = best ? 'ambiguous-fixable' : 'ambiguous'; }
    else { const r = rankCandidates(loc, snap); verdict = r.verdict; best = r.candidates[0] ?? null; row.alternatives = r.candidates.slice(1).map((c) => ({ locator: render(c.loc), confidence: c.confidence })); if (r.note) row.reason = r.note; }
    const why = {
      'no-snapshot': `no snapshot for ${route}: save its ARIA snapshot under --snapshots, or pass --live <allowlisted URL>`,
      'target-still-present': 'the original target still exists: timing or state, not a locator drift (flake-triage)',
      'kind-absent': 'no element of this kind on the page: the page or the product changed (failure-rca)',
      ambiguous: 'several elements now match: scope the locator to a region (locator-selection)',
      unnamed: 'the locator has no accessible name to compare: add one (locator-selection)',
    }[verdict];
    if (!best || best.confidence < opt.proposeFrom) { row.reason = row.reason ?? why ?? 'no candidate is similar enough'; continue; }
    row.replacement = render(best.loc, loc.quote ?? "'");
    row.confidence = best.confidence;
    row.status = best.confidence >= opt.minConfidence ? 'proposed' : 'needs-review';
    if (best.note) row.reason = best.note;
    if (row.status === 'proposed') {
      const before = patched.get(hit.rel) ?? sources.get(hit.rel);
      patched.set(hit.rel, before.replace(hit.text, row.replacement));
    }
  }

  const outDir = resolve(root, opt.out);
  mkdirSync(outDir, { recursive: true });
  const diff = [...patched].map(([rel, after]) => unifiedDiff(rel, sources.get(rel), after)).join('');
  writeFileSync(join(outDir, 'healing.patch'), diff);
  if (opt.apply) {
    for (const [rel, after] of patched) {
      writeFileSync(join(root, rel), after);
    }
    for (const p of proposals) if (p.status === 'proposed') p.status = 'applied';
  }
  const summary = { failures: failures.length, proposed: proposals.filter((p) => p.status === 'proposed').length, applied: proposals.filter((p) => p.status === 'applied').length,
    needsReview: proposals.filter((p) => p.status === 'needs-review').length, notHealed: proposals.filter((p) => p.status === 'not-healed').length, minConfidence: opt.minConfidence };
  writeFileSync(join(outDir, 'healing-proposals.json'), JSON.stringify({ summary, proposals }, null, 2) + '\n');
  const md = ['# Self-healing report', '', `${summary.failures} locator failure(s) · ${summary.applied || summary.proposed} ${opt.apply ? 'applied' : 'proposed'} · ${summary.needsReview} need review · ${summary.notHealed} not healed (threshold ${opt.minConfidence})`, '',
    '| Test | Locator | Status | Replacement | Confidence | Where | Why |', '|---|---|---|---|---|---|---|',
    ...proposals.map((p) => `| ${p.test} | \`${p.locator}\` | ${p.status} | ${p.replacement ? `\`${p.replacement}\`` : '—'} | ${p.confidence || '—'} | ${p.file ? `${p.file}:${p.line}` : '—'} | ${p.reason ?? (p.snapshot ? `from ${p.snapshot}` : '')} |`),
    '', opt.apply ? 'No backups are kept: revert with `git apply -R reports/healing/healing.patch`. Next: `npm run verify`, then re-run the healed tests with `--repeat-each=3`; revert any file whose test still fails.' : 'Nothing was changed. Review `healing.patch`; apply with `--apply` after review.', ''];
  writeFileSync(join(outDir, 'healing-report.md'), md.join('\n'));
  return { summary, proposals, diff };
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--results') a.results = v(); else if (k === '--snapshots') a.snapshots = v(); else if (k === '--live') a.live = v();
    else if (k === '--storage-state') a.storageState = v(); else if (k === '--apply') a.apply = true; else if (k === '--min-confidence') a.minConfidence = Number(v());
    else if (k === '--out') a.out = v(); else if (k === '--root') a.root = resolve(v());
  }
  return a;
}
const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  heal(parseArgs(process.argv.slice(2))).then(({ summary }) => {
    console.log(`self-healing: ${summary.failures} locator failure(s); ${summary.applied ? `${summary.applied} applied` : `${summary.proposed} proposed`}, ${summary.needsReview} need review, ${summary.notHealed} not healed — see ${DEFAULTS.out}/healing-report.md`);
  }).catch((e) => { console.error(`self-healing: ${e.message}`); process.exit(e.code ?? 1); });
}
