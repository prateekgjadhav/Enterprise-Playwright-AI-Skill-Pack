#!/usr/bin/env node
// Writes skills.lock.json: the sha256 of every pack file and the digest of the whole set. Deterministic (no
// timestamps, no version numbers): the digest is the release identity, and release.yml signs this file keylessly.
// Usage: node scripts/build-lock.mjs [--root <dir>]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeLock } from './lib/files.mjs';
const argv = process.argv.slice(2);
const root = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd();
const lock = computeLock(root);
writeFileSync(join(root, 'skills.lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(`skills.lock.json: ${Object.keys(lock.files).length} files, digest ${lock.digest.slice(0, 12)} (tag pack-${lock.digest.slice(0, 12)})`);
