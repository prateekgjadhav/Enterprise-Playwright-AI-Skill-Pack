// RAG security controls: input sanitiser, PII and secret redaction, prompt-injection firewall, trust scoring,
// provenance, document- and chunk-level ACLs, and an output validator. Defensive only: these detect and
// neutralise; they never execute retrieved content.
import { clamp } from '../lib/util.mjs';

// ---------- Input sanitiser ----------
const HIDDEN = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD]/g;            // zero-width and soft hyphen
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;                           // bidirectional overrides
const TAGS = /[\u{E0000}-\u{E007F}]/gu;                                 // Unicode tag characters (invisible text)
export function sanitizeInput(text) {
  const s = String(text ?? '');
  const hidden = (s.match(HIDDEN)?.length ?? 0) + (s.match(BIDI)?.length ?? 0) + (s.match(TAGS)?.length ?? 0);
  return { text: s.replace(HIDDEN, '').replace(BIDI, '').replace(TAGS, '').normalize('NFKC'), hiddenChars: hidden };
}

// ---------- PII and secret redaction ----------
const luhn = (digits) => {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) { let n = +digits[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
};
const SECRET_PATTERNS = [
  ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ['AWS_KEY', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['GITHUB_TOKEN', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['SLACK_TOKEN', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ['API_KEY', /\b(?:sk|pk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9]{20,}\b/g],
  ['BEARER', /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g],
  // quoted literals ("password": "hunter22") and env-style assignments (API_KEY=abc123) — not code such as `password: string` (qa-scan: not-a-secret)
  ['PASSWORD', /\b(pass(?:word|wd)?|secret|api[-_]?key|token)\b(["']?\s*[:=]\s*)(["'])[^"'\s]{4,}\3/gi],
  ['PASSWORD', /\b([A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|API_KEY|TOKEN))(=)()[^\s"']{4,}/g],
  // unquoted assignments in prose, logs and config (password = hunter22) — never a reference such as process.env.X (qa-scan: not-a-secret)
  ['PASSWORD', /\b(pass(?:word|wd)?|secret|api[-_]?key|token)\b(\s*=\s*)()(?!["'`]|process\.|env\.|\$\{|<|\(|await\b|new\b|this\.|config\.|settings\.)[^\s"'`,;)]{4,}/gi],
];
// user:password@ in any URI (postgres://, redis://, https://) — the user part stays, the password goes
const URI_CREDENTIAL = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s@/]+)@/gi;
// US social security numbers, excluding the ranges never issued (000, 666, 9xx, 00 group, 0000 serial)
const SSN = /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
export function redact(text, { allowDomains = [] } = {}) {
  let s = String(text ?? '');
  const counts = {};
  const hit = (k) => { counts[k] = (counts[k] ?? 0) + 1; };
  s = s.replace(URI_CREDENTIAL, (m, scheme, user) => { hit('URI_CREDENTIAL'); return `${scheme}${user}:[REDACTED:SECRET]@`; });
  for (const [kind, re] of SECRET_PATTERNS) {
    s = s.replace(re, (...m) => { hit(kind); return kind === 'PASSWORD' ? `${m[1]}${m[2]}[REDACTED:SECRET]` : `[REDACTED:${kind}]`; });
  }
  s = s.replace(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g, (m, domain) => {
    const d = domain.toLowerCase();
    if (allowDomains.some((a) => d === a || d.endsWith('.' + a))) return m;
    hit('EMAIL'); return '[REDACTED:EMAIL]';
  });
  s = s.replace(SSN, () => { hit('SSN'); return '[REDACTED:SSN]'; });
  s = s.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => { const d = m.replace(/\D/g, ''); if (d.length >= 13 && d.length <= 19 && luhn(d)) { hit('CARD'); return '[REDACTED:CARD]'; } return m; });
  s = s.replace(/(?<![\w-])\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3,4}[ .-]?\d{3,4}(?![\w-])/g, (m) => { if (m.replace(/\D/g, '').length >= 10) { hit('PHONE'); return '[REDACTED:PHONE]'; } return m; });
  s = s.replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b/g, () => { hit('IBAN'); return '[REDACTED:IBAN]'; });
  return { text: s, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

// ---------- Prompt-injection tripwire ----------
// A keyword tripwire, not a boundary: it catches common and lightly disguised injections and quarantines them,
// but a determined author can phrase around it. What keeps the agent safe is that retrieved text is wrapped as
// untrusted data and that state-changing tools need a person's approval; this scan only adds a warning.
// Its detection rate on rag/test/fixtures/injection-corpus.json is measured by the self-tests.
const INJECTION_RULES = [
  ['override', 3, /\b(ignore|disregard|forget|override)\b.{0,30}\b(all |any |the )?(previous|prior|above|earlier|system|original)\b.{0,20}\b(instructions?|prompts?|rules|context|guidelines)\b/i],
  ['override', 3, /\b(new|updated|real) (system )?instructions?\s*:/i],
  ['persona', 2, /\byou are now\b|\bact as (an? )?(admin|administrator|root|developer mode|dan|jailbroken)\b|\bdeveloper mode\b/i],
  ['exfiltrate-prompt', 3, /\b(reveal|print|show|repeat|output|leak)\b.{0,25}\b(system prompt|hidden instructions|your instructions|secrets?|credentials|api keys?)\b/i],
  ['role-tag', 3, /<\/?\s*(system|assistant|developer)\s*>|^\s*(system|assistant)\s*:/im],
  ['turn-marker', 2, /^\s*(human|assistant)\s*:/im],
  ['tool-imitation', 3, /<\s*(function_calls|invoke|tool_use|tool_call|antml)[\s>:]/i],
  ['exfiltrate-data', 3, /\b(send|post|upload|exfiltrate|forward|transmit)\b.{0,60}\bhttps?:\/\//i],
  ['markdown-beacon', 2, /!\[[^\]]*\]\(https?:\/\/[^)]*[?&][^)]*=/i],
  ['shell', 2, /\bcurl\b[^\n|]{0,120}\|\s*(ba)?sh\b|\brm\s+-rf\s+\/|\bchmod\s+\+x\b.{0,40}&&/i],
  ['approval-bypass', 3, /\b(without|skip|bypass|disable)\b.{0,20}\b(approval|confirmation|the gate|review|hooks?|verify)\b/i],
  ['encoded-blob', 1, /[A-Za-z0-9+/]{200,}={0,2}/],
  // paraphrased overrides and hand-offs of the agent's task
  ['override', 3, /\b(pay no attention to|stop following|no longer follow|do not follow|don't follow|set aside)\b.{0,40}\b(previous|prior|above|earlier|original|system|existing)\b/i],
  ['task-hijack', 2, /\byour (real|actual|true|new) (task|job|goal|instructions?|purpose)\b|\bfrom (now|here) on,? (you|your)\b/i],
  ['addressed-to-agent', 2, /\b(note|message|instructions?|attention)\s+(to|for)\s+(the\s+)?(ai|assistant|agent|llm|model|claude|chatbot|copilot)\b/i],
  ['claimed-approval', 2, /\b(pre-?approved|already (been )?approved|has (been )?approved this|authori[sz]ed you to|you are (now )?authori[sz]ed)\b/i],
  ['exfiltrate-secret', 2, /\b(email|send|post|upload|paste|share|forward|leak)\b.{0,40}(\.env\b|\benv file\b|\bsecrets?\b|\bcredentials\b|\bapi keys?\b|\bpasswords?\b|\bprivate keys?\b)/i],
  ['obfuscated-host', 2, /\b[a-z0-9-]+\s*(\(dot\)|\[dot\]|\sdot\s)\s*(com|net|org|io|ru|xyz)\b/i],
  // the same override in other common languages (French, Spanish, Portuguese, Italian, German, Dutch)
  ['override', 3, /\bignore[zr]?\s+(toutes\s+)?(les\s+)?instructions\s+(précédentes|antérieures)\b|\bignora(r)?\s+(todas\s+)?(las\s+|as\s+|le\s+)?(instrucciones|instruções|istruzioni)\s+(anteriores|precedenti)\b|\bignorier(e|en)?\s+(alle\s+)?(vorherigen|bisherigen|obigen)\s+(anweisungen|instruktionen)\b|\bnegeer\s+(alle\s+)?(vorige|eerdere)\s+instructies\b/i],
];
// letters spaced out to dodge keyword rules (s-e-n-d, i g n o r e) are re-joined before scanning
const SPACED = /\b(?:[a-z][-._ ]){3,}[a-z]\b/gi;
const despace = (s) => s.replace(SPACED, (m) => m.replace(/[-._ ]/g, ''));
/** Score text for prompt-injection signals. Returns { flagged, score, categories, sanitized }. */
export function scanInjection(text) {
  const { text: clean, hiddenChars } = sanitizeInput(text);
  const categories = new Set();
  let score = 0;
  const joined = despace(clean);
  if (joined !== clean) { categories.add('spaced-letters'); score += 1; }
  const seen = new Set();
  for (const [cat, weight, re] of INJECTION_RULES) {
    if (re.test(clean) || re.test(joined)) { categories.add(cat); if (!seen.has(cat)) score += weight; seen.add(cat); }
  }
  if (hiddenChars > 0) { categories.add('hidden-characters'); score += hiddenChars > 3 ? 3 : 1; }
  return { flagged: score >= 3, score, categories: [...categories], sanitized: clean };
}

/** Neutralise a retrieved chunk before it reaches a model: the content is data, never instructions. */
export function wrapUntrusted(chunkId, text, { flagged = false, trust = null } = {}) {
  const t = String(text).replace(/<\/?retrieved_context[^>]*>/gi, '');
  const head = `<retrieved_context id="${chunkId}"${trust !== null ? ` trust="${trust}"` : ''}${flagged ? ' flagged="prompt-injection"' : ''}>`;
  return `${head}\n${t}\n</retrieved_context>`;
}

// ---------- Trust, provenance and reputation ----------
const SOURCE_TRUST = {
  test: 0.9, page: 0.9, module: 0.9, pipeline: 0.85, requirement: 0.85, 'test-plan': 0.8, 'test-case': 0.8,
  rca: 0.85, decision: 0.85, pattern: 0.8, execution: 0.9, defect: 0.75, finding: 0.8,
  'memory-project': 0.75, 'memory-team': 0.75, doc: 0.6, external: 0.5,
};
export function trustScore(doc, { halfLifeDays = 365, reputation = {}, now = Date.now() } = {}) {
  const base = SOURCE_TRUST[doc.type] ?? 0.6;
  const updated = Date.parse(doc.provenance?.updatedAt ?? doc.provenance?.ingestedAt ?? '') || now;
  const ageDays = Math.max(0, (now - updated) / 86400000);
  const freshness = 0.5 ** (ageDays / Math.max(1, halfLifeDays));
  let t = base * (0.7 + 0.3 * freshness);
  const status = String(doc.meta?.status ?? '').toLowerCase();
  if (['verified', 'approved', 'accepted', 'done', 'resolved'].includes(status)) t += 0.05;
  if (['draft', 'unverified', 'proposed'].includes(status)) t -= 0.1;
  const rep = reputation[doc.id];
  if (rep && rep.helpful + rep.unhelpful > 0) t += 0.1 * ((rep.helpful - rep.unhelpful) / (rep.helpful + rep.unhelpful));
  if (doc.security?.injection?.flagged) t = Math.min(t, 0.2);
  return Math.round(clamp(t) * 100) / 100;
}

// ---------- Access control ----------
/** Principals for this caller: the env var (comma list) wins over the configured defaults. */
export function principals(cfg) {
  const env = process.env[cfg.rag.security.acl.principalsEnv];
  const list = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : cfg.rag.security.acl.defaultPrincipals;
  return new Set(list);
}
/** A document or chunk is visible when its ACL is open ("*") or shares a principal with the caller. */
export function aclAllows(acl, who) {
  if (!acl || !acl.length || acl.includes('*')) return true;
  if (who.has('*') && who.size === 1) return false;          // an anonymous caller sees only open content
  return acl.some((p) => who.has(p));
}
/** ACL for a path from the configured rules ([{ match: "glob", allow: ["role:security"] }]). */
export function aclForPath(path, rules, globToRegExp) {
  for (const r of rules ?? []) if (globToRegExp(r.match).test(path)) return r.allow;
  return null;
}

// ---------- Output validator ----------
/** Check text produced from retrieved context: leaked secrets/PII, echoed injections, citations of unknown ids, unsafe hosts. */
export function validateOutput(text, { contextIds = [], protectedHosts = [], allowDomains = [] } = {}) {
  const issues = [];
  const red = redact(text, { allowDomains });
  for (const [k, n] of Object.entries(red.counts)) issues.push({ severity: 'block', rule: 'leak', detail: `${n} ${k} value(s) in the output` });
  const inj = scanInjection(text);
  if (inj.flagged) issues.push({ severity: 'warn', rule: 'injection-echo', detail: `instruction-like content: ${inj.categories.join(', ')}` });
  if (contextIds.length) {
    const known = new Set(contextIds);
    for (const m of String(text).matchAll(/\[(?:ctx|src|cite):([^\]\s]+)\]/g)) if (!known.has(m[1])) issues.push({ severity: 'block', rule: 'unknown-citation', detail: `cites ${m[1]}, which was not in the retrieved context` });
  }
  for (const host of protectedHosts) if (host && String(text).includes(host)) issues.push({ severity: 'block', rule: 'protected-host', detail: `targets protected host ${host}` });
  return { ok: !issues.some((i) => i.severity === 'block'), issues };
}
