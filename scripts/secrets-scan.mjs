#!/usr/bin/env node
// Finds secrets and personal data in files without printing them: file, line and rule only. Uses the knowledge
// layer's redaction rules plus bearer tokens, JWTs and private-key blocks. The pack's own self-tests, which contain
// deliberately fake secrets, are skipped, and so is a line marked `qa-scan: not-a-secret` (reviewed in the PR). Usage: node scripts/secrets-scan.mjs [path …]  (default: the repository)
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { redact } from '../rag/security/guard.mjs';
import { walk } from './lib/files.mjs';

const SKIP = [/^rag\/test\//, /^scripts\/test\//, /^rag\/fixtures\//, /^scripts\/self-healing\/heal\.test\.mjs$/, /^LICENSE$/, /\.(png|jpe?g|gif|webp|zip|woff2?|ico|pdf)$/i];
const EXTRA = [['TOKEN', /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/], ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/], ['PRIVATE_KEY', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]];

export function scanFile(rel, text) {
  const out = [];
  for (const [i, line] of text.split('\n').entries()) {
    if (line.includes('qa-scan: not-a-secret')) continue;   // reviewed false positive, visible in code review
    const r = redact(line, { allowDomains: ['example.com', 'example.org', 'example.net', 'example.test', 'test'] });
    for (const [rule, n] of Object.entries(r.counts ?? {})) if (n) out.push({ file: rel, line: i + 1, rule });
    for (const [rule, re] of EXTRA) if (re.test(line)) out.push({ file: rel, line: i + 1, rule });
  }
  return out;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const files = [];
  const add = (p) => { if (!existsSync(p)) return; if (statSync(p).isDirectory()) { for (const n of readdirSync(p)) add(join(p, n)); } else files.push(p); };
  if (args.length) args.forEach(add); else files.push(...walk(root));
  const findings = files.filter((f) => !SKIP.some((r) => r.test(f.replace(/\\/g, '/')))).flatMap((f) => {
    const buf = readFileSync(f); if (buf.subarray(0, 8000).includes(0)) return [];
    return scanFile(f, buf.toString('utf8'));
  });
  for (const f of findings) console.log(`${f.rule} ${f.file}:${f.line}`);
  console.log(`secrets-scan: ${files.length} file(s), ${findings.length} finding(s)`);
  process.exit(findings.length ? 1 : 0);
}
