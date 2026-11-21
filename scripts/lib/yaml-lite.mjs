// A small YAML reader for the pack's own registry files (governance/waivers.yaml, governance/quarantine.yaml):
// a top-level map whose values are scalars, inline lists or lists of flat maps. No dependencies. It throws on
// anything outside that subset, so a malformed registry fails the check instead of being half-read.
const unq = (v) => {
  const s = v.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^"(.*)"$/.test(s)) return JSON.parse(s);
  if (/^'(.*)'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (/^\[.*\]$/.test(s)) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    const out = []; let cur = ''; let q = null;
    for (const ch of inner) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === ',') { out.push(unq(cur)); cur = ''; continue; }
      cur += ch;
    }
    out.push(unq(cur));
    return out;
  }
  return s;
};
const stripComment = (line) => {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
};

export function parseYaml(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n').map(stripComment).map((l) => l.replace(/\s+$/, ''));
  const root = {}; let key = null; let item = null; let itemIndent = -1;
  for (const [n, raw] of lines.entries()) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const m = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
      if (!m) throw new Error(`yaml line ${n + 1}: expected "key:" at the top level`);
      key = m[1]; item = null;
      root[key] = m[2] === undefined ? [] : unq(m[2]);
      continue;
    }
    if (key === null || !Array.isArray(root[key])) throw new Error(`yaml line ${n + 1}: unexpected indentation`);
    const dash = /^-\s+(.*)$/.exec(line);
    if (dash) {
      item = {}; root[key].push(item); itemIndent = indent;
      const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(dash[1]);
      if (kv) item[kv[1]] = unq(kv[2]);
      else { root[key].pop(); root[key].push(unq(dash[1])); item = null; }
      continue;
    }
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv || !item || indent <= itemIndent) throw new Error(`yaml line ${n + 1}: expected "key: value" inside a list item`);
    item[kv[1]] = unq(kv[2]);
  }
  return root;
}
