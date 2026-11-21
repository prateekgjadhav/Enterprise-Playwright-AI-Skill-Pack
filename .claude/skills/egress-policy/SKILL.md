---
name: egress-policy
description: >-
  Keeps runner and sandbox egress lists in step with the environment allowlist — harden-runner allowed
  endpoints in workflows and the managed sandbox domains — and checks that no list allows more than
  the environments and the required infrastructure. Use whenever environments change, a job is blocked
  by egress, or someone asks what a runner may reach. Not for the environment entries themselves
  (environment-allowlist), workflow structure (ci-workflow-authoring), or MCP servers
  (mcp-server-vetting).
allowed-tools: Read Grep Glob Edit(.github/workflows/**) Bash(node scripts/egress-list.mjs:*)
---

# Egress policy

Three fences, one list: config, browser and runner agree.

## Non-negotiables
- Never allow DNS-over-HTTPS resolvers, paste sites or wildcard domains.
- Egress blocking is defence in depth, not a boundary; self-hosted runners also need network-level controls.

## Inputs and outputs
- **In:** `environments[].hosts` and the infrastructure endpoints
- **Out:** updated allowed-endpoints lists

## Procedure
1. `node scripts/egress-list.mjs` prints the required list per job.
2. Update the workflows; send the sandbox list to the platform team for MDM.
3. `node scripts/egress-list.mjs --check`.

## Verify
- `--check` exits 0

## Evidence
Add to the evidence block: endpoints added and removed. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Config, browser guard and runner egress allow the same hosts.
