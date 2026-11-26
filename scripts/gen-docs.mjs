#!/usr/bin/env node
// Generates Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html from docs/guide.template.html
// and the repository itself — catalogue, skill frontmatter, counts, the lock digest and every locked file — so the
// guide cannot drift from what ships. One pass: inserted text is never re-scanned for placeholders.
//   node scripts/gen-docs.mjs            write the guide
//   node scripts/gen-docs.mjs --check    exit 1 when the committed guide differs from a fresh build
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './build-skill-manifest.mjs';

const OUT = 'Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (p) => readFileSync(p, 'utf8');

export function build(root = process.cwd()) {
  const r = (p) => read(join(root, p));
  const catalog = JSON.parse(r('.claude/skills-catalog.json'));
  const lock = JSON.parse(r('skills.lock.json'));
  const cases = JSON.parse(r('tests/skills/trigger-cases.json'));
  const skills = Object.entries(catalog.skills).map(([name, c]) => {
    const { data } = parseFrontmatter(r(`.claude/skills/${name}/SKILL.md`));
    const when = (/\bUse whenever\b\s*(.*?)(?=\s*\bNot for\b|$)/s.exec(data.description)?.[1] ?? '').replace(/\.$/, '');
    return { name, ...c, when };
  });
  const testFiles = [...readdirSync(join(root, 'rag/test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `rag/test/${f}`),
    ...readdirSync(join(root, 'scripts/test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `scripts/test/${f}`), 'scripts/self-healing/heal.test.mjs'];
  const testCount = testFiles.reduce((n, f) => n + (r(f).match(/^test\(/gm) ?? []).length, 0);

  const skillTable = skills.map((s) => `<tr data-tier="${s.tier}" data-default="${s.default}"><td><code>${esc(s.name)}</code></td><td>${esc(catalog.categories[s.category])}</td><td><span class="tier ${s.tier.toLowerCase()}">${s.tier}</span></td><td>${s.default}</td><td>${esc(s.when)}</td></tr>`).join('\n');
  const tierTable = Object.entries(catalog.tiers).map(([t, meaning]) => {
    const names = skills.filter((s) => s.tier === t).map((s) => `<code>${s.name}</code>`);
    return `<tr><td><span class="tier ${t.toLowerCase()}">${t}</span></td><td>${esc(meaning)}</td><td>${names.length}: ${names.join(', ')}</td></tr>`;
  }).join('\n');

  const GROUPS = [
    ['Orchestrator and configuration', (p) => /^(AGENTS\.md|CLAUDE\.md|BOOTSTRAP_PROMPT\.md|README\.md|install-manifest\.json|package\.json|tsconfig\.json|renovate\.json|\.gitignore|\.nvmrc|\.mcp\.json)$/.test(p) || /^\.claude\/[^/]+\.json$/.test(p) || p.startsWith('.claude/') || p.startsWith('.claude/memory/') || p === 'knowledge/README.md'],
    ...Object.entries(catalog.categories).map(([k, label]) => [`Skills — ${label}`, (p) => { const m = /^\.claude\/skills\/([^/]+)\//.exec(p); return m && catalog.skills[m[1]]?.category === k; }]),
    ['Managed settings and hooks', (p) => p.startsWith('managed/') || p.startsWith('hooks/')],
    ['Policy, governance and legal', (p) => p.startsWith('policy/') || p.startsWith('governance/') || ['.github/CODEOWNERS', 'SECURITY.md', 'LICENSE'].includes(p)],
    ['Release and integrity', (p) => /^(install\.sh|skills\.lock\.json|mcp\.lock\.json|scripts\/(install|build-lock|verify-lock|package-hooks|link-skills|check-pins)\.mjs|scripts\/lib\/files\.mjs)$/.test(p)],
    ['Self-tests and fixtures', (p) => /^(rag\/test\/|scripts\/test\/|rag\/fixtures\/)/.test(p) || /\.test\.mjs$/.test(p) || p === 'tests/skills/trigger-cases.json'],
    ['Checks, gates and tooling', (p) => p.startsWith('scripts/')],
    ['Knowledge layer and MCP server', (p) => p.startsWith('rag/')],
    ['Evaluations and prompts', (p) => p.startsWith('evals/') || p.startsWith('prompts/')],
    ['Reference framework and lint rules', (p) => /^(src\/|tests\/|eslint\/|eslint\.config\.mjs$|playwright\.config\.ts$)/.test(p)],
    ['CI workflows', (p) => p.startsWith('.github/workflows/')],
    ['Gateway, telemetry and docs sources', () => true],
  ];
  const files = Object.keys(lock.files).sort();
  if (existsSync(join(root, 'skills.lock.json'))) files.push('skills.lock.json');
  const groups = GROUPS.map(([label]) => ({ label, files: [] }));
  for (const p of files) {
    const i = GROUPS.findIndex(([, test]) => test(p));
    const m = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(p);
    groups[i].files.push({ title: m ? m[1] : p, path: p, content: r(p) });
  }
  const filesJson = JSON.stringify({ groups: groups.filter((g) => g.files.length) }).replace(/</g, '\\u003c');

  const values = {
    CSS: r('docs/guide.css'), JS: r('docs/guide.js'),
    SKILL_COUNT: String(skills.length), CASE_COUNT: String(cases.length), FILE_COUNT: String(Object.keys(lock.files).length),
    DIGEST12: lock.digest.slice(0, 12), TEST_COUNT: String(testCount),
    SKILL_TABLE: skillTable, TIER_TABLE: tierTable, FILES_JSON: filesJson,
  };
  return r('docs/guide.template.html').replace(/\{\{([A-Z_0-9]+)(?::([^}]*))?\}\}/g, (all, key, arg) => {
    if (key === 'INCLUDE') return esc(r(arg).replace(/\n$/, ''));
    if (key === 'INCLUDE_SECTION') { const [path, heading] = arg.split(/:(?=#)/); const t = r(path); const at = t.indexOf(heading); const m = /```\n([\s\S]*?)```/.exec(t.slice(at)); return esc((m?.[1] ?? '').replace(/\n$/, '')); }
    if (!(key in values)) throw new Error(`gen-docs: unknown placeholder ${all}`);
    return values[key];
  });
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const html = build();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? read(OUT) : '';
    if (cur !== html) { console.log(`gen-docs: ${OUT} is stale — run node scripts/gen-docs.mjs and commit it`); process.exit(1); }
    console.log('gen-docs: the guide matches the sources');
  } else { writeFileSync(OUT, html); console.log(`gen-docs: wrote ${OUT} (${Math.round(html.length / 1024)} KB)`); }
}
