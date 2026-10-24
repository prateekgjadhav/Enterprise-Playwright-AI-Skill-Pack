#!/usr/bin/env node
// The governance script behind `npm run verify`: the backstop for the rules ESLint cannot see on its own.
//   no-xpath            XPath strings passed to locator() or frameLocator() in src/ and tests/
//   no-duplicate-page   one class name and one `readonly path` per route across the pages folder
//   no-hard-coded-data  literal emails, card numbers, passwords and absolute URLs in tests, pages and modules
//   tags                each test has exactly one priority tag and one feature tag (needs @playwright/test)
//   ci-image            the Playwright container image in CI matches the installed @playwright/test
// Waive one line with `// governance-disable-next-line <rule> -- <reason> (<TICKET-123>)` on the line above,
// or `// governance-disable-line <rule> -- <reason> (<TICKET-123>)` on the line itself (use # in YAML).
// A waiver without a reason and a ticket, or one that no longer suppresses anything, is itself a violation.
// Usage: node scripts/governance-check-all.mjs [--root <dir>] [--list-json <file>] [--json]
// Node built-ins only. Folders and tags come from .agents/qa.config.json (framework.*).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = resolve(flag('--root') ?? process.cwd());
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const fw = readJson(join(ROOT, '.agents/qa.config.json'))?.framework ?? {};
const folder = (d) => String(d).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
const PAGES = folder(fw.pagesDir ?? 'src/pages');
const MODULES = folder(fw.modulesDir ?? 'src/modules');
const TESTS = folder(fw.testsDir ?? 'tests');
const PRIORITY = fw.priorityTags ?? ['@P0', '@P1', '@P2'];
const NOT_FEATURE = new Set([...PRIORITY, ...(fw.suiteTags ?? ['@smoke', '@regression']),
  ...(fw.layerTags ?? ['@api', '@security', '@visual', '@a11y', '@perf', '@mobile', '@synthetic', '@resilience'])]);
const RULES = new Set(['no-xpath', 'no-duplicate-page', 'no-hard-coded-data', 'tags', 'ci-image']);
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', 'playwright-report', 'test-results', 'blob-report']);
const CODE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

const violations = [];
const notes = [];
const ran = new Set();
const rel = (abs) => relative(ROOT, abs).split(sep).join('/');
const add = (rule, file, line, message) => violations.push({ rule, file, line, message });

function walk(start, pattern = CODE) {
  const abs = join(ROOT, start);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return pattern.test(abs) ? [abs] : [];
  const out = [];
  const visit = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name) || (e.isDirectory() && e.name.startsWith('.'))) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) visit(p); else if (pattern.test(e.name)) out.push(p);
    }
  };
  visit(abs);
  return out.sort();
}

/** Split JS/TS source into string literals (with the code just before each) and comments. */
function lex(src) {
  const strings = [];
  const comments = [];
  let i = 0, line = 1, code = '';
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { line++; code = ''; i++; continue; }
    if (c === '/' && d === '/') {
      const end = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i);
      comments.push({ line, endLine: line, text: src.slice(i + 2, end) });
      i = end; continue;
    }
    if (c === '/' && d === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close < 0 ? src.length : close + 2;
      const text = src.slice(i + 2, close < 0 ? end : close);
      const start = line;
      line += (text.match(/\n/g) ?? []).length;
      comments.push({ line: start, endLine: line, text });
      i = end; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const start = line, before = code;
      let j = i + 1, value = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { value += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === '\n') { if (c !== '`') break; line++; }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          let depth = 1; j += 2; value += '${';
          while (j < src.length && depth) {
            if (src[j] === '{') depth++; else if (src[j] === '}') depth--;
            if (src[j] === '\n') line++;
            if (depth) value += src[j];
            j++;
          }
          value += '}'; continue;
        }
        value += src[j]; j++;
      }
      strings.push({ line: start, value, before: before.slice(-60) });
      code += c + c;
      i = j + 1; continue;
    }
    code += c; i++;
  }
  return { strings, comments };
}

