#!/usr/bin/env node
// Build the skill manifest from every .agents/skills/<name>/SKILL.md. Node built-ins only. The output is
// deterministic (no timestamps, no metadata), so the committed manifest changes only when a skill does.
// Frontmatter holds name, description and allowed-tools only; tier, category and default live in the catalogue.
// Usage: node scripts/build-skill-manifest.mjs [.agents/skills] > .agents/skills-manifest.json
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The catalogue, in one place: .agents/skills-catalog.json holds each skill's category, risk tier and default. */
const CATALOG_PATH = process.env.QA_SKILLS_CATALOG ?? '.agents/skills-catalog.json';
export const CATALOG = existsSync(CATALOG_PATH) ? JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) : { tiers: {}, categories: {}, skills: {} };
export const TIERS = CATALOG.tiers;
export const CATEGORIES = CATALOG.categories;
export const tierOf = (name) => CATALOG.skills[name]?.tier ?? null;

/** Parse the YAML subset the pack's frontmatter uses: scalars, >- and | blocks, and one nested map. */
export function parseFrontmatter(text) {
  const src = text.replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) throw new Error('missing frontmatter: the file must start with ---');
  const end = src.indexOf('\n---', 3);
  if (end < 0) throw new Error('frontmatter is not closed with ---');
  const lines = src.slice(4, end).split('\n');
  const unquote = (v) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);
  const data = {};
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = /^([A-Za-z][\w-]*):(?:[ \t]+(.*))?$/.exec(line);
    if (!m) throw new Error(`unsupported frontmatter line: "${line}"`);
    const key = m[1];
    const value = (m[2] ?? '').trim();
    i++;
    const indented = () => i < lines.length && (/^\s+\S/.test(lines[i]) || !lines[i].trim());
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (indented()) block.push(lines[i++].trim());
      data[key] = value[0] === '>' ? block.filter(Boolean).join(' ') : block.join('\n').trim();
    } else if (value === '') {
      const map = {};
      while (indented()) {
        const row = lines[i++];
        if (!row.trim()) continue;
        const n = /^\s+([A-Za-z][\w-]*):\s*(.*)$/.exec(row);
        if (!n) throw new Error(`unsupported nested line: "${row}"`);
        map[n[1]] = unquote(n[2].trim());
      }
      data[key] = map;
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: src.slice(end + 4).replace(/^\n/, '') };
}

const posix = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');

export function readSkill(skillsDir, folder) {
  const entry = { folder, path: `${posix(skillsDir)}/${folder}/SKILL.md` };
  const file = join(skillsDir, folder, 'SKILL.md');
  if (!existsSync(file)) return { ...entry, error: 'SKILL.md is missing' };
  try {
    const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    const description = typeof data.description === 'string' ? data.description : '';
    const useWhen = (/\bUse (?:it )?whenever\b\s*(.*?)(?=\s*\bNot for\b|$)/s.exec(description)?.[1] ?? '').trim();
    const notFor = (/\bNot for\b\s*(.*)$/s.exec(description)?.[1] ?? '').trim();
    const refs = [...notFor.matchAll(/\(([^)]*)\)/g)].flatMap((g) => g[1].match(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g) ?? []);
    return {
      ...entry,
      name: data.name ?? null,
      keys: Object.keys(data),
      tier: tierOf(data.name ?? folder),
      category: CATALOG.skills[data.name ?? folder]?.category ?? null,
      default: CATALOG.skills[data.name ?? folder]?.default ?? null,
      allowedTools: typeof data['allowed-tools'] === 'string' ? data['allowed-tools'] : null,
      description,
      useWhen,
      notFor,
      notForSkills: [...new Set(refs)].sort(),
      sections: [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
      templates: (body.match(/@skill-example: fragment/g) ?? []).length,
    };
  } catch (e) {
    return { ...entry, error: e.message };
  }
}

export function buildManifest(skillsDir = '.agents/skills') {
  const folders = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter((f) => !f.startsWith('.') && statSync(join(skillsDir, f)).isDirectory()).sort()
    : [];
  const skills = folders.map((f) => readSkill(skillsDir, f));
  const tiers = {}; const categories = {};
  for (const s of skills) { if (s.tier) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1; if (s.category) categories[s.category] = (categories[s.category] ?? 0) + 1; }
  return {
    skillsDir: posix(skillsDir),
    count: skills.length,
    tiers: Object.fromEntries(Object.entries(tiers).sort()),
    categories: Object.fromEntries(Object.entries(categories).sort()),
    skills,
  };
}

const invokedDirectly = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? ''); } catch { return false; }
})();
if (invokedDirectly) {
  const dir = process.argv[2] ?? '.agents/skills';
  if (!existsSync(dir)) { console.error(`build-skill-manifest: ${dir} not found`); process.exit(1); }
  process.stdout.write(JSON.stringify(buildManifest(dir), null, 2) + '\n');
}
