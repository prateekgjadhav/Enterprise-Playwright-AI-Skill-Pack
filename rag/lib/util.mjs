// Shared helpers for the RAG layer. Node built-ins only, so the engine runs on any Node 18+ install.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const posix = (p) => String(p).split(sep).join('/');
export const readJson = (p, fallback = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
export const ensureDir = (p) => { mkdirSync(p, { recursive: true }); return p; };
export const nowIso = () => new Date().toISOString();
export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
/** A rough token estimate (4 characters per token) used for budgets and AI-Ops cost reporting. */
export const estimateTokens = (s) => Math.ceil(String(s ?? '').length / 4);

export function appendJsonl(path, record) {
  ensureDir(dirname(path));
  appendFileSync(path, JSON.stringify(record) + '\n');
}
export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/** Deterministic UUID-shaped id from any string (vector stores such as Qdrant need UUID or integer ids). */
export function uuidFrom(s) {
  const h = sha256(s);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ---- Tokenising (shared by BM25, the local embedder, the reranker and the planner) ----
const STOP = new Set(('a an and any are as at be by can do does for from has have how i if in into is it its me my of on or our '
  + 'so that the their them then there these this those to up us was we were what when where which who why will with you your '
  + 'should would could not no yes than also just only via per each every all some such').split(' '));
export function stem(w) {
  if (w.length <= 4) return w;
  return w.replace(/(?:ies)$/, 'y').replace(/(?:ing|edly|ed|es|s|ly)$/, '');
}
/** Lower-cased word tokens with identifiers kept whole (PROJ-123, CVE-2024-1234, data-testid). */
export function tokenize(text, { keepStop = false } = {}) {
  const out = [];
  const src = String(text ?? '').toLowerCase();
  for (const m of src.matchAll(/[a-z0-9]+(?:[-_.][a-z0-9]+)*/g)) {
    const raw = m[0];
    if (/^[a-z]+-\d+$|^cve-\d{4}-\d+$/.test(raw)) { out.push(raw); continue; }   // ticket keys and CVEs stay whole
    for (const part of raw.split(/[-_.]/)) {
      if (part.length < 2 || (!keepStop && STOP.has(part))) continue;
      out.push(stem(part));
    }
    if (/[-_.]/.test(raw) && raw.length <= 40) out.push(raw);   // the compound too, for exact matches
  }
  return out;
}
/** camelCase and PascalCase split, so cartPage matches "cart page". */
export const splitCamel = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

// ---- Identifiers the planner and graph use ----
export const TICKET_RE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;
export const CVE_RE = /\bCVE-\d{4}-\d{4,}\b/gi;
export const extractTickets = (s) => [...new Set(String(s ?? '').match(TICKET_RE) ?? [])];

// ---- Minimal glob support (**, *, ?, {a,b}) so we need no dependency ----
export function globToRegExp(glob) {
  let re = '';
  const g = posix(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { re += g[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += g[i + 2] === '/' ? 2 : 1; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const end = g.indexOf('}', i); re += '(?:' + g.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')'; i = end; }
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'playwright-report', 'blob-report', '.agents/rag-index']);
/** Files under root matching any include glob and no exclude glob. A trailing ".sample" is ignored for matching. */
export function findFiles(root, include, exclude = []) {
  const inc = include.map(globToRegExp), exc = exclude.map(globToRegExp);
  const out = [];
  const visit = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      const rel = posix(relative(root, abs));
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || SKIP_DIRS.has(rel)) continue;
        if (e.name.startsWith('.') && !['.github', '.agents'].includes(e.name)) continue;
        visit(abs);
      } else {
        const key = rel.replace(/\.sample$/, '');
        if (inc.some((r) => r.test(key)) && !exc.some((r) => r.test(key))) out.push(rel);
      }
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) visit(root);
  return out.sort();
}

/** Tiny YAML-ish front-matter parser: `key: value`, `key: [a, b]`, and `- item` lists. */
export function parseFrontMatter(text) {
  const src = String(text).replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: src };
  const data = {};
  let lastKey = null;
  for (const line of src.slice(4, end).split('\n')) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && lastKey) { (data[lastKey] = Array.isArray(data[lastKey]) ? data[lastKey] : []).push(unq(item[1])); continue; }
    const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    lastKey = m[1];
    const v = m[2].trim();
    if (v === '') data[lastKey] = [];
    else if (/^\[.*\]$/.test(v)) data[lastKey] = v.slice(1, -1).split(',').map((x) => unq(x.trim())).filter(Boolean);
    else data[lastKey] = unq(v);
  }
  return { data, body: src.slice(end + 4).replace(/^\n/, '') };
}
const unq = (v) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * fetch with a timeout and bounded retries on network errors, 429 and 5xx — every remote call in the RAG layer
 * (embeddings, rerankers, Qdrant) goes through it, so a hung endpoint fails the call instead of stalling ingest.
 */
export async function fetchWithRetry(url, init = {}, { timeoutMs = 30000, retries = 2, backoffMs = 500 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) { last = new Error(`HTTP ${res.status}`); }
      else return res;
    } catch (e) { last = e; if (attempt === retries) break; }
    await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
  }
  throw new Error(`${new URL(url).host}: ${last?.name === 'TimeoutError' ? `no answer within ${timeoutMs} ms` : last?.message ?? 'request failed'}`);
}