const WAIVER = /governance-disable-(next-line|line)\s+([a-z-]+(?:\s*,\s*[a-z-]+)*)(?:\s+--\s+(.*))?/;
function readWaivers(file, comments) {
  const list = [];
  for (const c of comments) {
    const m = WAIVER.exec(c.text);
    if (!m) continue;
    const rules = m[2].split(/\s*,\s*/);
    const reason = (m[3] ?? '').trim();
    for (const r of rules) if (!RULES.has(r)) add('waiver', file, c.line, `unknown rule "${r}" in a governance waiver`);
    if (!reason || !/\b[A-Z][A-Z0-9]+-\d+\b/.test(reason)) {
      add('waiver', file, c.line, 'a waiver needs a reason and a ticket: -- <reason> (<TICKET-123>)');
      continue;
    }
    list.push({ file, line: c.line, target: m[1] === 'next-line' ? c.endLine + 1 : c.line, rules, used: false });
  }
  return list;
}

const parsed = new Map();
function parse(abs) {
  if (!parsed.has(abs)) {
    const src = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    const { strings, comments } = lex(src);
    parsed.set(abs, { file: rel(abs), src, strings, waivers: readWaivers(rel(abs), comments) });
  }
  return parsed.get(abs);
}
const waived = (p, rule, line) => {
  const w = p.waivers.find((x) => x.target === line && x.rules.includes(rule));
  if (w) w.used = true;
  return Boolean(w);
};
const unique = (...lists) => [...new Set(lists.flat())].sort();

