#!/usr/bin/env node
// Contract test for exported spans: the attribute set is pinned in telemetry/span-contract.json because the GenAI
// semantic conventions are still at Development status. Builds sample spans and checks names, required and
// forbidden attributes, and that content capture is off.
import { readFileSync } from 'node:fs';
import { toSpan } from '../rag/telemetry/otlp.mjs';
const contract = JSON.parse(readFileSync('telemetry/span-contract.json', 'utf8'));
const qa = JSON.parse(readFileSync('.agents/qa.config.json', 'utf8'));
const p = [];
if (qa.telemetry?.captureContent !== false) p.push('telemetry.captureContent must be false');
const c = contract.spans.execute_tool;
for (const [event, data] of [['retrieval', { totalMs: 12.5, items: 6, tokens: 900, query: 'must never be exported', skill: 'scenario-design' }], ['ingest', { documents: 40 }]]) {
  const s = toSpan(event, data);
  const keys = s.attributes.map((a) => a.key);
  if (!new RegExp(c.namePattern).test(s.name)) p.push(`span name "${s.name}" does not match ${c.namePattern}`);
  for (const k of c.required) if (!keys.includes(k)) p.push(`${event}: missing ${k}`);
  for (const k of c.forbidden) if (keys.includes(k)) p.push(`${event}: forbidden attribute ${k} present`);
  if (JSON.stringify(s).includes('must never be exported')) p.push(`${event}: content leaked into the span`);
}
for (const x of p) console.log(`  - ${x}`);
console.log(p.length ? `check-telemetry-contract: ${p.length} problem(s)` : 'check-telemetry-contract: spans match the pinned contract');
process.exit(p.length ? 1 : 0);
