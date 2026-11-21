// Contract test for the qa-knowledge MCP server over stdio: handshake, tool list, errors, notifications.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const server = join(here, '../../rag/mcp/server.mjs');
const root = join(here, '../../rag/fixtures/sample-repo');

function session(lines) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [server], { env: { ...process.env, QA_REPO_ROOT: root }, stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    const out = [];
    const timer = setTimeout(() => { p.kill(); reject(new Error('server did not answer')); }, 10000);
    p.stdout.on('data', (d) => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) { out.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); }
      if (out.length >= lines.filter((l) => l.expect).length) { clearTimeout(timer); p.kill(); resolve(out); }
    });
    for (const l of lines) p.stdin.write(l.raw + '\n');
  });
}

test('initialize, tools/list, unknown tool, bad JSON and notifications follow JSON-RPC', async () => {
  const out = await session([
    { raw: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }), expect: true },
    { raw: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) },
    { raw: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), expect: true },
    { raw: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope', arguments: {} } }), expect: true },
    { raw: '{not json', expect: true },
  ]);
  const byId = Object.fromEntries(out.map((m) => [m.id, m]));
  assert.equal(byId[1].result.serverInfo.name, 'qa-knowledge');
  const names = byId[2].result.tools.map((t) => t.name);
  for (const n of ['rag_context', 'scenario_brief', 'memory_write', 'memory_feedback', 'ingest']) assert.ok(names.includes(n), n);
  assert.equal(byId[3].error.code, -32602);
  assert.equal(byId.null.error.code, -32700);
  assert.equal(out.length, 4, 'a notification gets no reply');
});
