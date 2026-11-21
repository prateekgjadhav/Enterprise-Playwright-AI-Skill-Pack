---
name: environment-allowlist
description: >-
  Adds, renews or removes a test environment in qa.config.json with owner, ticket, data class, hosts
  and a review date, so that only listed non-production hosts can ever be targeted by tests, crawls,
  healing or security checks. Use whenever a new test environment is onboarded, a host changes, or an
  environment's review date passes. Not for the first full configuration (config-proposal), runner and
  sandbox egress lists (egress-policy), or model routes (model-gateway-config).
allowed-tools: Read Grep Glob Edit(.agents/qa.config.json) Bash(node scripts/validate-config.mjs:*)
---

# Environment allowlist

If a host is not on the list, nothing touches it.

## Non-negotiables
- Never production-like, public demo, wildcard or third-party hosts.
- Every entry has owner, ticket, data class, hosts and `reviewBy` at most 90 days ahead.
- Changes go through a pull request reviewed by CODEOWNERS.

## Inputs and outputs
- **In:** the environment request
- **Out:** a config diff

## Procedure
1. Add or update the entry.
2. `node scripts/validate-config.mjs`.
3. Hand off to `egress-policy` so runner and sandbox lists match.

## Verify
- validation and OPA pass

## Evidence
Add to the evidence block: entry diff. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The host is listed with an owner and a review date, and egress lists match.
