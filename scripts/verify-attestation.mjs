#!/usr/bin/env node
// Verifies an approval attestation from approve.yml: the statement's fields, that requester and approver differ,
// that it has not expired, that the subject still has the approved digest, and the Sigstore signature against the
// approval identity (managed trust file, or QA_TRUST_FILE in CI). Fails closed when anything is missing.
// Usage: node scripts/verify-attestation.mjs governance/approvals/<id>.json
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const file = process.argv[2];
const fail = (m) => { console.log(`verify-attestation: INVALID — ${m}`); process.exit(1); };
if (!file || !file.startsWith('governance/approvals/') || !existsSync(file)) fail('give a statement under governance/approvals/');
const bundle = file.replace(/\.json$/, '.sigstore.json');
if (!existsSync(bundle)) fail(`no signature bundle ${bundle}`);
let st; try { st = JSON.parse(readFileSync(file, 'utf8')); } catch { fail('the statement is not JSON'); }
for (const k of ['id', 'action', 'subject', 'digest', 'requester', 'approver', 'expires']) if (!st[k]) fail(`the statement has no ${k}`);
if (st.requester === st.approver) fail('self-approval');
if (Date.parse(st.expires) < Date.now()) fail(`expired at ${st.expires}`);
if (existsSync(st.subject) && createHash('sha256').update(readFileSync(st.subject)).digest('hex') !== st.digest) fail(`${st.subject} changed since it was approved`);
let trust; try { trust = JSON.parse(readFileSync(process.env.QA_TRUST_FILE || '/opt/qa-pack/trust.json', 'utf8')); } catch { fail('no trust file'); }
if (!trust.approvalIdentity || !trust.oidcIssuer) fail('the trust file has no approvalIdentity/oidcIssuer');
const v = spawnSync(process.env.QA_COSIGN || 'cosign', ['verify-blob', file, '--bundle', bundle, '--certificate-identity', trust.approvalIdentity, '--certificate-oidc-issuer', trust.oidcIssuer], { encoding: 'utf8' });
if (v.error) fail(`cosign is not available (${v.error.code})`);
if (v.status !== 0) fail(`signature does not verify: ${(v.stderr || '').trim().split('\n').pop()}`);
console.log(`verify-attestation: valid — ${st.action} on ${st.subject} approved by ${st.approver} until ${st.expires}`);
