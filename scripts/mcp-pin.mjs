#!/usr/bin/env node
// Pins MCP tool definitions. A tool's description is an instruction to the model, so a changed description
// (a "rug pull") must block the server until it is re-vetted. Starts each stdio server in .mcp.json, lists its
// tools and hashes name + description + inputSchema.
//   node scripts/mcp-pin.mjs --write [--server <name>]   record pins in mcp.lock.json (review the diff)
//   node scripts/mcp-pin.mjs --check                     fail when a server is unpinned or any tool changed
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const argv = process.argv.slice(2);
const only = argv.includes('--server') ? argv[argv.indexOf('--server') + 1] : null;
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sha = (v) => createHash('sha256').update(canon(v)).digest('hex');

export function listTools(def, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const p = spawn(def.command, def.args ?? [], { env: { ...process.env, ...(def.env ?? {}) }, stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = ''; const t = setTimeout(() => { p.kill(); reject(new Error('timed out')); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.stdout.on('data', (d) => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 2) { clearTimeout(t); p.kill(); resolve(m.result?.tools ?? []); }
      }
    });
    const send = (o) => p.stdin.write(JSON.stringify(o) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-pin', version: 'pin' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  });
}

const servers = JSON.parse(readFileSync('.mcp.json', 'utf8')).mcpServers ?? {};
const lock = existsSync('mcp.lock.json') ? JSON.parse(readFileSync('mcp.lock.json', 'utf8')) : { servers: {} };
const problems = [];
for (const [name, def] of Object.entries(servers)) {
  if (only && name !== only) continue;
  let tools;
  try { tools = await listTools(def); } catch (e) { problems.push(`${name}: cannot list tools (${e.message})`); continue; }
  const pins = Object.fromEntries(tools.map((t) => [t.name, sha({ name: t.name, description: t.description ?? '', inputSchema: t.inputSchema ?? {} })]).sort());
  if (argv.includes('--write')) { lock.servers[name] = { tools: pins }; continue; }
  const want = lock.servers?.[name]?.tools;
  if (!want) { problems.push(`${name}: not pinned (vet it, then node scripts/mcp-pin.mjs --write --server ${name})`); continue; }
  for (const [t, h] of Object.entries(pins)) if (want[t] !== h) problems.push(`${name}.${t}: ${want[t] ? 'definition changed since it was pinned (possible rug pull)' : 'new, unpinned tool'}`);
  for (const t of Object.keys(want)) if (!(t in pins)) problems.push(`${name}.${t}: pinned tool disappeared`);
}
if (argv.includes('--write')) { writeFileSync('mcp.lock.json', JSON.stringify(lock, null, 2) + '\n'); console.log(`mcp-pin: wrote ${Object.keys(lock.servers).length} server(s)`); }
for (const p of problems) console.log(`  - ${p}`);
if (!argv.includes('--write')) console.log(problems.length ? `mcp-pin: ${problems.length} problem(s)` : 'mcp-pin: every MCP tool matches its pin');
process.exit(problems.length ? 1 : 0);
