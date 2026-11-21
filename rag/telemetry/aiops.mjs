// AI-Ops events: one JSON line per retrieval, ingest, gate or memory event. Decision metadata only (stage
// latencies, counts, token estimates, cost); never query text beyond a hash, never retrieved content.
// Switch it off with rag.telemetry.enabled: false (or aiOpsLog: null). The top-level telemetry block configures
// OTLP export (rag/telemetry/otlp.mjs): when telemetry.otlpEndpoint is set every event is also sent as a span. The log rotates at
// rag.telemetry.maxBytes (default 10 MB): the current file moves to <log>.1, replacing the previous one.
import { existsSync, statSync, renameSync } from 'node:fs';
import { appendJsonl, sha256, nowIso, estimateTokens } from '../lib/util.mjs';
import { exportEvent } from './otlp.mjs';

export function logEvent(cfg, event, data = {}) {
  exportEvent(cfg, event, data);
  const tel = cfg.rag.telemetry ?? {};
  if (tel.enabled === false || !tel.aiOpsLog) return;
  try {
    const max = tel.maxBytes ?? 10 * 1024 * 1024;
    if (existsSync(cfg.paths.aiOps) && statSync(cfg.paths.aiOps).size >= max) renameSync(cfg.paths.aiOps, cfg.paths.aiOps + '.1');
    appendJsonl(cfg.paths.aiOps, { at: nowIso(), event, ...data });
  } catch { /* telemetry never breaks a run */ }
}
export const queryHash = (q) => sha256(String(q)).slice(0, 12);
export function costOf(cfg, tokens) { return Math.round((tokens / 1000) * cfg.rag.telemetry.costPer1kTokensUsd * 10000) / 10000; }
export { estimateTokens };

/** A tiny stopwatch for per-stage latencies. */
export function timer() {
  const t0 = performance.now(); const marks = {}; let last = t0;
  return { mark(name) { const n = performance.now(); marks[name] = Math.round((n - last) * 10) / 10; last = n; }, done() { return { ...marks, totalMs: Math.round((performance.now() - t0) * 10) / 10 }; } };
}
