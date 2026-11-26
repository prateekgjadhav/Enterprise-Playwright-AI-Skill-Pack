#!/usr/bin/env node
// Validate .claude/qa.config.json. Exit 0 when usable, 1 with every problem listed otherwise.
// Usage: node scripts/validate-config.mjs [--root <dir>] [--json]
import { readQaConfig, validateQaConfig } from './lib/qa-config.mjs';
const argv = process.argv.slice(2);
const root = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd();
let errors;
try { errors = validateQaConfig(readQaConfig(root)); } catch (e) { errors = [`cannot read .claude/qa.config.json: ${e.message}`]; }
if (argv.includes('--json')) console.log(JSON.stringify({ ok: !errors.length, errors }, null, 2));
else if (errors.length) { console.log(`qa.config.json: ${errors.length} problem(s)`); for (const x of errors) console.log(`  - ${x}`); }
else console.log('qa.config.json: valid');
process.exit(errors.length ? 1 : 0);
