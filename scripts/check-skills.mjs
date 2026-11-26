#!/usr/bin/env node
// The skill-evaluation gate. Hard checks fail the build; soft signals warn, or fail with --fail-on-soft.
//   hard: frontmatter schema (no metadata, no versions, allowed-tools required), name/folder, catalogue (every skill once,
//         T3/T4 off by default with a Gate section), required sections, "Not for" references, routing coverage
//         (AGENTS.md names every skill and no unknown one), trigger cases name real skills, trigger accuracy (lexical proxy)
//   soft: category balance, trigger-term overlap without a mutual "Not for"
// Usage, from the repository root:
//   node scripts/check-skills.mjs [tests/skills/trigger-cases.json] [--fail-on-soft]   (the manifest is rebuilt and written)
// Thresholds may be set in .claude/qa.config.json under "skillEvaluation":
//   { "maxCategoryShare": 0.3, "overlapThreshold": 0.5, "minTriggerAccuracy": 0.95, "failOnSoft": false }
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { buildManifest, TIERS, CATALOG } from './build-skill-manifest.mjs';

const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const argv = process.argv.slice(2);
const [casesPath = 'tests/skills/trigger-cases.json'] = argv.filter((a) => !a.startsWith('--'));
const manifestPath = '.claude/skills-manifest.json';
const T = { maxCategoryShare: 0.3, overlapThreshold: 0.5, minTriggerAccuracy: 0.95, failOnSoft: false, ...(readJson('.claude/qa.config.json')?.skillEvaluation ?? {}) };
if (argv.includes('--fail-on-soft')) T.failOnSoft = true;

const hard = [], soft = [], info = [];
const fail = (check, msg) => hard.push(`${check}: ${msg}`);
const warn = (check, msg) => soft.push(`${check}: ${msg}`);
const pct = (x) => `${Math.round(x * 100)}%`;

const fresh = buildManifest('.claude/skills');
writeFileSync(manifestPath, JSON.stringify(fresh, null, 2) + '\n');   // derived (git-ignored); the knowledge graph reads it
const skills = fresh.skills;
const names = new Set(skills.map((s) => s.name).filter(Boolean));

// Hard: schema, pack, sections, references
const ALLOWED_KEYS = new Set(['name', 'description', 'allowed-tools']);
const REQUIRED_SECTIONS = ['Non-negotiables', 'Inputs and outputs', 'Procedure', 'Verify', 'Evidence', 'Definition of Done'];
for (const s of skills) {
  const id = s.folder;
  if (s.error) { fail('schema', `${id}: ${s.error}`); continue; }
  for (const k of ['name', 'description']) if (!s.keys.includes(k)) fail('schema', `${id}: frontmatter is missing "${k}"`);
  if (s.keys.includes('metadata')) fail('schema', `${id}: skills carry no metadata block; tier, category and default live in .claude/skills-catalog.json`);
  if (!s.allowedTools) fail('schema', `${id}: frontmatter is missing "allowed-tools"`);
  const cat = CATALOG.skills[id];
  if (cat && ['T3', 'T4'].includes(cat.tier) && cat.default !== 'off') fail('catalogue', `${id}: ${cat.tier} skills must be default "off"`);
  if (cat && ['T3', 'T4'].includes(cat.tier) && !s.sections.includes('Gate')) fail('sections', `${id}: ${cat.tier} skills need a "## Gate" section`);
  if (s.keys.some((k) => /version/i.test(k))) fail('schema', `${id}: skills carry no version field; git history is the record`);
  for (const k of s.keys) if (!ALLOWED_KEYS.has(k) && k !== 'metadata' && !/version/i.test(k)) fail('schema', `${id}: unexpected frontmatter key "${k}"`);
  if (!Object.keys(TIERS).includes(String(s.tier))) fail('catalogue', `${id}: not listed in .claude/skills-catalog.json`);
  if (s.name !== id) fail('schema', `${id}: name "${s.name}" does not match its folder`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.name ?? '') || String(s.name).length > 64) fail('schema', `${id}: name must be kebab-case and at most 64 characters`);
  if (!s.description) fail('schema', `${id}: description is empty`);
  else if (s.description.length > 1024) fail('schema', `${id}: description is ${s.description.length} characters (the limit is 1024)`);
  if (!s.useWhen) fail('schema', `${id}: description has no "Use whenever…" trigger`);
  if (!s.notFor) fail('schema', `${id}: description has no "Not for…" exclusion`);
  for (const sec of REQUIRED_SECTIONS) if (!s.sections.includes(sec)) fail('sections', `${id}: missing "## ${sec}"`);
  for (const ref of s.notForSkills) if (!names.has(ref)) fail('references', `${id}: "Not for" names "${ref}", which is not a skill`);
}

// Hard: the catalogue names only real skills, each once, with a known tier and category
for (const [n, e] of Object.entries(CATALOG.skills)) {
  if (!skills.some((s) => s.folder === n)) fail('catalogue', `the catalogue lists "${n}", which has no .claude/skills/${n}/SKILL.md`);
  if (!TIERS[e.tier]) fail('catalogue', `${n}: unknown tier "${e.tier}"`);
  if (!CATALOG.categories[e.category]) fail('catalogue', `${n}: unknown category "${e.category}"`);
  if (!['on', 'off'].includes(e.default)) fail('catalogue', `${n}: default must be "on" or "off"`);
}

