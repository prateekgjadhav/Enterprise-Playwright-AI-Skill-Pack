// OTLP/HTTP (JSON) export of the knowledge layer's events as OpenTelemetry spans that follow the GenAI semantic
// conventions (gen_ai.operation.name, gen_ai.tool.name, gen_ai.usage.*) plus the pack's own qa.* attributes.
// Decision metadata only: logEvent() never records query text or retrieved content, and neither does this.
// Enabled when qa.config.json telemetry.otlpEndpoint is set; any OTLP backend works. Export is best-effort and
// never breaks a run. The attribute set is pinned in telemetry/span-contract.json and contract-tested, because
// the GenAI conventions are still at Development status.
import { randomBytes } from 'node:crypto';

const SCALAR = (v) => ['string', 'number', 'boolean'].includes(typeof v);
const attr = (key, v) => ({ key, value: typeof v === 'number' ? (Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { boolValue: v } : { stringValue: String(v) } });
const CONTENT_KEYS = /^(query|text|content|prompt|completion|answer|title|body)$/i;

/** One OTLP span for one AI-Ops event. */
export function toSpan(event, data = {}, { now = Date.now(), traceId = process.env.QA_TRACE_ID } = {}) {
  const durMs = Number(data.totalMs ?? data.latency?.totalMs ?? 0) || 0;
  const end = BigInt(now) * 1000000n; const start = end - BigInt(Math.round(durMs * 1e6));
  const attributes = [
    attr('gen_ai.operation.name', 'execute_tool'),
    attr('gen_ai.tool.name', `qa-knowledge.${event}`),
    attr('qa.skill.name', data.skill ?? process.env.QA_SKILL ?? 'knowledge-retrieval'),
    attr('qa.data_class', data.dataClass ?? 'internal'),
  ];
  if (process.env.QA_SKILL_HASH) attributes.push(attr('qa.skill.hash', process.env.QA_SKILL_HASH));
  if (data.tokens != null) attributes.push(attr('gen_ai.usage.output_tokens', Number(data.tokens) || 0));
  for (const [k, v] of Object.entries(data)) {
    if (!SCALAR(v) || CONTENT_KEYS.test(k) || ['skill', 'dataClass', 'tokens'].includes(k)) continue;
    attributes.push(attr(`qa.${k.replace(/[^\w.]/g, '_')}`, v));
  }
  return {
    traceId: /^[0-9a-f]{32}$/.test(traceId ?? '') ? traceId : randomBytes(16).toString('hex'),
    spanId: randomBytes(8).toString('hex'),
    name: `execute_tool qa-knowledge.${event}`,
    kind: 1,
    startTimeUnixNano: String(start), endTimeUnixNano: String(end),
    attributes,
  };
}

export function toPayload(spans, service = 'qa-knowledge') {
  return { resourceSpans: [{ resource: { attributes: [attr('service.name', service)] }, scopeSpans: [{ scope: { name: 'enterprise-playwright-ai-skill-pack' }, spans }] }] };
}

/** Send one event as a span. Best-effort: errors are swallowed so telemetry never breaks a run. */
export function exportEvent(cfg, event, data) {
  const endpoint = cfg.qa?.telemetry?.otlpEndpoint;
  if (!endpoint || typeof fetch !== 'function') return;
  const url = `${String(endpoint).replace(/\/$/, '')}/v1/traces`;
  const headers = { 'content-type': 'application/json' };
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) for (const kv of process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',')) { const [k, ...v] = kv.split('='); if (k && v.length) headers[k.trim()] = v.join('=').trim(); }
  fetch(url, { method: 'POST', headers, body: JSON.stringify(toPayload([toSpan(event, data)])) }).catch(() => {});
}
