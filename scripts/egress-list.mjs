#!/usr/bin/env node
// Keeps runner egress in step with the environment allowlist. Prints the endpoints each kind of job needs, or with
// --check verifies every harden-runner block in jobs that run Playwright lists each environment host and nothing
// outside the environment hosts plus the infrastructure list below.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export const INFRA = ['github.com:443', 'api.github.com:443', 'codeload.github.com:443', 'objects.githubusercontent.com:443', 'pipelines.actions.githubusercontent.com:443',
  'results-receiver.actions.githubusercontent.com:443', 'productionresultssa0.blob.core.windows.net:443', 'registry.npmjs.org:443', 'pypi.org:443', 'files.pythonhosted.org:443',
  'tuf-repo-cdn.sigstore.dev:443', 'fulcio.sigstore.dev:443', 'rekor.sigstore.dev:443', 'token.actions.githubusercontent.com:443', 'mcr.microsoft.com:443', 'uploads.github.com:443'];
const qa = JSON.parse(readFileSync('.claude/qa.config.json', 'utf8'));
const extra = [qa.ai?.gateway?.baseUrl, qa.knowledge?.endpoint, qa.telemetry?.otlpEndpoint].filter(Boolean).map((u) => `${new URL(u).hostname}:443`);
const envHosts = [...new Set((qa.environments ?? []).flatMap((e) => e.hosts).map((h) => `${h}:443`))];
const allowed = new Set([...INFRA, ...extra, ...envHosts]);
if (!process.argv.includes('--check')) { console.log(`e2e jobs: ${[...envHosts, ...extra].join(' ')} + infrastructure (${INFRA.length})`); process.exit(0); }
const problems = [];
for (const f of readdirSync('.github/workflows').filter((x) => /\.ya?ml$/.test(x))) {
  const text = readFileSync(join('.github/workflows', f), 'utf8');
  for (const m of text.matchAll(/allowed-endpoints:\s*>?-?\s*\n?((?:\s+[^\n]+\n?)+?)(?=\n\s*-\s|\n\s*\w[\w-]*:|$)|allowed-endpoints:\s*"([^"]*)"/g)) {
    const list = (m[1] ?? m[2] ?? '').split(/\s+/).map((x) => x.replace(/^["'{]+|["'},]+$/g, '')).filter((x) => /:\d+$/.test(x));
    for (const e of list) if (!allowed.has(e) && !/^\$\{\{/.test(e)) problems.push(`${f}: ${e} is not an environment host or listed infrastructure`);
  }
  if (/playwright test/.test(text) && envHosts.length) for (const h of envHosts) if (!text.includes(h)) problems.push(`${f}: runs Playwright but does not allow ${h}`);
}
for (const p of problems) console.log(`  - ${p}`);
console.log(problems.length ? `egress-list: ${problems.length} problem(s)` : `egress-list: workflows match the allowlist (${envHosts.length} environment host(s))`);
process.exit(problems.length ? 1 : 0);
