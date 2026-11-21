#!/usr/bin/env node
// Least privilege for skills. allowed-tools only pre-approves tools in some hosts, so it is not the control: the
// managed permission rules and hooks are. This check keeps the two consistent and narrow:
//   * no bare Bash, Edit, Write or MultiEdit, no Bash(*), no network tools (WebFetch, WebSearch)
//   * every entry is covered by a managed allow or ask rule and by no managed deny rule
//   * every entry fits its tier (T0 read-only except .agents/out/, T0/T1 run no tests, T4 only the security project)
// Usage: node scripts/check-allowed-tools.mjs [--settings managed/managed-settings.json]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './build-skill-manifest.mjs';

/** Split "Read Bash(npx playwright test:*) Edit(src/**)" on spaces outside parentheses. */
export function splitTools(s) {
  const out = []; let cur = ''; let depth = 0;
  for (const ch of String(s ?? '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
export const parse = (e) => { const m = /^([A-Za-z]+)(?:\((.*)\))?$/.exec(e); return m ? { tool: m[1], spec: m[2] ?? null } : null; };
const normPath = (p) => p.replace(/^\.\//, '');

/** Does rule cover entry? (rule at least as broad as entry) */
export function covers(rule, entry) {
  const r = parse(rule); const e = parse(entry);
  if (!r || !e || r.tool !== e.tool) return false;
  if (r.spec === null) return true;
  if (e.spec === null) return false;
  if (r.tool === 'Bash') {
    if (r.spec.endsWith(':*')) { const pre = r.spec.slice(0, -2); const es = e.spec.endsWith(':*') ? e.spec.slice(0, -2) : e.spec; return es === pre || es.startsWith(pre + ' ') || es.startsWith(pre); }
    return r.spec === e.spec;
  }
  const rp = normPath(r.spec); const ep = normPath(e.spec);
  if (rp === ep) return true;
  if (rp.endsWith('/**')) return ep.startsWith(rp.slice(0, -2)) || ep === rp.slice(0, -3);
  return false;
}

const TEST_RUN = /^Bash\(npx playwright test(?! --list)/;
export function tierProblems(tier, entry) {
  const { tool, spec } = parse(entry) ?? {};
  const p = [];
  if (['Edit', 'Write', 'MultiEdit'].includes(tool) && tier === 'T0' && !(tool === 'Write' && normPath(spec ?? '').startsWith('.agents/out/'))) p.push(`${entry}: T0 skills are read-only (only Write(.agents/out/**))`);
  if (TEST_RUN.test(entry) && ['T0', 'T1'].includes(tier)) p.push(`${entry}: ${tier} skills do not run tests`);
  if (tier === 'T4' && tool === 'Bash' && !/^npx playwright test --project=security:\*$/.test(spec ?? '')) p.push(`${entry}: T4 skills run only the security project`);
  if (tier !== 'T4' && /--project=security/.test(spec ?? '')) p.push(`${entry}: only T4 skills run the security project`);
  if (/^(gh workflow run|gh pr create|node rag\/cli\.mjs memory)/.test(spec ?? '') && !['T3'].includes(tier) && !(tier === 'T1' && /^gh workflow run update-baselines/.test(spec))) p.push(`${entry}: external side effects need a T3 skill`);
  return p;
}

export function checkAll(root = process.cwd(), settingsPath = 'managed/managed-settings.json') {
  const settings = JSON.parse(readFileSync(join(root, settingsPath), 'utf8'));
  const { allow = [], ask = [], deny = [] } = settings.permissions ?? {};
  const catalog = JSON.parse(readFileSync(join(root, '.agents/skills-catalog.json'), 'utf8')).skills;
  const problems = [];
  for (const name of readdirSync(join(root, '.agents/skills')).sort()) {
    const { data } = parseFrontmatter(readFileSync(join(root, '.agents/skills', name, 'SKILL.md'), 'utf8'));
    const tier = catalog[name]?.tier;
    const entries = splitTools(data['allowed-tools']);
    if (!entries.length) problems.push(`${name}: allowed-tools is empty`);
    for (const e of entries) {
      const pe = parse(e);
      if (!pe) { problems.push(`${name}: cannot parse "${e}"`); continue; }
      if (['Bash', 'Edit', 'Write', 'MultiEdit'].includes(pe.tool) && (pe.spec === null || pe.spec === '*' || pe.spec === '**')) problems.push(`${name}: "${e}" is unscoped`);
      if (['WebFetch', 'WebSearch'].includes(pe.tool)) problems.push(`${name}: "${e}" gives network access`);
      if (!allow.concat(ask).some((r) => covers(r, e))) problems.push(`${name}: "${e}" is not covered by any managed allow or ask rule`);
      const d = deny.find((r) => covers(r, e));
      if (d) problems.push(`${name}: "${e}" is forbidden by the managed deny rule "${d}"`);
      for (const tp of tierProblems(tier, e)) problems.push(`${name}: ${tp}`);
    }
  }
  return problems;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const problems = checkAll(process.cwd(), argv.includes('--settings') ? argv[argv.indexOf('--settings') + 1] : undefined);
  if (problems.length) { console.log(`check-allowed-tools: ${problems.length} problem(s)`); for (const p of problems) console.log(`  - ${p}`); process.exit(1); }
  console.log('check-allowed-tools: every skill is least-privilege and covered by managed settings');
}
