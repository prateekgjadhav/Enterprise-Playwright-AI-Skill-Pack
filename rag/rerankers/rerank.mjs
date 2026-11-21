// Tier-2 reranking after RRF. A cross-encoder reads the query and each candidate together, which a bi-encoder
// cannot, so it fixes the "right words, wrong passage" hits that fusion lets through.
//   "lexical-cross"  offline fallback: term coverage, phrase proximity, identifier and heading matches, intent
//                    priors and trust; deterministic, no model needed
//   "cohere"         Cohere Rerank (POST /v2/rerank)
//   "http"           a Text-Embeddings-Inference /rerank server hosting bge-reranker-large or an ms-marco cross-encoder
import { gatewayHeaders } from '../embeddings/embedder.mjs';
import { tokenize, TICKET_RE, fetchWithRetry } from '../lib/util.mjs';

function lexicalCross(query, cands, { intentTypes = [] } = {}) {
  const q = tokenize(query);
  const qset = [...new Set(q)];
  const ids = [...String(query).toUpperCase().matchAll(TICKET_RE)].map((m) => m[0]);
  return cands.map((c) => {
    const toks = tokenize(c.text);
    const set = new Set(toks);
    const coverage = qset.length ? qset.filter((t) => set.has(t)).length / qset.length : 0;
    let proximity = 0;
    for (let i = 0; i + 1 < q.length; i++) {
      const a = toks.indexOf(q[i]);
      if (a >= 0 && toks.slice(a + 1, a + 6).includes(q[i + 1])) proximity++;
    }
    proximity = q.length > 1 ? proximity / (q.length - 1) : 0;
    const head = c.heading ? tokenize(c.heading) : [];
    const headHit = head.length ? qset.filter((t) => head.includes(t)).length / qset.length : 0;
    const idHit = ids.some((id) => String(c.text).toUpperCase().includes(id) || String(c.docId).toUpperCase() === id) ? 1 : 0;
    const typeHit = intentTypes.length ? (intentTypes.indexOf(c.type) >= 0 ? 1 - intentTypes.indexOf(c.type) / (intentTypes.length * 2) : 0) : 0.5;
    const graph = c.sources?.graph ? 1 / (1 + (c.sources.graph.hops ?? 1)) : 0;   // related through the knowledge graph
    const score = 0.32 * coverage + 0.12 * proximity + 0.08 * headHit + 0.12 * idHit + 0.1 * typeHit + 0.06 * (c.trust ?? 0.6) + 0.08 * (c.fusedNorm ?? 0) + 0.12 * graph;
    return { ...c, rerankScore: Math.round(score * 1000) / 1000 };
  }).sort((a, b) => b.rerankScore - a.rerankScore);
}

async function external(cfg, query, cands) {
  const r = cfg.rag.reranker;
  const key = r.apiKeyEnv ? process.env[r.apiKeyEnv] : null;
  if (r.apiKeyEnv && !key) throw new Error(`the reranker needs ${r.apiKeyEnv} (from your secret store)`);
  const docs = cands.map((c) => c.text.slice(0, 2000));
  let scores;
  if (r.provider === 'gateway') {
    const base = cfg.qa?.ai?.gateway?.baseUrl;
    if (!base) throw new Error('rag.reranker.provider "gateway" needs ai.gateway.baseUrl in qa.config.json');
    const res = await fetchWithRetry(`${base.replace(/\/$/, '')}/rerank`, { method: 'POST', headers: { 'content-type': 'application/json', ...gatewayHeaders(r) }, body: JSON.stringify({ model: r.model, query, documents: docs, top_n: docs.length }) });
    if (!res.ok) throw new Error(`gateway rerank failed: HTTP ${res.status}`);
    scores = (await res.json()).results.map((x) => ({ index: x.index, score: x.relevance_score }));
  } else if (r.provider === 'cohere') {
    if (!r.endpoint) throw new Error('rag.reranker.endpoint is required for the "cohere" provider (no vendor default)');
    const res = await fetchWithRetry(r.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model: r.model, query, documents: docs, top_n: docs.length }) });
    if (!res.ok) throw new Error(`Cohere rerank failed: HTTP ${res.status}`);
    scores = (await res.json()).results.map((x) => ({ index: x.index, score: x.relevance_score }));
  } else if (r.provider === 'http') {
    const res = await fetchWithRetry(`${String(r.endpoint).replace(/\/$/, '')}/rerank`, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ query, texts: docs }) });
    if (!res.ok) throw new Error(`rerank server failed: HTTP ${res.status}`);
    scores = await res.json();
  } else throw new Error(`unknown reranker "${r.provider}" (lexical-cross, gateway, cohere, http)`);
  const byIndex = new Map(scores.map((s) => [s.index, s.score]));
  return cands.map((c, i) => ({ ...c, rerankScore: Math.round((byIndex.get(i) ?? 0) * 1000) / 1000 })).sort((a, b) => b.rerankScore - a.rerankScore);
}

/** Rerank candidates; on a remote failure fall back to the lexical cross-scorer and say so. */
export async function rerank(cfg, query, cands, opts = {}) {
  const p = cfg.rag.reranker.provider;
  if (p === 'lexical-cross' || p === 'none') return { results: p === 'none' ? cands : lexicalCross(query, cands, opts), provider: p };
  try { return { results: await external(cfg, query, cands), provider: p }; }
  catch (e) { return { results: lexicalCross(query, cands, opts), provider: 'lexical-cross', warning: `${p} reranker unavailable (${e.message}); used lexical-cross` }; }
}
