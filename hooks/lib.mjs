// Shared helpers for the managed hooks. The hooks are deployed root-owned to /opt/qa-pack/hooks by MDM together
// with a vendor/ copy of the few pack modules they need (scripts/package-hooks.mjs), so they never import code
// from a repository an agent can edit. Run from the repository (tests), they fall back to the repository copy.
// Every hook fails closed: any error exits 2, which blocks the action in Claude Code and shows the reason.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, 'vendor');
const base = existsSync(vendor) ? vendor : resolve(here, '..');

/** Import a pack module from vendor/ (deployed) or the repository (tests). */
export const packModule = (rel) => import(pathToFileURL(join(base, rel)).href);

export function block(reason) {
  process.stderr.write(`[qa-pack] ${reason}\n`);
  process.exit(2);
}

/** Read the hook payload from stdin; malformed input blocks. */
export async function payload() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return block('hook input is not valid JSON (fail closed)'); }
}

/** The project directory the agent is working in. */
export const projectDir = (p) => resolve(p?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());

/** Expected signer identities: from QA_TRUST_FILE (CI, tests) or the managed /opt/qa-pack/trust.json. */
export function trust() {
  const file = process.env.QA_TRUST_FILE || join(here, '..', 'trust.json');
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/** Run a hook body; any thrown error blocks. */
export function guarded(fn) {
  Promise.resolve().then(fn).then(() => process.exit(0), (e) => block(`hook error (fail closed): ${e?.message ?? e}`));
}
