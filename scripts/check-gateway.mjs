#!/usr/bin/env node
// Validates gateway/routes.json against the data-class policy: restricted is BLOCK, confidential is self-hosted,
// every model id is pinned (no floating aliases), budget shares add up to at most 1, and the judge is pinned.
import { readFileSync } from 'node:fs';
export function checkGateway(routes, qa = {}) {
  const p = []; const r = routes.routes ?? {};
  for (const c of ['public', 'internal', 'confidential', 'restricted']) if (!(c in r)) p.push(`route "${c}" is missing`);
  if (r.restricted !== 'BLOCK') p.push('restricted must be "BLOCK"');
  if (r.confidential && r.confidential.external !== false) p.push('confidential routes must be self-hosted (external: false)');
  let share = 0;
  for (const [c, v] of Object.entries(r)) {
    if (v === 'BLOCK') continue;
    for (const m of v.models ?? []) if (!m || /(^|[-:@/])latest$|\*/.test(m)) p.push(`${c}: model "${m}" is not pinned`);
    share += Number(v.budgetShare ?? 0);
  }
  if (share > 1.0001) p.push(`budget shares add up to ${share}`);
  if (qa.ai?.judgeModel && /(^|[-:@/])latest$/.test(qa.ai.judgeModel)) p.push(`ai.judgeModel "${qa.ai.judgeModel}" is not pinned`);
  return p;
}
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const p = checkGateway(JSON.parse(readFileSync('gateway/routes.json', 'utf8')), JSON.parse(readFileSync('.claude/qa.config.json', 'utf8')));
  for (const x of p) console.log(`  - ${x}`);
  console.log(p.length ? `check-gateway: ${p.length} problem(s)` : 'check-gateway: routes follow the data-class policy');
  process.exit(p.length ? 1 : 0);
}
