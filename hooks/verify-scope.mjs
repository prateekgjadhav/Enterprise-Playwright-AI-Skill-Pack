#!/usr/bin/env node
// PreToolUse (Bash): gates security testing and checks targets.
//   * any command that runs the security project or tests/sec/ needs a scope: QA_SCOPE_FILE=<file> in the command
//     (or the environment), signed by the security-approver identity in the managed trust file, inside its time
//     window, naming only allowlisted targets. Otherwise the command is blocked.
//   * URLs passed to Playwright, the self-healer or a BASE_URL must pass the allowlist host check.
// CLI mode for the security-scope-verify skill:  node verify-scope.mjs --check governance/scopes/<id>.json
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { payload, block, guarded, projectDir, trust, packModule } from './lib.mjs';

const SECURITY_RUN = /--project[=\s]+["']?security\b|\btests\/sec\//;
const TARGETED = /\bplaywright\b|heal\.mjs|\bBASE_URL=|\bQA_BASE_URL=/;

export async function verifyScope(root, scopeRel, { now = Date.now(), cosign = process.env.QA_COSIGN || 'cosign' } = {}) {
  const errors = [];
  const file = resolve(root, scopeRel);
  if (!file.startsWith(join(root, 'governance', 'scopes'))) return ['the scope must live under governance/scopes/'];
  if (!existsSync(file)) return [`no scope at ${scopeRel}`];
  const bundle = `${file}.sigstore.json`;
  if (!existsSync(bundle)) return [`the scope has no signature bundle (${scopeRel}.sigstore.json)`];
  const t = trust();
  if (!t?.securityApproverIdentityRegexp || !t?.securityApproverIssuer) return ['the managed trust file has no security-approver identity (fail closed)'];
  const v = spawnSync(cosign, ['verify-blob', file, '--bundle', bundle, '--certificate-identity-regexp', t.securityApproverIdentityRegexp,
    '--certificate-oidc-issuer', t.securityApproverIssuer], { encoding: 'utf8' });
  if (v.error) return [`cosign is not available (${v.error.code ?? v.error.message}): install it (fail closed)`];
  if (v.status !== 0) errors.push(`scope signature does not verify: ${(v.stderr || '').trim().split('\n').pop()}`);
  let scope;
  try { scope = JSON.parse(readFileSync(file, 'utf8')); } catch { return [...errors, 'the scope is not valid JSON']; }
  const start = Date.parse(scope.window?.start); const end = Date.parse(scope.window?.end);
  if (Number.isNaN(start) || Number.isNaN(end)) errors.push('the scope has no valid window.start and window.end');
  else if (now < start) errors.push(`the scope starts at ${scope.window.start}`);
  else if (now > end) errors.push(`the scope expired at ${scope.window.end}`);
  if (!Array.isArray(scope.targets) || !scope.targets.length) errors.push('the scope names no targets');
  if (!Array.isArray(scope.skills) || !scope.skills.length) errors.push('the scope names no skills');
  if (!scope.ticket || !scope.authorized_by) errors.push('the scope needs a ticket and authorized_by');
  const { checkTarget } = await packModule('rag/lib/targets.mjs');
  let qa = {};
  try { qa = JSON.parse(readFileSync(join(root, '.agents', 'qa.config.json'), 'utf8')); } catch { errors.push('cannot read .agents/qa.config.json'); }
  for (const h of scope.targets ?? []) { const r = checkTarget(h, qa); if (!r.ok) errors.push(`target ${h}: ${r.reason}`); }
  return errors;
}

export async function checkCommand(root, cmd, env = process.env) {
  if (/--update-snapshots\b|\s-u(\s|$)/.test(cmd) && /\bplaywright\b/.test(cmd)) return 'baselines are regenerated only by the update-baselines workflow in the pinned image';
  if (SECURITY_RUN.test(cmd)) {
    const m = /\bQA_SCOPE_FILE=("[^"]+"|'[^']+'|\S+)/.exec(cmd);
    const scopeRel = m ? m[1].replace(/^['"]|['"]$/g, '') : env.QA_SCOPE_FILE;
    if (!scopeRel) return 'security tests need a signed scope: run with QA_SCOPE_FILE=governance/scopes/<id>.json (security-scope-verify)';
    const errors = await verifyScope(root, scopeRel);
    if (errors.length) return `security scope refused: ${errors.join('; ')}`;
  }
  if (TARGETED.test(cmd)) {
    const { checkTarget } = await packModule('rag/lib/targets.mjs');
    const qa = JSON.parse(readFileSync(join(root, '.agents', 'qa.config.json'), 'utf8'));
    for (const u of cmd.match(/https?:\/\/[^\s"'`)]+/g) ?? []) {
      const r = checkTarget(u, qa);
      if (!r.ok) return `target refused: ${r.reason}`;
    }
  }
  return null;
}

const argv = process.argv.slice(2);
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (argv[0] === '--check') {
    guarded(async () => {
      const errors = await verifyScope(projectDir(), argv[1] ?? '');
      if (errors.length) { console.log(`scope INVALID:\n  - ${errors.join('\n  - ')}`); process.exit(1); }
      console.log(`scope valid: ${argv[1]}`);
    });
  } else {
    guarded(async () => {
      const p = await payload();
      const cmd = String(p.tool_input?.command ?? '');
      const r = await checkCommand(projectDir(p), cmd);
      if (r) block(r);
    });
  }
}
