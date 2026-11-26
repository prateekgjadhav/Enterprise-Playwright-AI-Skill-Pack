// Ingestion: collect sources → load → sanitise → redact PII/secrets → scan for prompt injection → ACL →
// provenance and trust → semantic parent-child chunks → embeddings (cached, so re-indexing is incremental)
// → knowledge graph → save (encrypted when configured) → optional vector-store sync.
// Sources are only read. The index is derived data and can always be rebuilt.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findFiles, sha256, nowIso, readJson, globToRegExp, ensureDir } from '../lib/util.mjs';
import { writeFileSync } from 'node:fs';
import { loadFile } from './loaders.mjs';
import { chunkDocument } from '../chunking/chunker.mjs';
import { createEmbedder, embedAll } from '../embeddings/embedder.mjs';
import { buildGraph } from '../graph/graph.mjs';
import { redact, scanInjection, sanitizeInput, trustScore, aclForPath } from '../security/guard.mjs';
import { memoryDocs, readReputation } from '../memory/memory.mjs';
import { saveIndex, loadIndex, qdrantStore, saveCache, loadCache } from '../store/store.mjs';
import { logEvent, timer } from '../telemetry/aiops.mjs';

const gitHead = (root) => {
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** Last commit time per tracked file, from one `git log` pass. A fresh CI checkout resets every mtime to the
 *  clone time, so mtime alone would make every document look new and switch off freshness decay. */
export function gitTimes(root) {
  const r = spawnSync('git', ['-C', root, 'log', '--relative', '--name-only', '--no-renames', '--format=%x01%cI'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = new Map();
  if (r.status !== 0) return out;
  let at = null;
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('\x01')) at = line.slice(1).trim();
    else if (line && at && !out.has(line)) out.set(line, at);   // newest commit first, so the first time seen wins
  }
  return out;
}

export async function ingest(cfg, { log = () => {} } = {}) {
  const t = timer();
  const { root, rag } = cfg;
  const previous = (() => { try { return loadIndex(cfg); } catch { return null; } })();
  const commit = gitHead(root);
  const committed = gitTimes(root);
  const docs = [];
  const errors = [];
  for (const src of rag.sources) {
    for (const rel of findFiles(root, src.include, [...(rag.exclude ?? []), ...(src.exclude ?? [])])) {
      try {
        const raw = readFileSync(join(root, rel), 'utf8');
        const mtime = statSync(join(root, rel)).mtime.toISOString();
        for (const d of loadFile(rel, raw, src)) {
          d.provenance = { path: rel, sha256: sha256(raw), commit, ingestedAt: nowIso(), updatedAt: d.meta?.date ?? committed.get(rel) ?? mtime, source: 'repository' };
          docs.push(d);
        }
      } catch (e) { errors.push({ path: rel, error: e.message }); }
    }
  }
  if (rag.memory.enabled) docs.push(...memoryDocs(cfg));
  t.mark('load');

  // security pass: sanitise, redact, scan, ACL, trust
  const reputation = readReputation(cfg);
  const sec = rag.security;
  let redactions = 0, flagged = 0;
  for (const d of docs) {
    d.text = sanitizeInput(d.text).text;
    if (sec.redactPII) { const r = redact(d.text, { allowDomains: sec.allowDomains }); d.text = r.text; redactions += r.total; d.security = { redactions: r.counts }; }
    if (sec.injectionScan) {
      const inj = scanInjection(d.text);
      d.security = { ...(d.security ?? {}), injection: inj.flagged ? { flagged: true, score: inj.score, categories: inj.categories } : { flagged: false } };
      if (inj.flagged) flagged++;
    }
    d.quarantined = Boolean(sec.quarantineFlagged && d.security?.injection?.flagged);
    d.acl = d.acl ?? aclForPath(d.provenance.path, sec.acl.rules, globToRegExp) ?? ['*'];
    d.trust = trustScore(d, { halfLifeDays: sec.freshnessHalfLifeDays, reputation });
  }
  t.mark('secure');

  const chunks = [];
  for (const d of docs) {
    for (const c of chunkDocument(d, rag.chunking)) chunks.push({ ...c, collection: d.collection, type: d.type, title: d.title, trust: d.trust, quarantined: d.quarantined, acl: c.acl ?? d.acl });
  }
  t.mark('chunk');

  const embedder = createEmbedder(cfg);
  const cache = loadCache(cfg);
  const { vectors, reused } = await embedAll(embedder, chunks.map((c) => c.text), cache, rag.embeddings.batchSize);
  chunks.forEach((c, i) => { c.vector = vectors[i]; });
  // keep only cache entries still in use, so the cache does not grow forever
  const live = new Set(chunks.map((c) => embedder.id + ':' + sha256(c.text).slice(0, 32)));
  ensureDir(join(root, rag.indexDir));
  saveCache(cfg, Object.fromEntries(Object.entries(cache).filter(([k]) => live.has(k))));
  t.mark('embed');

  const skills = readJson(join(root, '.claude/skills-manifest.json'), { skills: [] })?.skills ?? [];
  const graph = rag.graph.enabled ? buildGraph(docs, { skills }) : { nodes: {}, edges: [], adj: {} };
  t.mark('graph');

  const prevDocs = new Map((previous?.docs ?? []).map((d) => [d.id, d.provenance?.sha256]));
  const nowDocs = new Map(docs.map((d) => [d.id, d.provenance.sha256]));
  const diff = {
    added: [...nowDocs.keys()].filter((k) => !prevDocs.has(k)).length,
    changed: [...nowDocs].filter(([k, h]) => prevDocs.has(k) && prevDocs.get(k) !== h).length,
    removed: [...prevDocs.keys()].filter((k) => !nowDocs.has(k)).length,
  };
  const index = { builtAt: nowIso(), commit, embedder: { id: embedder.id, dim: embedder.dim }, docs, chunks, graph: { nodes: graph.nodes, edges: graph.edges } };
  saveIndex(cfg, index);
  if (rag.vectorStore.provider === 'qdrant') await qdrantStore(cfg).sync(chunks.filter((c) => !c.quarantined), embedder.dim, index.builtAt);
  t.mark('save');

  const summary = {
    docs: docs.length, chunks: chunks.length, nodes: Object.keys(graph.nodes).length, edges: graph.edges.length,
    embeddingsReused: reused, redactions, injectionFlagged: flagged, quarantined: docs.filter((d) => d.quarantined).map((d) => d.id),
    byCollection: docs.reduce((a, d) => ({ ...a, [d.collection]: (a[d.collection] ?? 0) + 1 }), {}),
    diff, errors, encrypted: rag.security.encryption.enabled, timings: t.done(),
  };
  logEvent(cfg, 'ingest', { docs: summary.docs, chunks: summary.chunks, edges: summary.edges, redactions, injectionFlagged: flagged, reused, ...diff, ms: summary.timings.totalMs });
  log(summary);
  return summary;
}

/** Health and staleness: is there an index, is it current with the sources, and what does it hold? */
export function status(cfg) {
  let index;
  try { index = loadIndex(cfg); } catch (e) { return { ok: false, error: e.message }; }
  if (!index) return { ok: false, error: 'no index yet: run `node rag/cli.mjs ingest`' };
  const stale = [], missing = [];
  for (const d of index.docs) {
    const p = d.provenance?.path;
    if (!p || p.startsWith(cfg.rag.memory.dir)) continue;
    const abs = join(cfg.root, p);
    if (!existsSync(abs)) { missing.push(p); continue; }
    if (sha256(readFileSync(abs, 'utf8')) !== d.provenance.sha256) stale.push(p);
  }
  const ageH = Math.round((Date.now() - Date.parse(index.builtAt)) / 36e5);
  return {
    ok: !stale.length && !missing.length, builtAt: index.builtAt, ageHours: ageH, commit: index.commit, embedder: index.embedder,
    docs: index.docs.length, chunks: index.chunks.length, nodes: Object.keys(index.graph.nodes).length, edges: index.graph.edges.length,
    quarantined: index.docs.filter((d) => d.quarantined).map((d) => d.id), staleSources: [...new Set(stale)], missingSources: [...new Set(missing)],
    advice: stale.length || missing.length ? 'sources changed since the last build: run `node rag/cli.mjs ingest`' : 'index is current',
  };
}
