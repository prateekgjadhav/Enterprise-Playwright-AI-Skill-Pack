#!/usr/bin/env node
// Stop: the agent cannot declare a task done while verification fails.
//   unconfigured repository (no environments yet) → npm run verify:pack (skills, lock, policy files, docs)
//   configured repository                         → npm run verify (adds config, typecheck, lint, test discovery)
// It also refuses to stop with secret paths staged in git.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { payload, block, guarded, projectDir } from './lib.mjs';
import { SECRET_PATH } from './deny-secret-read.mjs';

guarded(async () => {
  const p = await payload();
  if (p.stop_hook_active) return;   // already blocked once in this turn: let the agent report instead of looping
  const root = projectDir(p);
  let configured = false;
  try { configured = (JSON.parse(readFileSync(join(root, '.claude', 'qa.config.json'), 'utf8')).environments ?? []).length > 0; } catch { /* unreadable: treat as unconfigured, verify:pack still runs */ }
  const script = configured ? 'verify' : 'verify:pack';
  const r = spawnSync('npm', ['run', '--silent', script], { cwd: root, encoding: 'utf8', timeout: 900000 });
  if (r.error) block(`npm is not available (${r.error.code ?? r.error.message}) — cannot verify (fail closed)`);
  if (r.status !== 0) block(`npm run ${script} failed — fix it before finishing:\n${`${r.stdout}${r.stderr}`.slice(-4000)}`);
  const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' });
  const bad = (staged.stdout ?? '').split('\n').filter((f) => f && SECRET_PATH.test(f));
  if (bad.length) block(`secret material is staged in git: ${bad.join(', ')}`);
});