// no-xpath (backstop for the ESLint rule)
ran.add('no-xpath');
for (const abs of unique(walk('src'), walk(TESTS))) {
  const p = parse(abs);
  for (const s of p.strings) {
    if (/\b(?:locator|frameLocator)\(\s*$/.test(s.before) && /^(?:xpath=|\(*\/\/)/.test(s.value) && !waived(p, 'no-xpath', s.line)) {
      add('no-xpath', p.file, s.line, `XPath locator "${s.value.slice(0, 50)}": follow the locator priority (locator-strategy)`);
    }
  }
}

// no-duplicate-page
ran.add('no-duplicate-page');
const classes = new Map();
const routes = new Map();
const lineAt = (src, index) => src.slice(0, index).split('\n').length;
for (const abs of walk(PAGES)) {
  const p = parse(abs);
  for (const m of p.src.matchAll(/^\s*export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) {
    (classes.get(m[1]) ?? classes.set(m[1], []).get(m[1])).push({ p, line: lineAt(p.src, m.index) });
  }
  for (const s of p.strings) {
    if (/\breadonly\s+path\s*(?::\s*string\s*)?=\s*$/.test(s.before)) (routes.get(s.value) ?? routes.set(s.value, []).get(s.value)).push({ p, line: s.line });
  }
}
for (const [kind, map] of [['class', classes], ['route', routes]]) {
  for (const [key, hits] of map) {
    for (const h of hits.slice(1)) {
      if (!waived(h.p, 'no-duplicate-page', h.line)) {
        add('no-duplicate-page', h.p.file, h.line, `${kind} "${key}" is already declared in ${hits[0].p.file}:${hits[0].line}; extend that page object instead`);
      }
    }
  }
}

// no-hard-coded-data
ran.add('no-hard-coded-data');
const luhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
};
for (const abs of unique(walk(TESTS), walk(PAGES), walk(MODULES))) {
  const p = parse(abs);
  for (const s of p.strings) {
    if (/(?:\bfrom|\bimport|\brequire\s*\(|\bimport\s*\()\s*$/.test(s.before)) continue;
    const found = [];
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test(s.value)) found.push('email address: build it with a factory (test-data-management)');
    if (/\b(?:https?|wss?):\/\/[^\s'"`]+/i.test(s.value)) found.push('absolute URL: navigate relative to baseURL from the config');
    for (const m of s.value.matchAll(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g)) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) { found.push('card number: use a factory or a named test card from the data layer'); break; }
    }
    if (/\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*$/i.test(s.before) && s.value.length >= 3 && !s.value.startsWith('${')) {
      found.push('password or secret: read it from the secret store or a credentials fixture');
    }
    if (found.length && !waived(p, 'no-hard-coded-data', s.line)) for (const f of found) add('no-hard-coded-data', p.file, s.line, `hard-coded ${f}`);
  }
}

// tags: one priority tag and one feature tag per test
let list = null;
if (flag('--list-json')) {
  list = readJson(resolve(flag('--list-json')));
  if (!list) add('tags', flag('--list-json'), 0, 'could not read the --list-json file');
} else {
  const bin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
  if (!existsSync(bin)) {
    notes.push('tags: skipped (Playwright is not installed yet)');
  } else {
    const r = spawnSync(bin, ['test', '--list', '--reporter=json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32' });
    try { list = JSON.parse(r.stdout); } catch {
      add('tags', 'playwright.config', 0, `could not list the tests: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ')}`);
    }
  }
}
if (list?.errors?.length) add('tags', 'playwright.config', 0, `Playwright reported an error while listing tests: ${String(list.errors[0].message ?? list.errors[0]).split('\n')[0]}`);
if (list) {
  ran.add('tags');
  const specs = [];
  const visit = (suite) => { for (const sp of suite.specs ?? []) specs.push(sp); for (const child of suite.suites ?? []) visit(child); };
  for (const suite of list.suites ?? []) visit(suite);
  const testRoot = list.config?.rootDir ? resolve(ROOT, list.config.rootDir) : join(ROOT, TESTS);
  for (const sp of specs) {
    const tags = [...new Set((sp.tags ?? []).map((t) => (t.startsWith('@') ? t : `@${t}`)))];
    const priority = tags.filter((t) => PRIORITY.includes(t));
    const feature = tags.filter((t) => !NOT_FEATURE.has(t));
    if (priority.length === 1 && feature.length === 1) continue;
    const source = [join(ROOT, sp.file ?? ''), join(testRoot, sp.file ?? ''), join(ROOT, TESTS, sp.file ?? '')].find((f) => sp.file && existsSync(f) && statSync(f).isFile());
    const p = source ? parse(source) : null;
    if (p && waived(p, 'tags', sp.line)) continue;
    add('tags', p ? p.file : sp.file ?? '?', sp.line ?? 0,
      `"${sp.title}" has ${priority.length} priority and ${feature.length} feature tag(s) [${tags.join(' ') || 'none'}]; it needs exactly one of each`);
  }
}

// ci-image: the CI container matches the installed Playwright
const installed = readJson(join(ROOT, 'node_modules/@playwright/test/package.json'))?.version
  ?? (() => {
    const pkg = readJson(join(ROOT, 'package.json'));
    const v = pkg?.devDependencies?.['@playwright/test'] ?? pkg?.dependencies?.['@playwright/test'];
    return /^\d+\.\d+\.\d+$/.test(v ?? '') ? v : null;
  })();
const ciFiles = unique(
  walk('.github/workflows', /\.ya?ml$/),
  ...['.gitlab-ci.yml', 'azure-pipelines.yml', 'bitbucket-pipelines.yml', 'Jenkinsfile'].map((f) => walk(f, /./)),
  readdirSync(ROOT).filter((f) => /^Dockerfile/.test(f) || /^docker-compose.*\.ya?ml$/.test(f)).map((f) => join(ROOT, f)),
);
let images = 0;
for (const abs of ciFiles) {
  const lines = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const file = rel(abs);
  const waivers = readWaivers(file, lines.map((text, i) => ({ line: i + 1, endLine: i + 1, text: text.includes('#') ? text.slice(text.indexOf('#') + 1) : '' })));
  const p = { file, waivers };
  parsed.set(abs, { ...p, strings: [], src: '' });
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/mcr\.microsoft\.com\/playwright(?::v?([0-9][\w.-]*))?/g)) {
      images++;
      const version = /^(\d+\.\d+\.\d+)/.exec(m[1] ?? '')?.[1];
      if (waived(p, 'ci-image', i + 1)) continue;
      if (!version) add('ci-image', file, i + 1, `unpinned Playwright image; pin it to v${installed ?? '<version>'}`);
      else if (installed && version !== installed) add('ci-image', file, i + 1, `Playwright image v${version} does not match @playwright/test ${installed}`);
    }
  });
}
if (images && !installed) notes.push('ci-image: versions not compared (install @playwright/test or pin an exact version in package.json)');
else ran.add('ci-image');

// Waivers that no longer suppress anything
for (const p of parsed.values()) {
  for (const w of p.waivers) if (!w.used && w.rules.every((r) => ran.has(r))) add('waiver', w.file, w.line, `unused waiver for ${w.rules.join(', ')}: remove it`);
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
if (argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ violations, notes }, null, 2) + '\n');
} else {
  for (const n of notes) console.log(`note: ${n}`);
  for (const v of violations) console.log(`${v.file}:${v.line}  ${v.rule}  ${v.message}`);
  console.log(violations.length ? `governance: ${violations.length} violation(s)` : `governance: clean (${[...ran].sort().join(', ')})`);
}
process.exit(violations.length ? 1 : 0);
