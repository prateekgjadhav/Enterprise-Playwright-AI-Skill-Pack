#!/usr/bin/env node
// Classifies files about to become model context: restricted (secrets, auth state, keys) is never sent;
// confidential (personal data, security material) goes only to self-hosted routes; otherwise the default
// environment's data class, or internal. Prints the class, the x-qa-data-class header and the reasons.
// Usage: node scripts/classify-context.mjs <file> … [--json]
import { readFileSync, existsSync } from 'node:fs';
import { redact } from '../rag/security/guard.mjs';
const RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const SECRET_RULES = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|JWT/i;
const PII_RULES = /EMAIL|PHONE|CARD|IBAN|SSN/i;

export function classify(files, qa = {}) {
  const env = (qa.environments ?? []).find((e) => e.name === qa.defaultEnvironment);
  let cls = env?.dataClass ?? 'internal'; const reasons = [`baseline ${cls}${env ? ` (environment ${env.name})` : ''}`];
  const raise = (c, why) => { if (RANK[c] > RANK[cls]) cls = c; reasons.push(why); };
  for (const f of files) {
    const p = f.replace(/\\/g, '/');
    if (/(^|\/)(\.env|\.auth\/|secrets\/)|\.(pem|key|p12|pfx)$/.test(p)) { raise('restricted', `${p}: secret material path`); continue; }
    if (/^(security|reports\/security)\//.test(p)) raise('confidential', `${p}: security material`);
    if (!existsSync(f)) { raise('restricted', `${p}: unreadable, classified restricted (fail closed)`); continue; }
    const r = redact(readFileSync(f, 'utf8'));
    for (const [rule, n] of Object.entries(r.counts ?? {})) {
      if (!n) continue;
      if (SECRET_RULES.test(rule)) raise('restricted', `${p}: ${n} ${rule} match(es)`);
      else if (PII_RULES.test(rule)) raise('confidential', `${p}: ${n} ${rule} match(es)`);
    }
  }
  return { class: cls, header: `x-qa-data-class: ${cls}`, sendable: cls !== 'restricted', reasons };
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let qa = {}; try { qa = JSON.parse(readFileSync('.claude/qa.config.json', 'utf8')); } catch { /* unconfigured: internal baseline */ }
  const r = classify(files, qa);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else { console.log(`${r.class}  (${r.header})`); for (const x of r.reasons) console.log(`  - ${x}`); }
  process.exit(r.sendable ? 0 : 3);
}
