---
name: mcp-server-vetting
description: >-
  Vets an MCP server before it is allowed: authorization per the MCP spec for remote servers (OAuth
  2.1, protected resource metadata, resource indicators, audience-bound tokens, no token passthrough),
  minimal scopes, and SHA-256 pins of every tool name, description and schema in mcp.lock.json so a
  changed description blocks the server. Use whenever a new MCP server is proposed, a server's tools
  change, or the pin check fails. Not for skill files (skill-scan), retrieved content
  (prompt-injection-defense), or runner egress (egress-policy).
allowed-tools: Read Grep Glob Bash(node scripts/mcp-pin.mjs:*)
---

# MCP server vetting

A tool description is an instruction to the model: pin it like code.

## Non-negotiables
- Only servers in the managed `allowedMcpServers` list run (`allowManagedMcpServersOnly`).
- A changed tool description disables the server until re-vetted and re-pinned by AppSec.
- Remote servers without protected resource metadata or audience validation fail vetting.

## Inputs and outputs
- **In:** the server definition
- **Out:** `mcp.lock.json` entries and a vetting note

## Procedure
1. For remote servers: check `/.well-known/oauth-protected-resource`, audience validation and scopes.
2. `node scripts/mcp-pin.mjs --server <name>` lists and hashes the tools.
3. Review descriptions for instructions; commit pins through a pull request reviewed by AppSec.
4. `node scripts/mcp-pin.mjs --check` in CI.

## Verify
- `--check` exits 0

## Evidence
Add to the evidence block: tools pinned, vetting result. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The server's tools are pinned and the server is on the managed allowlist.
