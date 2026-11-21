#!/usr/bin/env node
// Token budget status from ai.budgets and the AI-Ops log (.agents/telemetry/ai-ops.jsonl): today's tokens by skill.
// Exit 0 under 80 %, 0 with a warning from 80 %, 1 at or over 100 %, 2 when budgets are not configured (fail closed).
import { readFileSync, existsSync } from 'node:fs';
const qa = JSON.parse(readFileSync('.agents/qa.config.json', 'utf8'));
const b = qa.ai?.budgets ?? {};
if (!(b.dailyTokens > 0) || !(b.sessionTokens > 0)) { console.log('budget-status: ai.budgets.dailyTokens and sessionTokens are not configured (fail closed)'); process.exit(2); }
const log = qa.rag?.telemetry?.aiOpsLog ?? '.agents/telemetry/ai-ops.jsonl';
const today = new Date().toISOString().slice(0, 10);
const bySkill = {}; let total = 0;
if (existsSync(log)) for (const line of readFileSync(log, 'utf8').split('\n')) {
  if (!line.trim()) continue; let e; try { e = JSON.parse(line); } catch { continue; }
  if (!String(e.at ?? '').startsWith(today)) continue;
  const t = ['tokens', 'tokensServed', 'inputTokens', 'outputTokens'].reduce((s, k) => s + (Number(e[k]) || 0), 0);
  total += t; const k = e.skill ?? e.event ?? 'unknown'; bySkill[k] = (bySkill[k] ?? 0) + t;
}
const pct = total / b.dailyTokens;
console.log(`budget-status: ${total} of ${b.dailyTokens} daily tokens (${Math.round(pct * 100)} %)`);
for (const [k, v] of Object.entries(bySkill).sort((x, y) => y[1] - x[1]).slice(0, 10)) console.log(`  ${k}: ${v}`);
if (pct >= 1) { console.log('STOP: the daily budget is spent. A temporary increase needs an approval attestation.'); process.exit(1); }
if (pct >= 0.8) console.log('WARN: 80 % of the daily budget is used.');
