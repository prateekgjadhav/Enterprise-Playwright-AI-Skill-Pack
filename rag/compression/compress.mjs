// Context compression keeps the context pack within a token budget without losing what matters:
//   1. near-duplicate removal (word-shingle Jaccard) — the same RCA pasted in three places is sent once
//   2. extractive filtering — keep the sentences/lines that match the query, plus identifiers, headings,
//      acceptance criteria, assertions and step titles; drop the rest
//   3. budget packing — highest-ranked first until the budget is spent
// Every kept item still carries its citation id, so compression never breaks traceability.
import { tokenize, estimateTokens } from '../lib/util.mjs';

const shingles = (text, n = 5) => {
  const w = tokenize(text, { keepStop: true });
  const s = new Set();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '));
  if (!s.size && w.length) s.add(w.join(' '));
  return s;
};
export const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / ((a.size + b.size - i) || 1); };

const ALWAYS = /\b(AC\d+|[A-Z][A-Z0-9]+-\d+|CVE-\d{4}-\d+)\b|^#|test\.step\(|expect\(|\btest\(|Root cause|Resolution|Signature|Given|When|Then|must|should|error/i;

export function extractive(text, query, keepRatio = 0.6) {
  const q = new Set(tokenize(query));
  const units = String(text).split(/\n|(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trimEnd()).filter((s) => s.trim());
  if (units.length <= 3) return text;
  const scored = units.map((u, i) => {
    const t = tokenize(u);
    const overlap = t.filter((x) => q.has(x)).length / (t.length || 1);
    return { i, u, s: overlap + (ALWAYS.test(u) ? 0.5 : 0) + (i === 0 ? 0.6 : 0) };
  });
  const keep = Math.max(3, Math.ceil(units.length * keepRatio));
  const chosen = new Set([...scored].sort((a, b) => b.s - a.s).slice(0, keep).map((x) => x.i));
  let out = '', gap = false;
  for (const x of scored) {
    if (chosen.has(x.i)) { out += (gap ? '…\n' : '') + x.u + '\n'; gap = false; } else gap = true;
  }
  return out.trim();
}

/** items: ranked [{ id, text, ... }]. Returns { items, dropped, tokensIn, tokensOut, ratio }. */
export function compress(items, query, { budgetTokens = 2400, sentenceKeepRatio = 0.6, dedupeThreshold = 0.8, enabled = true } = {}) {
  const tokensIn = items.reduce((a, x) => a + estimateTokens(x.text), 0);
  if (!enabled) return { items, dropped: [], tokensIn, tokensOut: tokensIn, ratio: 1 };
  const kept = [], dropped = [], sigs = [];
  let used = 0;
  for (const it of items) {
    const sig = shingles(it.text);
    const dup = sigs.findIndex((s) => jaccard(s, sig) >= dedupeThreshold);
    if (dup >= 0) { dropped.push({ id: it.id, reason: `near-duplicate of ${kept[dup].id}` }); continue; }
    let text = extractive(it.text, query, sentenceKeepRatio);
    let tok = estimateTokens(text);
    if (used + tok > budgetTokens) {
      const room = budgetTokens - used;
      if (room < 60) { dropped.push({ id: it.id, reason: 'token budget' }); continue; }
      text = text.slice(0, room * 4) + ' …'; tok = estimateTokens(text);
    }
    used += tok; sigs.push(sig);
    kept.push({ ...it, text, compressed: text.length < it.text.length });
  }
  return { items: kept, dropped, tokensIn, tokensOut: used, ratio: tokensIn ? Math.round((used / tokensIn) * 100) / 100 : 1 };
}
