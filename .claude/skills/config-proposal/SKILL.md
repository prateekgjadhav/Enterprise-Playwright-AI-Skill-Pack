---
name: config-proposal
description: >-
  Turns an approved discovery report into a proposed .agents/qa.config.json — environments with owner,
  ticket, data class, hosts and review date, roles, secret references, gateway and knowledge endpoints
  — validated and delivered on a branch for human review. Use whenever the discovery report is
  approved, qa.config.json is empty or invalid, or the first full configuration must be written, or
  someone asks to propose, fill in or fix the qa config. Not for adding one environment later
  (environment-allowlist), changing model routes (model-gateway-config), or the discovery itself
  (repo-discovery), or healing proposals (test-healing).
allowed-tools: Read Grep Glob Edit(.agents/qa.config.json) Bash(node scripts/validate-config.mjs:*) Bash(git switch -c:*)
---

# Configuration proposal

An empty field is safer than a guessed one; the loader fails closed until a person approves real values.

## Non-negotiables
- Only values with cited evidence or an owner's confirmation; leave the rest empty with a reason.
- Never add production-like, public demo or third-party hosts; every host needs an owner, a ticket and a review date.
- Secrets are references (`secrets.refs`), never values.
- Never merge your own proposal: it goes through a pull request and CODEOWNERS.

## Inputs and outputs
- **In:** the approved discovery report; owner confirmations
- **Out:** a diff to `.agents/qa.config.json` on branch `qa-config/<ticket>`

## Procedure
1. Fill `project.name` and `project.owners` from the report.
2. Add one `environments[]` entry per confirmed non-production environment: `name`, `owner`, `ticket`, `dataClass`, `hosts`, `reviewBy` (at most 90 days ahead).
3. Set `defaultEnvironment`, `framework.roles` and the framework paths that exist.
4. Set `secrets.provider` and the reference names in `secrets.refs` (no values).
5. Fill `ai.gateway` and `knowledge` only with endpoints the platform team provided.
6. Run `node scripts/validate-config.mjs` and fix every error.
7. Commit on a new branch and open a pull request for review.

## Verify
- `node scripts/validate-config.mjs` exits 0
- OPA policy passes in CI

## Evidence
Add to the evidence block: fields filled, fields left empty with reasons, validation result. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Configuration validates, every host has an owner and review date, and the pull request awaits review.
