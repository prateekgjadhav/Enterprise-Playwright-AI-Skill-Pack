// The index store. The local store keeps documents, chunks, vectors and the graph in one file under
// rag.indexDir; with rag.security.encryption.enabled it is encrypted at rest with AES-256-GCM, using a key
// from the environment (never from config). A Qdrant adapter mirrors vectors to a shared vector database.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { dirname } from 'node:path';
import { ensureDir, uuidFrom, fetchWithRetry } from '../lib/util.mjs';

function keyFor(cfg) {
  const name = cfg.rag.security.encryption.keyEnv;
  const raw = process.env[name];
  if (!raw) throw new Error(`index encryption is enabled but ${name} is not set (take it from your secret store)`);
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const b = Buffer.from(raw, 'base64');
  if (b.length === 32) return b;
  return scryptSync(raw, 'qa-rag-index', 32);               // a passphrase
}
export { keyFor };
export function encrypt(buf, key) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from('QARAGE'), iv, c.getAuthTag(), body]);
}
export function decrypt(buf, key) {
  if (buf.subarray(0, 6).toString() !== 'QARAGE') throw new Error('not an encrypted index file');
  const iv = buf.subarray(6, 18), tag = buf.subarray(18, 34);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(34)), d.final()]);
}

export function saveIndex(cfg, index) {
  const json = Buffer.from(JSON.stringify(index));
  ensureDir(dirname(cfg.paths.index));
  if (cfg.rag.security.encryption.enabled) {
    writeFileSync(cfg.paths.indexEnc, encrypt(json, keyFor(cfg)));
    if (existsSync(cfg.paths.index)) rmSync(cfg.paths.index);       // never leave a plaintext copy behind
  } else {
    writeFileSync(cfg.paths.index, json);
  }
}
export function loadIndex(cfg) {
  if (existsSync(cfg.paths.indexEnc)) return JSON.parse(decrypt(readFileSync(cfg.paths.indexEnc), keyFor(cfg)).toString());
  if (existsSync(cfg.paths.index)) {
    if (cfg.rag.security.encryption.enabled) throw new Error('encryption is enabled but the index is plaintext: re-run ingest');
    return JSON.parse(readFileSync(cfg.paths.index, 'utf8'));
  }
  return null;
}

/** The embedding cache follows the index: encrypted at rest whenever the index is (vectors can leak content). */
export function saveCache(cfg, cache) {
  ensureDir(dirname(cfg.paths.embedCache));
  const json = Buffer.from(JSON.stringify(cache));
  if (cfg.rag.security.encryption.enabled) {
    writeFileSync(cfg.paths.embedCache + '.enc', encrypt(json, keyFor(cfg)));
    if (existsSync(cfg.paths.embedCache)) rmSync(cfg.paths.embedCache);
  } else {
    writeFileSync(cfg.paths.embedCache, json);
  }
}
export function loadCache(cfg) {
  try {
    if (cfg.rag.security.encryption.enabled) {
      return existsSync(cfg.paths.embedCache + '.enc') ? JSON.parse(decrypt(readFileSync(cfg.paths.embedCache + '.enc'), keyFor(cfg)).toString()) : {};
    }
    return existsSync(cfg.paths.embedCache) ? JSON.parse(readFileSync(cfg.paths.embedCache, 'utf8')) : {};
  } catch { return {}; }                                            // a cache is disposable: rebuild on any error
}

// ---------- Qdrant (optional shared vector store; BM25 and the graph stay local) ----------
export function qdrantStore(cfg) {
  const vs = cfg.rag.vectorStore;
  const base = String(vs.url).replace(/\/$/, '');
  const headers = { 'content-type': 'application/json', ...(vs.apiKeyEnv && process.env[vs.apiKeyEnv] ? { 'api-key': process.env[vs.apiKeyEnv] } : {}) };
  const call = async (method, path, body) => {
    const res = await fetchWithRetry(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok && res.status !== 404) throw new Error(`Qdrant ${method} ${path}: HTTP ${res.status}`);
    return res.status === 404 ? null : res.json();
  };
  return {
    /** Upsert every chunk tagged with this build, then delete points from earlier builds (removed or renamed chunks). */
    async sync(chunks, dim, build = String(Date.now())) {
      const exists = await call('GET', `/collections/${vs.collection}`);
      if (!exists) await call('PUT', `/collections/${vs.collection}`, { vectors: { size: dim, distance: 'Cosine' } });
      for (let i = 0; i < chunks.length; i += 128) {
        const points = chunks.slice(i, i + 128).map((c) => ({ id: uuidFrom(c.id), vector: c.vector, payload: { chunkId: c.id, docId: c.docId, collection: c.collection, acl: c.acl ?? ['*'], build } }));
        await call('PUT', `/collections/${vs.collection}/points?wait=true`, { points });
      }
      await call('POST', `/collections/${vs.collection}/points/delete?wait=true`, { filter: { must_not: [{ key: 'build', match: { value: build } }] } });
    },
    /** ACL is enforced in the vector database too (filter), not only after the fact. */
    async search(vector, limit, principals) {
      const filter = { should: [{ key: 'acl', match: { any: ['*', ...principals] } }] };
      const j = await call('POST', `/collections/${vs.collection}/points/search`, { vector, limit, filter, with_payload: true });
      return (j?.result ?? []).map((r) => ({ id: r.payload.chunkId, score: r.score }));
    },
  };
}
