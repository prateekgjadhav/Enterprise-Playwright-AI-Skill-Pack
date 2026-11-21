#!/usr/bin/env node
// Scrubs Playwright artifacts before they leave the runner. Fail closed: if anything cannot be parsed the run fails
// and nothing should be uploaded.
//   removes  .auth/ folders and storage-state files
//   opens    ZIP archives (traces, blob reports — nested too) and the base64 ZIP embedded in the HTML report
//   redacts  in every text entry: values the secretProvider fixture registered in $RUNNER_TEMP/qa-redaction-*.json
//            (and QA_CANARY_SECRET), their
//            URL- and base64-encoded forms, authorization/cookie/api-key headers, bearer tokens, JWTs, and the
//            knowledge layer's secret and personal-data rules
//   checks   binary entries for registered values; pixels cannot be redacted, so a binary that contains one fails
// Usage: node scripts/scrub-artifacts.mjs <dir|file> … [--registry <file>]
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { readZip, writeZip, isZip } from './lib/zip.mjs';
import { redact } from '../rag/security/guard.mjs';

const argv = process.argv.slice(2);
const regArg = argv.includes('--registry') ? argv[argv.indexOf('--registry') + 1] : null;
const regDir = process.env.QA_REDACTION_DIR || process.env.RUNNER_TEMP || tmpdir();
const targets = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--registry');

export function loadSecrets(files = regArg ? [regArg] : (existsSync(regDir) ? readdirSync(regDir).filter((f) => /^qa-redaction-.*\.json$/.test(f)).map((f) => join(regDir, f)) : [])) {
  const vals = new Set();
  for (const path of files) if (existsSync(path)) for (const v of JSON.parse(readFileSync(path, 'utf8')).values ?? []) if (typeof v === 'string' && v.length >= 4) vals.add(v);
  if (process.env.QA_CANARY_SECRET) vals.add(process.env.QA_CANARY_SECRET);
  const forms = new Set();
  for (const v of vals) { forms.add(v); forms.add(encodeURIComponent(v)); forms.add(Buffer.from(v).toString('base64')); forms.add(JSON.stringify(v).slice(1, -1)); }
  return [...forms].filter((f) => f.length >= 4).sort((a, b) => b.length - a.length);
}

const HEADER = 'authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-csrf-token|x-xsrf-token|api-key';
const RULES = [
  [new RegExp(`("name"\\s*:\\s*"(?:${HEADER})"\\s*,\\s*"value"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`, 'gi'), '$1[REDACTED:HEADER]$3'],
  [new RegExp(`("(?:${HEADER})"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`, 'gi'), '$1[REDACTED:HEADER]$3'],
  [new RegExp(`^((?:${HEADER})\\s*:\\s*).+$`, 'gim'), '$1[REDACTED:HEADER]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 [REDACTED:TOKEN]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED:JWT]'],
];

export function scrubText(text, secrets, stats) {
  let s = text;
  for (const v of secrets) if (s.includes(v)) { stats.registered += s.split(v).length - 1; s = s.split(v).join('[REDACTED:REGISTERED]'); }
  for (const [re, rep] of RULES) s = s.replace(re, (...m) => { stats.patterns++; return rep.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? ''); });
  const r = redact(s);
  stats.patterns += r.total; return r.text;
}

const isText = (buf) => { const head = buf.subarray(0, 8192); if (head.includes(0)) return false; try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; } };
const DROP = (name) => /(^|\/)\.auth(\/|$)/.test(name) || /storage-?state[\w.-]*\.json$/i.test(name);

export function scrubBuffer(name, buf, secrets, stats, depth = 0) {
  if (depth > 4) throw new Error(`${name}: archives nested deeper than 4 levels`);
  if (isZip(buf)) {
    const entries = readZip(buf).filter((e) => { if (DROP(e.name)) { stats.dropped++; return false; } return true; })
      .map((e) => ({ name: e.name, data: scrubBuffer(`${name}!${e.name}`, e.data, secrets, stats, depth + 1) }));
    stats.archives++;
    return writeZip(entries);
  }
  if (isText(buf)) {
    stats.texts++;
    let t = buf.toString('utf8');
    t = t.replace(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/g, (_, b64) => `data:application/zip;base64,${scrubBuffer(`${name}#embedded`, Buffer.from(b64, 'base64'), secrets, stats, depth + 1).toString('base64')}`);
    return Buffer.from(scrubText(t, secrets, stats), 'utf8');
  }
  stats.binaries++;
  for (const v of secrets) if (buf.includes(Buffer.from(v))) throw new Error(`${name}: a registered secret is inside a binary file that cannot be redacted`);
  return buf;
}

export function scrubPath(p, secrets, stats) {
  const st = statSync(p);
  if (st.isDirectory()) {
    if (basename(p) === '.auth') { rmSync(p, { recursive: true, force: true }); stats.dropped++; return; }
    for (const n of readdirSync(p)) scrubPath(join(p, n), secrets, stats);
    return;
  }
  if (DROP(p)) { rmSync(p, { force: true }); stats.dropped++; return; }
  stats.files++;
  const before = readFileSync(p);
  const after = scrubBuffer(p, before, secrets, stats);
  if (!after.equals(before)) writeFileSync(p, after);
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (!targets.length) { console.error('usage: scrub-artifacts.mjs <dir|file> …'); process.exit(1); }
  const stats = { files: 0, archives: 0, texts: 0, binaries: 0, registered: 0, patterns: 0, dropped: 0 };
  try {
    const secrets = loadSecrets();
    for (const t of targets) if (existsSync(t)) scrubPath(t, secrets, stats);
  } catch (e) { console.error(`scrub-artifacts: FAILED (do not upload): ${e.message}`); process.exit(1); }
  console.log(`scrub-artifacts: ${stats.files} files, ${stats.archives} archives, ${stats.texts} text entries scrubbed; ${stats.registered} registered values and ${stats.patterns} pattern matches redacted; ${stats.dropped} auth-state items removed; ${stats.binaries} binary entries checked`);
}
