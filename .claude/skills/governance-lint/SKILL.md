---
name: governance-lint
description: >-
  Runs the governance checks that fail the build — AST ESLint rules (no XPath, no hard waits or
  networkidle, no page objects built in specs, no absolute URLs, no literal credentials, required
  tags, one page object per route, no focused or skipped tests), TypeScript, and the OPA policy over
  config, waivers and quarantine. Use whenever code is edited, before a task is declared done, or CI
  reports a governance failure, or someone asks whether a branch is ready to merge. Not for requesting
  an exception (waiver-registry), pinning audits (dependency-pin-audit), or skill files (skill-scan).
allowed-tools: Read Grep Glob Bash(npm run verify) Bash(npx eslint:*) Bash(node scripts/policy-input.mjs:*) Bash(opa eval:*)
---

# Governance lint

Rules are tools, not memory: if a rule matters, a check fails.

## Non-negotiables
- Never add `eslint-disable` comments: inline configuration is turned off.
- Exceptions exist only as approved, unexpired entries in `governance/waivers.yaml`.

## Inputs and outputs
- **In:** changed files
- **Out:** violations by rule

## Procedure
1. `npm run verify`.
2. `node scripts/policy-input.mjs > .claude/out/policy-input.json` then `opa eval -d policy -i .claude/out/policy-input.json 'data.qa.deny'`.
3. Fix each violation at its source; request a waiver only for a justified exception.

## Verify
- `npm run verify` exits 0
- `data.qa.deny` is empty

## Evidence
Add to the evidence block: rule counts before and after. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Zero violations and zero unexplained waivers.
