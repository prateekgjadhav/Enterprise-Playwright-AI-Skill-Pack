#!/usr/bin/env node
// Builds the OPA input document from the repository: config, catalogue, waivers, quarantine and approvals.
// Usage: node scripts/policy-input.mjs [--out <file>] [--now <rfc3339>]
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseYaml } from './lib/yaml-lite.mjs';
const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const yaml = (p, key) => (existsSync(p) ? parseYaml(readFileSync(p, 'utf8'))[key] ?? [] : []);
const approvals = existsSync('governance/approvals') ? readdirSync('governance/approvals').filter((f) => f.endsWith('.json') && !f.endsWith('.sigstore.json'))
  .map((f) => ({ file: `governance/approvals/${f}`, bundle: existsSync(`governance/approvals/${f.replace(/\.json$/, '.sigstore.json')}`), ...JSON.parse(readFileSync(`governance/approvals/${f}`, 'utf8')) })) : [];
const input = {
  now: opt('--now') ?? new Date().toISOString(),
  config: JSON.parse(readFileSync('.agents/qa.config.json', 'utf8')),
  catalog: JSON.parse(readFileSync('.agents/skills-catalog.json', 'utf8')).skills,
  waivers: yaml('governance/waivers.yaml', 'waivers'),
  quarantine: yaml('governance/quarantine.yaml', 'quarantine'),
  approvals,
  files: { approvals: approvals.map((a) => a.file) },
};
const json = JSON.stringify(input, null, 2);
if (opt('--out')) { mkdirSync(dirname(opt('--out')), { recursive: true }); writeFileSync(opt('--out'), json + '\n'); } else console.log(json);
