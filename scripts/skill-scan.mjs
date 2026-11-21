#!/usr/bin/env node
// Static scan of the pack's natural-language instructions: skills, AGENTS.md, CLAUDE.md, prompts, agent definitions
// and commands. Fails on any high or critical finding. It never executes or follows what it scans.
// Usage: node scripts/skill-scan.mjs [file …]   (default: every instruction file)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { scanInjection } from '../rag/security/guard.mjs';

const RULES = [
  ['critical', 'hidden-characters', /[\u200B-\u200F\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/u],
  ['critical', 'pipe-to-shell', /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(ba|z|da)?sh\b|\biex\s*\(/i],
  ['high', 'encoded-blob', /[A-Za-z0-9+/]{160,}={0,2}/],
  ['high', 'remote-instructions', /\b(fetch|download|load|read|follow)\b[^\n]{0,40}\binstructions?\b[^\n]{0,40}https?:\/\//i],
  ['high', 'credential-read', /\b(cat|type|less|more|head|tail|Get-Content|base64)\s+[^\n]*(\.env\b|id_rsa|\.ssh\/|\.aws\/|\.npmrc|\.netrc|\.auth\/)/i],
  ['high', 'insecure-url', /\bhttp:\/\/(?!localhost|127\.0\.0\.1)[^\s)]+/i],
  ['high', 'unscoped-tools', /^allowed-tools:.*(\bBash(?!\()|\bBash\(\*\)|\b(Edit|Write)(?!\())/m],
  ['high', 'network-tools', /^allowed-tools:.*\b(WebFetch|WebSearch)\b/m],
  ['high', 'version-field', /^(version|metadata|owner):/m],
];

export function scanText(file, text) {
  const findings = [];
  const lines = text.split('\n');
  for (const [sev, rule, re] of RULES) {
    const m = re.exec(text);
    if (m) findings.push({ file, rule, severity: sev, line: text.slice(0, m.index).split('\n').length });
  }
  for (const [i, line] of lines.entries()) {
    const r = scanInjection(line);
    if (r.flagged) findings.push({ file, rule: `injection:${r.categories.join('+')}`, severity: 'high', line: i + 1 });
  }
  return findings;
}

function defaultFiles(root) {
  const out = ['AGENTS.md', 'CLAUDE.md'].filter((f) => existsSync(join(root, f)));
  const add = (dir, pred) => { if (!existsSync(join(root, dir))) return; for (const f of readdirSync(join(root, dir))) { const p = join(dir, f); if (statSync(join(root, p)).isDirectory()) add(p, pred); else if (pred(p)) out.push(p); } };
  add('.agents/skills', (p) => p.endsWith('.md'));
  add('prompts', (p) => p.endsWith('.md'));
  add('.claude/agents', (p) => p.endsWith('.md'));
  add('.claude/commands', (p) => p.endsWith('.md'));
  return out;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = process.cwd();
  const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles(root);
  const findings = files.flatMap((f) => scanText(f, readFileSync(join(root, f), 'utf8')));
  const blocking = findings.filter((f) => ['high', 'critical'].includes(f.severity));
  for (const f of findings) console.log(`${f.severity.toUpperCase()} ${f.rule} ${f.file}:${f.line}`);
  console.log(`skill-scan: ${files.length} file(s), ${findings.length} finding(s), ${blocking.length} blocking`);
  process.exit(blocking.length ? 1 : 0);
}
