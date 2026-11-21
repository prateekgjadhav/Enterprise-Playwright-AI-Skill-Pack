#!/usr/bin/env node
// Every third-party reference must be immutable:
//   GitHub Actions  owner/repo@<40-hex commit sha> (the tag goes in a comment, which Renovate maintains)
//   images          name[:tag]@sha256:<digest>, and the Playwright image matches @playwright/test
//   npm             exact versions in package.json and a committed package-lock.json with integrity hashes
//   Python          every requirement in evals/requirements.txt carries --hash=sha256:
// Usage: node scripts/check-pins.mjs [--root <dir>]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function checkPins(root) {
  const f = [];
  const wfDir = join(root, '.github/workflows');
  for (const w of existsSync(wfDir) ? readdirSync(wfDir).filter((x) => /\.ya?ml$/.test(x)) : []) {
    const text = readFileSync(join(wfDir, w), 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      const u = /^\s*-?\s*uses:\s*([^\s#]+)/.exec(line);
      if (u && !u[1].startsWith('./') && !/@[0-9a-f]{40}$/.test(u[1]) && !/^docker:\/\/.+@sha256:[0-9a-f]{64}$/.test(u[1])) f.push(`${w}:${i + 1} action not pinned to a commit sha: ${u[1]}`);
      const img = /\bimage:\s*["']?([^\s"'#]+)/.exec(line);
      if (img && !/@sha256:[0-9a-f]{64}$/.test(img[1])) f.push(`${w}:${i + 1} image not pinned by digest: ${img[1]}`);
    }
    const pw = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)/.exec(text);
    const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) : {};
    const lib = pkg.devDependencies?.['@playwright/test'] ?? pkg.dependencies?.['@playwright/test'];
    if (pw && lib && pw[1] !== lib) f.push(`${w}: runner image Playwright ${pw[1]} differs from @playwright/test ${lib}`);
  }
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const block of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [n, v] of Object.entries(pkg[block] ?? {})) if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v)) f.push(`package.json ${block}.${n} is not an exact version: ${v}`);
    }
    const lock = join(root, 'package-lock.json');
    if (!existsSync(lock)) f.push('package-lock.json is missing: run npm install once and commit it');
    else {
      const l = JSON.parse(readFileSync(lock, 'utf8'));
      if ((l.lockfileVersion ?? 0) < 2) f.push('package-lock.json lockfileVersion is below 2');
      for (const [p, e] of Object.entries(l.packages ?? {})) if (p && !e.link && !e.integrity) f.push(`package-lock.json ${p} has no integrity hash`);
    }
  }
  const req = join(root, 'evals/requirements.txt');
  if (existsSync(req)) {
    const reqs = readFileSync(req, 'utf8').replace(/\\\n/g, ' ').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (!reqs.length) f.push('evals/requirements.txt is empty: pip-compile --generate-hashes evals/requirements.in');
    for (const r of reqs) if (!/--hash=sha256:[0-9a-f]{64}/.test(r)) f.push(`evals/requirements.txt: ${r.split(/\s/)[0]} has no --hash`);
  }
  return f;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const f = checkPins(argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd());
  for (const x of f) console.log(`  - ${x}`);
  console.log(f.length ? `check-pins: ${f.length} unpinned reference(s)` : 'check-pins: every reference is pinned');
  process.exit(f.length ? 1 : 0);
}
