// Memory architecture
//   session     the current conversation: what was already retrieved, so context is not sent twice (in-process)
//   project     .agents/memory/project/{patterns,defects,architectural-decisions}.jsonl — this repository's intelligence
//   team        .agents/memory/team/{best-practices,migration-patterns,security-findings}.jsonl — shared across repos
// Writes are evidence-backed, redacted, injection-scanned and gated by gates.knowledgeWrite: with "ask" they
// wait in .agents/memory/pending/ (excluded from retrieval) until a person runs
//   node rag/cli.mjs memory approve <id> --by <identity> --attestation governance/approvals/<id>.sigstore.json
// The attestation is the signed approval from approve.yml; its sha256 is recorded on the promoted entry and CI
// verifies the signature (scripts/verify-attestation.mjs). Approval without an attestation is refused.
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { appendJsonl, readJsonl, ensureDir, sha256, nowIso, readJson } from '../lib/util.mjs';
import { redact, scanInjection } from '../security/guard.mjs';

export const KINDS = {
  project: ['patterns', 'defects', 'architectural-decisions'],
  team: ['best-practices', 'migration-patterns', 'security-findings'],
};

export class SessionMemory {
  constructor() { this.sessions = new Map(); }
  get(id = 'default') { if (!this.sessions.has(id)) this.sessions.set(id, { queries: [], served: new Set() }); return this.sessions.get(id); }
  remember(id, query, chunkIds) { const s = this.get(id); s.queries.push({ query, at: nowIso() }); chunkIds.forEach((c) => s.served.add(c)); if (s.queries.length > 50) s.queries.shift(); }
  alreadyServed(id, chunkId) { return this.get(id).served.has(chunkId); }
}

export function listMemory(cfg, { scope = null, kind = null } = {}) {
  const out = [];
  for (const sc of scope ? [scope] : Object.keys(KINDS)) {
    for (const k of kind ? [kind] : KINDS[sc]) {
      for (const e of readJsonl(join(cfg.paths.memory, sc, `${k}.jsonl`))) out.push({ ...e, scope: sc, kind: k });
    }
  }
  const stale = cfg.rag.memory.staleAfterDays * 86400000;
  return out.map((e) => ({ ...e, stale: Date.now() - Date.parse(e.createdAt ?? 0) > stale }));
}

/** Memory entries as documents, so retrieval treats them like any other knowledge (with lower base trust). */
export function memoryDocs(cfg) {
  return listMemory(cfg).map((e) => ({
    id: e.id, type: `memory-${e.scope}`, collection: `memory-${e.scope}`, format: 'markdown', title: e.title,
    text: `${e.title}\n\n${e.content}\n\nEvidence: ${(e.evidence ?? []).join(', ')}`,
    meta: { kind: e.kind, tags: e.tags ?? [], status: 'approved', stale: e.stale }, acl: e.acl ?? null,
    links: (e.evidence ?? []).map((t) => ({ rel: 'evidenced-by', target: t })),
    provenance: { path: `${cfg.rag.memory.dir}/${e.scope}/${e.kind}.jsonl`, sha256: sha256(e.content), ingestedAt: nowIso(), updatedAt: e.createdAt },
  }));
}

export function proposeMemory(cfg, { scope, kind, title, content, evidence = [], tags = [], author = 'agent', acl = null }) {
  if (!KINDS[scope]) return { ok: false, error: `scope must be one of ${Object.keys(KINDS).join(', ')}` };
  if (!KINDS[scope].includes(kind)) return { ok: false, error: `kind for ${scope} must be one of ${KINDS[scope].join(', ')}` };
  if (!title || !content || String(content).length < 20) return { ok: false, error: 'title and a content of at least 20 characters are required' };
  if (!evidence.length) return { ok: false, error: 'memory must cite evidence (document ids, run ids or file paths): verified outcomes only' };
  const inj = scanInjection(`${title}\n${content}`);
  if (inj.flagged) return { ok: false, error: `rejected: instruction-like content (${inj.categories.join(', ')})` };
  const red = redact(content, { allowDomains: cfg.rag.security.allowDomains });
  const entry = { id: `mem-${sha256(scope + kind + title + red.text).slice(0, 12)}`, title: String(title).slice(0, 160), content: red.text, evidence, tags, author, acl, createdAt: nowIso(), redactions: red.total };
  const existing = listMemory(cfg, { scope, kind }).find((e) => e.id === entry.id);
  if (existing) return { ok: true, status: 'duplicate', id: entry.id };
  // Always staged: there is no direct-write mode. Promotion needs a signed approval (approveMemory).
  const dir = ensureDir(join(cfg.paths.memory, 'pending'));
  writeFileSync(join(dir, `${entry.id}.json`), JSON.stringify({ scope, kind, entry }, null, 2));
  return { ok: true, status: 'pending-approval', id: entry.id, redactions: red.total, approve: `node rag/cli.mjs memory approve ${entry.id}` };
}

export function listPending(cfg) {
  const dir = join(cfg.paths.memory, 'pending');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
const MEM_ID = /^mem-[0-9a-f]{12}$/;
export function approveMemory(cfg, id, approver, attestation = null) {
  if (!MEM_ID.test(String(id))) return { ok: false, error: `not a memory id: ${id}` };
  const p = join(cfg.paths.memory, 'pending', `${id}.json`);
  if (!existsSync(p)) return { ok: false, error: `no pending memory ${id}` };
  if (!approver) return { ok: false, error: 'approval needs a named approver (--by <identity>)' };
  if (!attestation) return { ok: false, error: 'approval needs the signed attestation from approve.yml (--attestation <bundle>)' };
  const bundle = join(cfg.root, attestation);
  if (!bundle.startsWith(join(cfg.root, 'governance', 'approvals'))) return { ok: false, error: 'the attestation must live under governance/approvals/' };
  if (!existsSync(bundle)) return { ok: false, error: `no attestation at ${attestation}` };
  const { scope, kind, entry } = JSON.parse(readFileSync(p, 'utf8'));
  if (entry.author && entry.author === approver) return { ok: false, error: 'self-approval is refused: the approver must differ from the author' };
  appendJsonl(join(cfg.paths.memory, scope, `${kind}.jsonl`), { ...entry, approvedBy: approver, approvedAt: nowIso(), approvalBundle: attestation, approvalBundleDigest: sha256(readFileSync(bundle)) });
  rmSync(p);
  return { ok: true, id, scope, kind };
}
export function rejectMemory(cfg, id) {
  if (!MEM_ID.test(String(id))) return { ok: false, error: `not a memory id: ${id}` };
  const p = join(cfg.paths.memory, 'pending', `${id}.json`);
  if (!existsSync(p)) return { ok: false, error: `no pending memory ${id}` };
  rmSync(p);
  return { ok: true, id };
}

// Document reputation: retrieval feedback nudges a document's trust score up or down.
const repPath = (cfg) => join(cfg.paths.memory, 'reputation.json');
export const readReputation = (cfg) => readJson(repPath(cfg), {}) ?? {};
export function recordFeedback(cfg, docId, helpful) {
  const rep = readReputation(cfg);
  const r = (rep[docId] ??= { helpful: 0, unhelpful: 0 });
  if (helpful) r.helpful++; else r.unhelpful++;
  ensureDir(cfg.paths.memory);
  writeFileSync(repPath(cfg), JSON.stringify(rep, null, 2));
  return { docId, ...r };
}
