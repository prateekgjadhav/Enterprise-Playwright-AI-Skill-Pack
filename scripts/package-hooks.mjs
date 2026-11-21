#!/usr/bin/env node
// Builds the MDM payload for /opt/qa-pack: the hooks, a vendor/ copy of the modules they import, the managed settings
// and the trust template. Deploy it root-owned (0755 directories, 0644 files, hooks 0755) so no repository and no
// agent can change what enforces the rules. Usage: node scripts/package-hooks.mjs [dist/qa-pack]
import { cpSync, mkdirSync, rmSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
const out = process.argv[2] ?? 'dist/qa-pack';
const VENDOR = ['rag/lib/targets.mjs', 'rag/lib/util.mjs', 'rag/security/guard.mjs', 'scripts/lib/qa-config.mjs', 'scripts/lib/yaml-lite.mjs'];
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'hooks', 'vendor'), { recursive: true });
for (const f of readdirSync('hooks')) if (f.endsWith('.mjs')) { cpSync(join('hooks', f), join(out, 'hooks', f)); chmodSync(join(out, 'hooks', f), 0o755); }
for (const f of VENDOR) { mkdirSync(dirname(join(out, 'hooks', 'vendor', f)), { recursive: true }); cpSync(f, join(out, 'hooks', 'vendor', f)); }
cpSync('managed/managed-settings.json', join(out, 'managed-settings.json'));
cpSync('managed/trust.json', join(out, 'trust.json'));
console.log(`package-hooks: ${out} — deploy to /opt/qa-pack (root-owned) and managed-settings.json to the host's managed path; fill trust.json first.`);
