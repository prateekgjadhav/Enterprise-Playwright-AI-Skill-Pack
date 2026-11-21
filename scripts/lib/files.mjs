// Pack file inventory: the same walk feeds the lock, its verification and the generated guide.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Never part of the pack: derived data, local state, dependencies, git internals. Mirrors .gitignore. */
export const IGNORED = [/^\.git\//, /^node_modules\//, /(^|\/)node_modules\//, /^\.auth\//, /^\.env($|\.)/, /^secrets\//,
  /^\.agents\/(rag-index|telemetry|out|discovery)\//, /^\.agents\/memory\/pending\//, /^\.agents\/skills-manifest\.json$/, /^evals\/results\//, /^reports\//,
  /^test-results\//, /^blob-report\//, /^playwright-report\//, /^scrubbed\//, /^dist\//, /^\.skill-pack\.patch$/, /^\.claude\/skills\//,
  /(^|\/)__pycache__\//, /\.pyc$/, /(^|\/)\.DS_Store$/];
/** Part of the repository but not of the lock: the lock itself, its signature and the guide generated from it. */
export const NOT_LOCKED = ['skills.lock.json', 'skills.lock.json.sigstore.json', 'Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html'];

export const posix = (p) => p.replace(/\\/g, '/');
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function walk(root) {
  const out = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name); const rel = posix(relative(root, abs));
      const st = statSync(abs);
      if (st.isDirectory()) { if (!IGNORED.some((r) => r.test(rel + '/'))) visit(abs); }
      else if (st.isFile() && !IGNORED.some((r) => r.test(rel))) out.push(rel);
    }
  };
  visit(root);
  return out;
}

export function globToRe(glob) {
  const s = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*');
  return new RegExp(`^${s}$`);
}
export const matchesAny = (rel, globs = []) => globs.some((g) => globToRe(g).test(rel));

export function readManifest(root) {
  const p = join(root, 'install-manifest.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { exclude: [], scaffold: [] };
}

/** { files: { path: sha256 }, digest } for the pack at root. */
export function computeLock(root) {
  const files = {};
  for (const rel of walk(root)) if (!NOT_LOCKED.includes(rel)) files[rel] = sha256(readFileSync(join(root, rel)));
  const m = readManifest(root);
  const body = { algorithm: 'sha256', installExclude: m.exclude ?? [], scaffold: m.scaffold ?? [], files };
  return { ...body, digest: sha256(JSON.stringify(body)) };
}
