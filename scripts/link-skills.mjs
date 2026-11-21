#!/usr/bin/env node
// Links the skills this repository may use into an agent host's skills folder (default .claude/skills): every
// default-on skill, plus optional (T3/T4) skills listed in qa.config.json skills.enabled with an attestation file
// that exists. Disabled skills are removed from the host folder. Usage: node scripts/link-skills.mjs [--host-dir <dir>]
import { readFileSync, existsSync, mkdirSync, rmSync, symlinkSync, cpSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
const argv = process.argv.slice(2);
const hostDir = argv.includes('--host-dir') ? argv[argv.indexOf('--host-dir') + 1] : '.claude/skills';
const catalog = JSON.parse(readFileSync('.agents/skills-catalog.json', 'utf8')).skills;
const qa = JSON.parse(readFileSync('.agents/qa.config.json', 'utf8'));
const enabled = new Set((qa.skills?.enabled ?? []).filter((e) => e?.name && e?.attestation && existsSync(e.attestation)).map((e) => e.name));
const want = Object.entries(catalog).filter(([n, c]) => c.default === 'on' || enabled.has(n)).map(([n]) => n);
mkdirSync(hostDir, { recursive: true });
for (const n of readdirSync(hostDir)) if (!want.includes(n)) rmSync(join(hostDir, n), { recursive: true, force: true });
for (const n of want) {
  const to = join(hostDir, n); if (existsSync(to)) continue;
  const from = join('.agents/skills', n);
  try { symlinkSync(relative(dirname(to), from), to, 'dir'); } catch { cpSync(from, to, { recursive: true }); }
}
console.log(`link-skills: ${want.length} skills linked into ${hostDir} (${want.length - enabled.size} default-on, ${enabled.size} enabled by attestation)`);
