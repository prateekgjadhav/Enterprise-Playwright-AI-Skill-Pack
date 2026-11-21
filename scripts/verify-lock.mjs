#!/usr/bin/env node
// Verifies the working tree against skills.lock.json.
//   pack mode (install.sh present): every locked file matches, no unlocked file exists, the digest is consistent
//   repository mode (installed copy): every managed file matches; scaffold files belong to the repository and
//     pack-only files are absent by design; no unlocked file may appear under .agents/skills, policy or rag
//   both: the lock digest is not in governance/revoked-digests.txt
// It does not check the signature: that is release-signing-verify (cosign) in CI and at install.
// Usage: node scripts/verify-lock.mjs [--root <dir>] [--quiet]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeLock, sha256, walk, matchesAny, NOT_LOCKED } from './lib/files.mjs';

export function verifyLock(root) {
  const problems = [];
  const lockPath = join(root, 'skills.lock.json');
  if (!existsSync(lockPath)) return { ok: false, problems: ['skills.lock.json is missing'] };
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const { digest, ...body } = lock;
  if (sha256(JSON.stringify(body)) !== digest) problems.push('the lock digest does not match its contents (the lock was edited)');
  const pack = existsSync(join(root, 'install.sh'));
  const revoked = existsSync(join(root, 'governance/revoked-digests.txt'))
    ? readFileSync(join(root, 'governance/revoked-digests.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  if (revoked.some((r) => digest.startsWith(r) || r.startsWith(digest.slice(0, 12)))) problems.push(`the pack digest ${digest.slice(0, 12)} is revoked`);
  for (const [rel, hash] of Object.entries(lock.files)) {
    const scaffold = matchesAny(rel, lock.scaffold);
    const excluded = matchesAny(rel, lock.installExclude);
    const p = join(root, rel);
    if (!existsSync(p)) { if (pack || (!scaffold && !excluded)) problems.push(`missing: ${rel}`); continue; }
    if (!pack && scaffold) continue;
    if (sha256(readFileSync(p)) !== hash) problems.push(`changed: ${rel}`);
  }
  const present = walk(root).filter((r) => !NOT_LOCKED.includes(r));
  for (const rel of present) {
    if (lock.files[rel]) continue;
    if (pack || /^(\.agents\/skills|policy|rag)\//.test(rel)) problems.push(`not in the lock: ${rel}`);
  }
  if (pack) { const fresh = computeLock(root); if (fresh.digest !== digest && !problems.length) problems.push('the lock is stale: run node scripts/build-lock.mjs'); }
  return { ok: !problems.length, problems, digest, mode: pack ? 'pack' : 'repository' };
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const root = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd();
  const r = verifyLock(root);
  if (!r.ok) { console.log(`verify-lock: FAIL (${r.mode ?? 'n/a'})`); for (const p of r.problems.slice(0, 50)) console.log(`  - ${p}`); if (r.problems.length > 50) console.log(`  … ${r.problems.length - 50} more`); process.exit(1); }
  if (!argv.includes('--quiet')) console.log(`verify-lock: OK (${r.mode}) digest ${r.digest.slice(0, 12)}`);
}
