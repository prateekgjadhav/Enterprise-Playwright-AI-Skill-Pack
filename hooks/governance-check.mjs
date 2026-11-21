#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): checks the file the agent just wrote.
//   *.ts, *.tsx, *.mjs, *.js under src/, tests/, eslint/, scripts/ → ESLint with the pack's AST rules, inline config off
//   governance/*.yaml, .agents/qa.config.json, .agents/skills-catalog.json → the OPA policy (and the config validator)
//   .agents/skills/**, AGENTS.md, prompts/** → the skill scan
// A missing linter, OPA or Node module is reported and blocks (fail closed); it is never skipped.
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';
import { payload, block, guarded, projectDir } from './lib.mjs';

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120000 });
  if (r.error) return { ok: false, out: `${cmd} is not available (${r.error.code ?? r.error.message})` };
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

export function checkFile(root, abs) {
  const rel = relative(root, abs).replace(/\\/g, '/');
  if (rel.startsWith('..')) return null;
  if (/^(src|tests|eslint|scripts)\/.+\.(m?[jt]sx?)$/.test(rel) || rel === 'playwright.config.ts') {
    const r = run('npx', ['--no-install', 'eslint', '--no-inline-config', '--max-warnings=0', rel], root);
    if (!r.ok) return `governance-lint failed for ${rel}:\n${r.out.slice(-3000)}`;
  }
  if (/^governance\/[^/]+\.ya?ml$/.test(rel) || rel === '.agents/qa.config.json' || rel === '.agents/skills-catalog.json') {
    const input = run('node', ['scripts/policy-input.mjs', '--out', '.agents/out/policy-input.json'], root);
    if (!input.ok) return `policy input failed: ${input.out}`;
    const r = run('opa', ['eval', '--format', 'raw', '--data', 'policy', '--input', '.agents/out/policy-input.json', 'data.qa.deny'], root);
    if (!r.ok) return `OPA policy could not run: ${r.out}`;
    if (r.out !== '[]') return `OPA policy denies:\n${r.out}`;
    if (rel === '.agents/qa.config.json') {
      const v = run('node', ['scripts/validate-config.mjs'], root);
      if (!v.ok) return v.out;
    }
  }
  if (/^\.agents\/skills\//.test(rel) || rel === 'AGENTS.md' || /^prompts\//.test(rel)) {
    const r = run('node', ['scripts/skill-scan.mjs', rel], root);
    if (!r.ok) return `skill-scan failed for ${rel}:\n${r.out}`;
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) guarded(async () => {
  const p = await payload();
  const root = projectDir(p);
  const files = [p.tool_input?.file_path, ...(p.tool_input?.edits ?? []).map((e) => e?.file_path)].filter(Boolean);
  for (const f of new Set(files)) { const r = checkFile(root, f); if (r) block(r); }
});
