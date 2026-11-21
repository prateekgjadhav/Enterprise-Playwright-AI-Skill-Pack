// The three retrievers behind hybrid search, and their fusion.
//   BM25    exact terms: error messages, stack frames, CVE ids, ticket keys, test titles
//   vector  meaning: requirements, RCA narratives, documentation
//   graph   relationships: requirement ↔ test ↔ execution ↔ defect ↔ RCA ↔ page ↔ finding
// Weighted Reciprocal Rank Fusion combines the ranked lists without having to calibrate their scores.
import { tokenize, cosine } from '../lib/util.mjs';

export class BM25 {
  constructor(chunks, { k1 = 1.2, b = 0.75 } = {}) {
    this.k1 = k1; this.b = b;
    this.docs = chunks.map((c) => { const t = tokenize(c.text); const tf = new Map(); for (const w of t) tf.set(w, (tf.get(w) ?? 0) + 1); return { id: c.id, tf, len: t.length }; });
    this.avg = this.docs.reduce((a, d) => a + d.len, 0) / (this.docs.length || 1);
    this.df = new Map();
    for (const d of this.docs) for (const w of d.tf.keys()) this.df.set(w, (this.df.get(w) ?? 0) + 1);
  }
  idf(w) { const n = this.df.get(w) ?? 0; return Math.log(1 + (this.docs.length - n + 0.5) / (n + 0.5)); }
  search(query, limit, allowed) {
    const q = [...new Set(tokenize(query))];
    const out = [];
    for (const d of this.docs) {
      if (allowed && !allowed.has(d.id)) continue;
      let s = 0;
      for (const w of q) {
        const f = d.tf.get(w); if (!f) continue;
        s += this.idf(w) * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * d.len / this.avg));
      }
      if (s > 0) out.push({ id: d.id, score: s });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export function vectorSearch(chunks, qv, limit, allowed) {
  const out = [];
  for (const c of chunks) {
    if (allowed && !allowed.has(c.id)) continue;
    const s = cosine(qv, c.vector);
    if (s > 0.05) out.push({ id: c.id, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Graph retriever: seed nodes (ids named in the query, or the documents behind the top lexical/vector hits)
 * are expanded along the knowledge graph, and the chunks of the documents reached are ranked by hop distance.
 */
export function graphSearch(graph, chunksByDoc, seeds, { maxHops = 2, limit = 40, allowed, rels = null } = {}) {
  const dist = new Map();
  const queue = [];
  for (const s of seeds) if (graph.nodes[s]) { dist.set(s, 0); queue.push(s); }
  while (queue.length) {
    const n = queue.shift();
    const d = dist.get(n);
    if (d >= maxHops) continue;
    for (const e of graph.adj[n] ?? []) {
      if (rels && !rels.includes(e.rel)) continue;
      if (!dist.has(e.to)) { dist.set(e.to, d + 1); queue.push(e.to); }
    }
  }
  const out = [];
  for (const [node, d] of dist) {
    const docId = graph.nodes[node]?.docId ?? node;
    for (const cid of chunksByDoc.get(docId) ?? []) {
      if (allowed && !allowed.has(cid)) continue;
      const nodeTitle = graph.nodes[node]?.title;
      out.push({ id: cid, score: 1 / (1 + d), via: node, hops: d, nodeTitle });
    }
  }
  // one chunk id can be reached from several nodes: keep the closest
  const best = new Map();
  for (const r of out) if (!best.has(r.id) || best.get(r.id).score < r.score) best.set(r.id, r);
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Weighted Reciprocal Rank Fusion: score(d) = Σ_i w_i / (k + rank_i(d)). */
export function rrf(lists, { k = 60 } = {}) {
  const fused = new Map();
  for (const { name, weight = 1, results } of lists) {
    results.forEach((r, rank) => {
      const cur = fused.get(r.id) ?? { id: r.id, score: 0, sources: {} };
      cur.score += weight / (k + rank + 1);
      cur.sources[name] = { rank: rank + 1, score: Math.round(r.score * 1000) / 1000, ...(r.via ? { via: r.via, hops: r.hops } : {}) };
      fused.set(r.id, cur);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score);
}
