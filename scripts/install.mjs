#!/usr/bin/env node
// The installer behind install.sh. Verification first (signature, lock, revocation), then a patch against a
// temporary git worktree of the target, so the result is a diff a person reviews, never an in-place merge.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyLock } from './verify-lock.mjs';
import { matchesAny } from './lib/files.mjs';

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const pack = resolve(opt('--pack') ?? process.cwd());
const target = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--pack');
const apply = argv.includes('--apply'); const pr = argv.includes('--pr');
const die = (m) => { console.error(`install: ${m}`); process.exit(1); };
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const NEVER = [/^\.claude\/settings(\.local)?\.json$/];

if (!target) die('usage: install.sh <target-repo> [--apply] [--pr]');
const dest = resolve(target);
if (!existsSync(join(dest, '.git'))) die(`${dest} is not a git repository`);
const dirty = git(dest, 'status', '--porcelain').stdout.split('\n').filter((l) => l.trim() && !l.endsWith('.skill-pack.patch'));
if (dirty.length) die(`${dest} has uncommitted changes: commit or stash them first`);

// 1. Signature: the lock must be signed by the release identity in the managed trust file (or QA_TRUST_FILE).
const trustFile = process.env.QA_TRUST_FILE || '/opt/qa-pack/trust.json';
let trust; try { trust = JSON.parse(readFileSync(trustFile, 'utf8')); } catch { die(`cannot read the trust file ${trustFile} (deployed by MDM): refusing to install`); }
if (!trust.releaseIdentity || !trust.oidcIssuer) die('the trust file has no releaseIdentity/oidcIssuer: refusing to install');
const bundle = join(pack, 'skills.lock.json.sigstore.json');
if (!existsSync(bundle)) die('skills.lock.json.sigstore.json is missing: this pack is not a signed release');
const cosign = spawnSync(process.env.QA_COSIGN || 'cosign', ['verify-blob', join(pack, 'skills.lock.json'), '--bundle', bundle,
  '--certificate-identity', trust.releaseIdentity, '--certificate-oidc-issuer', trust.oidcIssuer], { encoding: 'utf8' });
if (cosign.error) die(`cosign is not available (${cosign.error.code}): install it; the installer never skips verification`);
if (cosign.status !== 0) die(`signature verification failed:\n${cosign.stderr}`);

// 2. Content: every file matches the signed lock, nothing extra, digest not revoked.
const v = verifyLock(pack);
if (!v.ok) die(`the pack does not match its lock:\n  - ${v.problems.join('\n  - ')}`);
const lock = JSON.parse(readFileSync(join(pack, 'skills.lock.json'), 'utf8'));
const tag = `pack-${lock.digest.slice(0, 12)}`;

// 3. Build the change in a temporary worktree of the target.
const tmp = mkdtempSync(join(tmpdir(), 'qa-pack-'));
const wt = join(tmp, 'wt');
if (git(dest, 'worktree', 'add', '--detach', '-q', wt, 'HEAD').status !== 0) die('cannot create a git worktree of the target');
const summary = { managed: 0, scaffold: 0, skipped: [] };
try {
  for (const rel of Object.keys(lock.files)) {
    if (matchesAny(rel, lock.installExclude)) continue;
    if (NEVER.some((r) => r.test(rel))) { summary.skipped.push(`${rel} (managed settings only)`); continue; }
    const to = join(wt, rel);
    if (rel === 'CLAUDE.md' && existsSync(to)) { summary.skipped.push('CLAUDE.md (exists; add "@AGENTS.md" to it yourself)'); continue; }
    if (matchesAny(rel, lock.scaffold) && existsSync(to)) { summary.skipped.push(`${rel} (yours)`); continue; }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(pack, rel), to);
    matchesAny(rel, lock.scaffold) ? summary.scaffold++ : summary.managed++;
  }
  copyFileSync(join(pack, 'skills.lock.json'), join(wt, 'skills.lock.json'));
  copyFileSync(bundle, join(wt, 'skills.lock.json.sigstore.json'));
  git(wt, 'add', '-A');
  const diff = git(wt, 'diff', '--cached', '--binary');
  writeFileSync(join(dest, '.skill-pack.patch'), diff.stdout);
} finally {
  git(dest, 'worktree', 'remove', '--force', wt);
  rmSync(tmp, { recursive: true, force: true });
}
const files = (readFileSync(join(dest, '.skill-pack.patch'), 'utf8').match(/^diff --git /gm) ?? []).length;
console.log(`install: ${tag} verified. Preview: ${dest}/.skill-pack.patch (${files} files: ${summary.managed} managed, ${summary.scaffold} scaffold).`);
for (const s of summary.skipped) console.log(`  kept: ${s}`);
if (!apply) { console.log('Review the patch, then run again with --apply.'); process.exit(0); }

// 4. Apply on a new branch and commit; git history is the only rollback.
const branch = `qa-pack/${tag}`;
if (git(dest, 'switch', '-c', branch).status !== 0) die(`cannot create branch ${branch}`);
const ap = git(dest, 'apply', '--index', '.skill-pack.patch');
if (ap.status !== 0) die(`git apply failed:\n${ap.stderr}`);
rmSync(join(dest, '.skill-pack.patch'));
const c = git(dest, 'commit', '-q', '-m', `chore(qa-pack): install ${tag}`, '-m', `Pack-Digest: ${lock.digest}\nAgent-Authored: false`);
if (c.status !== 0) die(`commit failed:\n${c.stderr}`);
console.log(`install: committed on ${branch}. Next: node scripts/link-skills.mjs, then repo-discovery and config-proposal.`);
if (pr) {
  if (git(dest, 'push', '-u', 'origin', branch).status !== 0) die('git push failed');
  const g = spawnSync('gh', ['pr', 'create', '--title', `QA skill pack ${tag}`, '--body', `Diff-only install of ${tag}. Signature and lock verified by install.sh.`, '--label', 'qa-pack'], { cwd: dest, encoding: 'utf8' });
  console.log(g.status === 0 ? g.stdout.trim() : `gh pr create failed: ${g.stderr}`);
}
