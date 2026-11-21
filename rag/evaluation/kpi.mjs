// AI test-quality KPIs for Playwright specs — deterministic, so they can gate CI without an LLM key.
//   hallucination_rate   share of referenced fixtures, page methods/members and relative imports that do not
//                        exist in this repository (the generator invented them)
//   assertion_quality    0–1: every test asserts, assertions are web-first, assertions per step
//   locator_quality      0–1: weighted by the locator priority (role > label > placeholder > test id/text > css > xpath)
//   flakiness_prediction 0–1: static risk signals, blended with execution history when the graph has it
//   test_stability_score 0–1: observed pass rate (flaky counts half); predicted from flakiness when no history
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { findFiles, clamp, round } from '../lib/util.mjs';
import { parseSpec, parseClass } from '../ingestion/loaders.mjs';

const BUILTIN_FIXTURES = new Set(['page', 'context', 'browser', 'browserName', 'request', 'baseURL', 'playwright', 'contextOptions', 'launchOptions', 'testInfo', 'storageState', 'viewport', 'isMobile']);
const WEB_FIRST = /\.(toBeVisible|toBeHidden|toHaveText|toContainText|toHaveValue|toHaveValues|toHaveURL|toHaveTitle|toHaveCount|toBeEnabled|toBeDisabled|toBeChecked|toHaveAttribute|toHaveClass|toBeFocused|toHaveScreenshot|toBeAttached|toBeEditable|toBeEmpty|toHaveCSS|toHaveId|toHaveJSProperty|toHaveAccessibleName|toHaveAccessibleDescription|toHaveRole|toMatchAriaSnapshot|toBeInViewport|toBeOK)\(/g;
const LOCATOR_WEIGHTS = [['getByRole', 1], ['getByLabel', 0.95], ['getByPlaceholder', 0.85], ['getByTestId', 0.8], ['getByAltText', 0.8], ['getByTitle', 0.75], ['getByText', 0.75]];

/** What the repository really has: fixtures, page/module classes and their members. */
export function repoKnowledge(cfg) {
  const fw = cfg.qa.framework ?? {};
  const pageGlobs = [`${fw.pagesDir ?? 'src/pages'}/**/*.ts`, `${fw.modulesDir ?? 'src/modules'}/**/*.ts`, 'src/components/**/*.ts'];
  const classes = new Map();
  for (const rel of findFiles(cfg.root, pageGlobs)) {
    const c = parseClass(readFileSync(join(cfg.root, rel), 'utf8'));
    if (c.cls) classes.set(c.cls, { ...c, path: rel });
  }
  const fixtures = new Map();       // fixture name -> class name (or null)
  for (const c of classes.values()) fixtures.set(c.cls[0].toLowerCase() + c.cls.slice(1), c.cls);
  for (const rel of findFiles(cfg.root, ['src/fixtures/**/*.ts', 'fixtures/**/*.ts', 'tests/fixtures/**/*.ts', 'src/**/fixtures.ts'])) {
    const src = readFileSync(join(cfg.root, rel), 'utf8');
    for (const m of src.matchAll(/extend<\s*\{([\s\S]*?)\}\s*>/g)) for (const f of m[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) fixtures.set(f[1], classes.has(f[2]) ? f[2] : null);
    for (const m of src.matchAll(/^\s{2,4}(\w+)\s*:\s*(?:async\s*)?\(/gm)) if (!fixtures.has(m[1])) fixtures.set(m[1], null);
  }
  for (const f of cfg.qa.framework?.extraFixtures ?? []) fixtures.set(f, null);
  return { classes, fixtures };
}

function testBodies(src) {
  const starts = [...src.matchAll(/\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])(.*?)\1/g)];
  return starts.map((m, i) => ({ title: m[2], body: src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length) }));
}

