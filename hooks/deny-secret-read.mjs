#!/usr/bin/env node
// PreToolUse (Read|Grep|Glob|Bash|Edit|Write|MultiEdit): blocks any tool call that touches secret material —
// .env files (not .env.example), authenticated state, secret folders, private keys, credential stores, the
// knowledge index — or that dumps the process environment. The managed deny rules say the same; this hook also
// catches paths hidden inside shell commands and search patterns.
import { pathToFileURL } from 'node:url';
import { payload, block, guarded } from './lib.mjs';

export const SECRET_PATH = new RegExp([
  String.raw`(^|[\s/'"=:(])\.env(?!\.example\b)(\.[\w.-]+)?(?=$|[\s/'"):;|&*])`,
  String.raw`(^|[\s/'"=])\.auth(/|$|\s)`,
  String.raw`(^|[\s/'"=])secrets/`,
  String.raw`storage-?state[\w.-]*\.json`,
  String.raw`\bid_(rsa|dsa|ecdsa|ed25519)\b`,
  String.raw`\.(pem|p12|pfx|key|keystore|jks)(?=$|[\s'"):;|&])`,
  String.raw`(^|[\s/'"=])\.(npmrc|netrc|pypirc|git-credentials)\b`,
  String.raw`(~|\$HOME|/home/[^/\s]+|/Users/[^/\s]+)/\.(ssh|aws|azure|kube|docker|gnupg)(/|$|\s)`,
  String.raw`\.config/gcloud\b`,
  String.raw`\.agents/rag-index\b`,
].join('|'), 'i');
export const ENV_DUMP = /(^|[;&|]\s*)(printenv\b|env\s*($|[;&|>])|set\s*($|[;&|>])|export\s+-p\b|declare\s+-x\b)|\/proc\/[^\s]*\/environ|\bGet-ChildItem\s+env:/i;

export function check(p) {
  const i = p.tool_input ?? {};
  const fields = [i.file_path, i.path, i.pattern, i.glob, i.command, i.notebook_path, ...(i.edits ?? []).map((e) => e?.file_path)]
    .filter((x) => typeof x === 'string');
  for (const f of fields) {
    if (SECRET_PATH.test(f)) return `${p.tool_name ?? 'tool'} touches secret material (${f.slice(0, 80)}). Use the @fixtures secretProvider by reference.`;
  }
  if (typeof i.command === 'string' && ENV_DUMP.test(i.command)) return 'dumping the environment is not allowed: it exposes CI and local secrets';
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) guarded(async () => { const r = check(await payload()); if (r) block(r); });
