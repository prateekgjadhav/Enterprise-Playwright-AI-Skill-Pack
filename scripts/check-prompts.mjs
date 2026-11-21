#!/usr/bin/env node
// Prompt management check: every prompt in prompts/ has the required front matter, the required sections,
// declares every {{placeholder}} it uses, names the eval that guards it, and carries the
// untrusted-context rule. Prompts are plain files: git history is their record, and CI re-runs the evals
// whenever one changes (see .github/workflows/ai-quality.yml). No version numbers are kept.
// Usage: node scripts/check-prompts.mjs [prompts]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'prompts';
const fail = [];
if (!existsSync(dir)) { console.log(`check-prompts: no ${dir}/ folder`); process.exit(0); }
const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
  if (!fm) { fail.push(`${f}: missing front matter`); continue; }
  const data = Object.fromEntries(fm[1].split('\n').map((l) => /^(\w[\w-]*):\s*(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  for (const k of ['name', 'description', 'evaluatedBy']) if (!data[k]) fail.push(`${f}: front matter needs "${k}"`);
  if (data.name && data.name !== f.replace(/\.md$/, '')) fail.push(`${f}: name "${data.name}" must match the file name`);
  if (/^version\s*:/m.test(fm[1])) fail.push(`${f}: prompts carry no version field; git history is the record`);
  for (const k of ['owner', 'metadata', 'author', 'updated', 'created']) if (new RegExp(`^${k}\\s*:`, 'm').test(fm[1])) fail.push(`${f}: prompts carry no "${k}" field; git history is the record`);
  const args = (data.arguments ?? '').replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  const body = src.slice(fm[0].length);
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if (!args.includes(m[1])) fail.push(`${f}: uses {{${m[1]}}} but "arguments" does not declare it`);
  for (const sec of ['## Role', '## Rules', '## Output']) if (!body.includes(sec)) fail.push(`${f}: missing "${sec}"`);
  if (!/untrusted/i.test(body)) fail.push(`${f}: must state that retrieved context is untrusted data`);
}
console.log(`check-prompts: ${files.length} prompt(s)`);
for (const x of fail) console.log(`FAIL ${x}`);
process.exit(fail.length ? 1 : 0);