// Hard: routing coverage against the orchestrator (AGENTS.md)
const routingDoc = ['AGENTS.md'].map(readText).find((t) => t && /^## Routing/m.test(t));
if (!routingDoc) {
  fail('routing', 'no "## Routing" section found in AGENTS.md');
} else {
  const rest = routingDoc.slice(routingDoc.search(/^## Routing/m) + 3);
  const next = rest.search(/^## /m);
  const routing = next < 0 ? rest : rest.slice(0, next);
  for (const n of names) if (!new RegExp(`(?<![\\w-])${n}(?![\\w-])`).test(routing)) fail('routing', `${n} has no routing entry in the orchestrator`);
  for (const m of routing.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)) if (!names.has(m[1])) fail('routing', `the orchestrator routes to "${m[1]}", which is not a skill`);
}

// Soft: category balance
for (const [cat, n] of Object.entries(fresh.categories)) {
  if (n / skills.length > T.maxCategoryShare) warn('category-balance', `category ${cat} holds ${n} of ${skills.length} skills (${pct(n / skills.length)}; the limit is ${pct(T.maxCategoryShare)})`);
}

// Soft: trigger-term overlap between skills that do not exclude each other
const STOP = new Set(('a an and any are as asks at be by can do does for from has have how i in into is it its me my of on or our '
  + 'over please should so some that the their them then there these this to up us use using user wants we what when whenever which '
  + 'who why will with you your new add make set get need needs help one two all each every more most only own same than via').split(' '));
const stem = (w) => (w.length > 4 ? w.replace(/ies$/, 'y').replace(/(?:ing|ed|es|s)$/, '') : w);
const tokens = (s) => (String(s ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
const live = skills.filter((s) => !s.error);
const useSets = new Map(live.map((s) => [s.name, new Set(tokens(s.useWhen))]));
for (let i = 0; i < live.length; i++) {
  for (let j = i + 1; j < live.length; j++) {
    const [a, b] = [live[i], live[j]];
    const [A, B] = [useSets.get(a.name), useSets.get(b.name)];
    const shared = [...A].filter((t) => B.has(t)).length;
    const jaccard = shared / (new Set([...A, ...B]).size || 1);
    if (jaccard > T.overlapThreshold && !a.notForSkills.includes(b.name) && !b.notForSkills.includes(a.name)) {
      warn('overlap', `${a.name} and ${b.name} share ${pct(jaccard)} of their trigger terms and neither names the other in "Not for"`);
    }
  }
}

// Soft: trigger accuracy with a deterministic lexical router (the LLM-judged version belongs to deepeval)
const cases = readJson(casesPath);
if (!Array.isArray(cases) || !cases.length) {
  warn('triggers', `no trigger cases found in ${casesPath}`);
} else {
  for (const c of cases) if (!names.has(c.expect)) fail('triggers', `the case "${c.request}" expects "${c.expect}", which is not a skill`);
  const covered = new Set(cases.map((c) => c.expect));
  for (const n of names) if (!covered.has(n)) warn('triggers', `${n} has no trigger case`);
  const docs = live.map((s) => ({
    name: s.name,
    nameT: new Set(tokens(s.name.replace(/-/g, ' '))),
    useT: new Set(tokens(s.useWhen)),
    whatT: new Set(tokens(s.description.split(/\bUse (?:it )?whenever\b/)[0])),
    notT: new Set(tokens(s.notFor)),
  }));
  const df = new Map();
  for (const d of docs) for (const t of new Set([...d.nameT, ...d.useT, ...d.whatT])) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t) => Math.log(1 + docs.length / (df.get(t) ?? docs.length));
  const route = (request) => {
    const q = new Set(tokens(request));
    return docs.map((d) => {
      let score = 0;
      for (const t of q) {
        if (d.nameT.has(t)) score += 2 * idf(t);
        else if (d.useT.has(t)) score += idf(t);
        else if (d.whatT.has(t)) score += 0.5 * idf(t);
        else if (d.notT.has(t)) score -= 0.75 * idf(t);   // the orchestrator's tie-break: respect "Not for"
      }
      return { name: d.name, score };
    }).sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
  };
  let top1 = 0, top3 = 0; const misses = [];
  for (const c of cases.filter((x) => names.has(x.expect))) {
    const ranked = route(c.request).map((r) => r.name);
    if (ranked[0] === c.expect) top1++; else misses.push(`"${c.request}" → ${ranked[0]} (expected ${c.expect})`);
    if (ranked.slice(0, 3).includes(c.expect)) top3++;
  }
  const n = cases.filter((x) => names.has(x.expect)).length || 1;
  info.push(`trigger accuracy (lexical proxy): ${pct(top1 / n)} top-1, ${pct(top3 / n)} top-3 over ${n} cases`);
  if (top1 / n < T.minTriggerAccuracy) fail('triggers', `top-1 accuracy ${pct(top1 / n)} is below ${pct(T.minTriggerAccuracy)}. Misrouted: ${misses.slice(0, 5).join('; ')}`);
  for (const m of misses) info.push(`misrouted: ${m}`);
}

// Report
console.log(`check-skills: ${skills.length} skills in ${fresh.skillsDir}`);
for (const h of hard) console.log(`FAIL ${h}`);
for (const s of soft) console.log(`WARN ${s}`);
for (const i of info) console.log(`info ${i}`);
console.log(`${hard.length} hard failure(s), ${soft.length} warning(s)${hard.length ? '' : ' — hard checks pass'}`);
process.exit(hard.length || (T.failOnSoft && soft.length) ? 1 : 0);
