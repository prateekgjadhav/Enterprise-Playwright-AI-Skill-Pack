// Embedding providers. "local-hash" is an offline, dependency-free fallback (feature hashing over stemmed
// words, character trigrams and a QA synonym map); it keeps the pack runnable anywhere and in CI, but a real
// embedding model ("openai", "ollama", or any Text-Embeddings-Inference "http" endpoint) gives better recall.
// Keys are read from the environment variable the config names; they are never written anywhere.
import { createHash } from 'node:crypto';
import { tokenize, fetchWithRetry } from '../lib/util.mjs';

// Domain synonyms let the offline embedder bridge common wording gaps in QA artefacts.
const SYNONYMS = [
  ['login', 'log', 'signin', 'sign', 'authenticat', 'credential', 'session'],
  ['checkout', 'payment', 'purchas', 'order', 'pay'],
  ['cart', 'basket', 'bag'],
  ['coupon', 'discount', 'promo', 'voucher', 'code'],
  ['defect', 'bug', 'failur', 'fail', 'error', 'regression', 'incident'],
  ['flaky', 'intermittent', 'unstable', 'nondeterministic', 'retry', 'timing', 'race'],
  ['permission', 'role', 'authoriz', 'authoris', 'access', 'forbidden', 'idor', 'admin'],
  ['invalid', 'reject', 'negativ', 'wrong', 'malformed', 'expired'],
  ['boundary', 'limit', 'maximum', 'minimum', 'edge', 'threshold'],
  ['slow', 'latency', 'performanc', 'timeout', 'speed'],
  ['locator', 'selector', 'element', 'getbyrole', 'xpath'],
  ['root', 'cause', 'rca', 'diagnos', 'resolution', 'fix'],
];
const SYN = new Map();
SYNONYMS.forEach((group, i) => group.forEach((w) => SYN.set(w, `syn${i}`)));

const SYN_KEYS = [...SYN.keys()].filter((k) => k.length >= 4);
export function synonymOf(t) {
  if (SYN.has(t)) return SYN.get(t);
  const k = SYN_KEYS.find((x) => t.startsWith(x));
  return k ? SYN.get(k) : null;
}

function hashIndex(token, dim) {
  const h = createHash('md5').update(token).digest();
  return { i: h.readUInt32LE(0) % dim, sign: h[4] & 1 ? 1 : -1 };
}
export function localHashEmbed(text, dim = 384) {
  const v = new Float64Array(dim);
  const add = (tok, w) => { const { i, sign } = hashIndex(tok, dim); v[i] += sign * w; };
  for (const t of tokenize(text)) {
    add('w:' + t, 1.0);
    const syn = synonymOf(t);
    if (syn) add('s:' + syn, 0.8);
    if (t.length > 4 && !/\d/.test(t)) for (let i = 0; i + 3 <= t.length; i++) add('c:' + t.slice(i, i + 3), 0.25);
  }
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => Math.round((x / n) * 1e5) / 1e5);
}

async function postJson(url, body, headers = {}) {
  const res = await fetchWithRetry(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`embedding request to ${new URL(url).host} failed: HTTP ${res.status}`);
  return res.json();
}
/** Headers every gateway call carries: a short-lived token (OIDC-exchanged in CI), the data class and the skill. */
export function gatewayHeaders(e = {}, skill = 'knowledge-retrieval') {
  const token = process.env[e.tokenEnv ?? 'QA_GATEWAY_TOKEN'];
  if (!token) throw new Error(`the gateway needs ${e.tokenEnv ?? 'QA_GATEWAY_TOKEN'} (a short-lived token from your identity provider)`);
  return { authorization: `Bearer ${token}`, 'x-qa-data-class': e.dataClass ?? 'internal', 'x-qa-skill': skill };
}
const keyFrom = (envName) => {
  if (!envName) return null;
  const k = process.env[envName];
  if (!k) throw new Error(`the embedding provider needs the environment variable ${envName} (from your secret store)`);
  return k;
};

/** Returns { id, dim, embed(texts[]) -> Promise<number[][]> } for the configured provider. */
export function createEmbedder(cfg) {
  const e = cfg.rag.embeddings;
  const id = `${e.provider}:${e.model}`;
  if (e.provider === 'local-hash') return { id, dim: e.dim, embed: async (texts) => texts.map((t) => localHashEmbed(t, e.dim)) };
  if (e.provider === 'gateway') {   // the organisation's OpenAI-compatible model gateway (vendor-neutral default for production)
    const base = cfg.qa?.ai?.gateway?.baseUrl;
    if (!base) throw new Error('rag.embeddings.provider "gateway" needs ai.gateway.baseUrl in qa.config.json');
    return { id, dim: e.dim, embed: async (texts) => {
      const j = await postJson(`${base.replace(/\/$/, '')}/embeddings`, { model: e.model, input: texts }, gatewayHeaders(e));
      return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } };
  }
  if (e.provider === 'openai') {   // any OpenAI-compatible endpoint; there is no vendor default
    if (!e.endpoint) throw new Error('rag.embeddings.endpoint is required for the "openai" provider (no vendor default)');
    return { id, dim: e.dim, embed: async (texts) => {
      const j = await postJson(e.endpoint, { model: e.model, input: texts }, e.apiKeyEnv ? { authorization: `Bearer ${keyFrom(e.apiKeyEnv)}` } : {});
      return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } };
  }
  if (e.provider === 'ollama') {
    return { id, dim: e.dim, embed: async (texts) => (await postJson(`${e.endpoint ?? 'http://localhost:11434'}/api/embed`, { model: e.model, input: texts })).embeddings };
  }
  if (e.provider === 'http') {   // Hugging Face Text Embeddings Inference and compatible servers
    if (!e.endpoint) throw new Error('rag.embeddings.endpoint is required for the "http" provider');
    const headers = e.apiKeyEnv ? { authorization: `Bearer ${keyFrom(e.apiKeyEnv)}` } : {};
    return { id, dim: e.dim, embed: async (texts) => postJson(`${e.endpoint.replace(/\/$/, '')}/embed`, { inputs: texts }, headers) };
  }
  throw new Error(`unknown embeddings provider "${e.provider}" (local-hash, gateway, openai, ollama, http)`);
}

/** Embed in batches, reusing cached vectors for unchanged chunks (keyed by embedder id + text hash). */
export async function embedAll(embedder, texts, cache = {}, batchSize = 64) {
  const key = (t) => embedder.id + ':' + createHash('sha256').update(t).digest('hex').slice(0, 32);
  const out = new Array(texts.length);
  const todo = [];
  texts.forEach((t, i) => { const c = cache[key(t)]; if (c) out[i] = c; else todo.push(i); });
  for (let s = 0; s < todo.length; s += batchSize) {
    const idx = todo.slice(s, s + batchSize);
    const vecs = await embedder.embed(idx.map((i) => texts[i]));
    idx.forEach((i, j) => { out[i] = vecs[j]; cache[key(texts[i])] = vecs[j]; });
  }
  return { vectors: out, cache, reused: texts.length - todo.length };
}