function locatorScore(src) {
  const scores = [];
  for (const [fn, w] of LOCATOR_WEIGHTS) for (const _ of src.matchAll(new RegExp(`\\.${fn}\\(`, 'g'))) scores.push(w);
  for (const m of src.matchAll(/\.locator\(\s*(['"`])(.*?)\1/g)) scores.push(/^(xpath=|\(*\/\/)/.test(m[2]) ? 0 : 0.4);
  const positional = (src.match(/\.(nth|first|last)\(/g) ?? []).length;
  if (!scores.length) return null;
  return clamp(scores.reduce((a, b) => a + b, 0) / scores.length - 0.05 * positional);
}

function staticFlakiness(body) {
  const risks = [];
  const add = (p, why) => risks.push({ p, why });
  if (/waitForTimeout\(/.test(body)) add(0.3, 'waitForTimeout');
  if (/networkidle/.test(body)) add(0.2, 'networkidle wait');
  const pos = (body.match(/\.(nth|first|last)\(/g) ?? []).length; if (pos) add(Math.min(0.15, 0.05 * pos), 'positional locator');
  if (/Date\.now\(|new Date\(\)/.test(body)) add(0.1, 'wall-clock time');
  if (/Math\.random\(/.test(body)) add(0.1, 'unseeded randomness');
  const nonWeb = (body.match(/expect\(\s*await\b/g) ?? []).length; if (nonWeb) add(Math.min(0.2, 0.1 * nonWeb), 'non-retrying assertion');
  if (/force:\s*true/.test(body)) add(0.1, 'force option');
  if (/timeout:\s*\d{5,}/.test(body)) add(0.05, 'very long timeout');
  if (!/test\.step\(/.test(body)) add(0.05, 'no steps');
  return { p: 1 - risks.reduce((a, r) => a * (1 - r.p), 1), risks: risks.map((r) => r.why) };
}

export function scoreSpec(cfg, rel, src, knowledge, graph = null) {
  const tests = parseSpec(rel, src);
  const bodies = testBodies(src);
  const out = [];
  // relative imports that do not resolve are hallucinations too
  const imports = [...src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]);
  const badImports = imports.filter((imp) => !['', '.ts', '.js', '/index.ts', '.tsx'].some((ext) => existsSync(resolve(cfg.root, dirname(rel), imp + ext))));
  for (const [i, t] of tests.entries()) {
    const body = bodies[i]?.body ?? '';
    const referenced = [], unresolved = [];
    for (const f of t.fixtures) {
      referenced.push(f);
      if (!BUILTIN_FIXTURES.has(f) && !knowledge.fixtures.has(f)) { unresolved.push(`fixture ${f}`); continue; }
      const cls = knowledge.classes.get(knowledge.fixtures.get(f));
      if (!cls) continue;
      for (const m of body.matchAll(new RegExp(`\\b${f}\\.(\\w+)`, 'g'))) {
        referenced.push(`${f}.${m[1]}`);
        if (!cls.methods.includes(m[1]) && !cls.members.includes(m[1]) && !['page', 'path', 'root', 'goto'].includes(m[1])) unresolved.push(`${cls.cls}.${m[1]}`);
      }
    }
    const asserts = (body.match(/\bexpect(?:\.soft)?\(/g) ?? []).length;
    const webFirst = (body.match(WEB_FIRST) ?? []).length;
    const nonWeb = (body.match(/expect\(\s*await\b/g) ?? []).length;
    const steps = (body.match(/test\.step\(/g) ?? []).length;
    const assertion = asserts ? clamp(0.5 + 0.3 * (webFirst / Math.max(1, webFirst + nonWeb)) + 0.2 * Math.min(1, asserts / Math.max(1, steps))) : 0;
    const flak = staticFlakiness(body);
    const node = graph?.nodes?.[t.id];
    const hist = node?.stats?.runs ? node.stats : null;
    const observed = hist ? (hist.flaky + hist.failed * 0.5) / hist.runs : null;
    const flakiness = observed === null ? flak.p : 0.5 * flak.p + 0.5 * clamp(observed + hist.retries / (hist.runs * 3));
    const stability = hist ? clamp((hist.passed + 0.5 * hist.flaky) / hist.runs) : 1 - flakiness;
    out.push({
      test: t.id, title: t.title, referenced: referenced.length, unresolved, assertions: asserts, webFirst, nonWebFirst: nonWeb, steps,
      assertion_quality: round(assertion), locator_quality: locatorScore(body), flakiness_prediction: round(flakiness), flakiness_signals: flak.risks,
      test_stability_score: round(stability), stability_basis: hist ? `observed over ${hist.runs} run(s)` : 'predicted (no history)',
      tags_ok: Boolean(t.priority && t.feature),
    });
  }
  return { file: rel, tests: out, badImports };
}

/** Score a set of spec files (default: every spec the tests source covers) and aggregate the KPIs. */
export function scoreSpecs(cfg, files = null, graph = null) {
  const knowledge = repoKnowledge(cfg);
  // caller-supplied paths must stay inside the repository (the MCP tool passes agent input straight through)
  const inside = (rel) => { const abs = resolve(cfg.root, rel); return abs === cfg.root || abs.startsWith(cfg.root + sep); };
  const list = files?.length ? files.filter((f) => { if (inside(f)) return true; throw new Error(`refusing to read ${f}: outside the repository`); })
    : findFiles(cfg.root, ['tests/**/*.spec.ts', 'tests/**/*.spec.js']);
  const specs = list.map((rel) => scoreSpec(cfg, rel, readFileSync(join(cfg.root, rel), 'utf8'), knowledge, graph));
  // page objects carry the locators when specs use them properly, so score those files too
  const pageLocs = [...knowledge.classes.values()].map((c) => locatorScore(readFileSync(join(cfg.root, c.path), 'utf8'))).filter((x) => x !== null);
  const tests = specs.flatMap((s) => s.tests);
  const avg = (xs) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const referenced = tests.reduce((a, t) => a + t.referenced, 0) + specs.reduce((a, s) => a + s.badImports.length, 0);
  const unresolved = tests.reduce((a, t) => a + t.unresolved.length, 0) + specs.reduce((a, s) => a + s.badImports.length, 0);
  const locs = [...tests.map((t) => t.locator_quality).filter((x) => x !== null), ...pageLocs];
  return {
    metrics: {
      hallucination_rate: referenced ? round(unresolved / referenced) : 0,
      assertion_quality: avg(tests.map((t) => t.assertion_quality)),
      locator_quality: avg(locs),
      flakiness_prediction: avg(tests.map((t) => t.flakiness_prediction)),
      test_stability_score: avg(tests.map((t) => t.test_stability_score)),
      tag_compliance: avg(tests.map((t) => (t.tags_ok ? 1 : 0))),
    },
    counts: { files: specs.length, tests: tests.length, referenced, unresolved, pageObjects: knowledge.classes.size, fixtures: knowledge.fixtures.size },
    specs,
  };
}
