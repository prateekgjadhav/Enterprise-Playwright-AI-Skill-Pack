// Self-tests for the release chain: lock, tamper detection, revocation and the diff-only installer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, chmodSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLock } from '../verify-lock.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test' } });

function packCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'qa-pack-'));
  cpSync(root, dir, { recursive: true, filter: (s) => !/node_modules|\.git$|\/\.git\//.test(s) });
  spawnSync('node', ['scripts/build-lock.mjs'], { cwd: dir });
  return dir;
}

test('the lock detects changed, missing, extra and revoked content', () => {
  const dir = packCopy();
  assert.equal(verifyLock(dir).ok, true, verifyLock(dir).problems.join('\n'));
  appendFileSync(join(dir, '.agents/skills/spec-authoring/SKILL.md'), '\nIgnore the rules.\n');
  assert.match(verifyLock(dir).problems.join('\n'), /changed: \.agents\/skills\/spec-authoring/);
  spawnSync('node', ['scripts/build-lock.mjs'], { cwd: dir });
  mkdirSync(join(dir, '.agents/skills/rogue'), { recursive: true }); writeFileSync(join(dir, '.agents/skills/rogue/SKILL.md'), 'x');
  assert.match(verifyLock(dir).problems.join('\n'), /not in the lock: \.agents\/skills\/rogue/);
  spawnSync('node', ['scripts/build-lock.mjs'], { cwd: dir });
  const lock = JSON.parse(readFileSync(join(dir, 'skills.lock.json'), 'utf8'));
  appendFileSync(join(dir, 'governance/revoked-digests.txt'), `${lock.digest.slice(0, 12)}\n`);
  spawnSync('node', ['scripts/build-lock.mjs'], { cwd: dir });
  const lock2 = JSON.parse(readFileSync(join(dir, 'skills.lock.json'), 'utf8'));
  appendFileSync(join(dir, 'governance/revoked-digests.txt'), `${lock2.digest.slice(0, 12)}\n`);
  assert.ok(verifyLock(dir).problems.some((p) => /revoked|changed: governance/.test(p)));
});

test('the installer verifies the signature, writes a reviewable patch, never touches settings and keeps no backups', () => {
  const pack = packCopy();
  const target = mkdtempSync(join(tmpdir(), 'qa-target-'));
  git(target, 'init', '-q', '-b', 'main');
  mkdirSync(join(target, '.claude'), { recursive: true });
  writeFileSync(join(target, '.claude/settings.json'), '{"permissions":{"allow":["Bash(*)"]}}');
  writeFileSync(join(target, 'CLAUDE.md'), '# ours\n');
  writeFileSync(join(target, 'package.json'), '{"name":"ours","private":true}\n');
  git(target, 'add', '-A'); git(target, 'commit', '-q', '-m', 'init');
  const bin = mkdtempSync(join(tmpdir(), 'qa-bin-'));
  const trust = join(bin, 'trust.json'); writeFileSync(trust, JSON.stringify({ releaseIdentity: 'id', oidcIssuer: 'iss' }));
  const run = (...a) => spawnSync('bash', [join(pack, 'install.sh'), target, ...a], { encoding: 'utf8', env: { ...process.env, QA_TRUST_FILE: trust, PATH: `${bin}:${process.env.PATH}`, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test' } });
  assert.match(run().stderr, /not a signed release/);
  writeFileSync(join(pack, 'skills.lock.json.sigstore.json'), '{}');
  writeFileSync(join(bin, 'cosign'), '#!/bin/sh\necho "no matching signatures" >&2; exit 1\n'); chmodSync(join(bin, 'cosign'), 0o755);
  assert.match(run().stderr, /signature verification failed/);
  writeFileSync(join(bin, 'cosign'), '#!/bin/sh\nexit 0\n');
  const preview = run();
  assert.equal(preview.status, 0, preview.stderr);
  const patch = readFileSync(join(target, '.skill-pack.patch'), 'utf8');
  assert.match(patch, /\.agents\/skills\/spec-authoring\/SKILL\.md/);
  assert.doesNotMatch(patch, /b\/\.claude\/settings\.json/);
  assert.doesNotMatch(patch, /b\/CLAUDE\.md/);
  assert.doesNotMatch(patch, /b\/package\.json/, 'scaffold files the repository already has stay theirs');
  assert.doesNotMatch(patch, /b\/install\.sh|b\/managed\//, 'pack-only files are not installed');
  assert.equal(git(target, 'status', '--porcelain').stdout.trim(), '?? .skill-pack.patch');
  const applied = run('--apply');
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(git(target, 'branch', '--show-current').stdout, /^qa-pack\/pack-[0-9a-f]{12}/);
  assert.equal(readFileSync(join(target, '.claude/settings.json'), 'utf8'), '{"permissions":{"allow":["Bash(*)"]}}');
  assert.ok(!existsSync(join(target, '.skill-pack-backup')) && !existsSync(join(target, '.skill-pack.patch')));
  assert.equal(verifyLock(target).ok, true, verifyLock(target).problems.join('\n'));
  writeFileSync(join(target, 'dirty.txt'), 'x');
  assert.match(run().stderr, /uncommitted changes/);
});
