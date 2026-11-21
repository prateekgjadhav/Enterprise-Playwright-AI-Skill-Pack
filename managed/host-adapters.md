# Host adapters

The pack is host-neutral: `AGENTS.md` is the contract, skills follow the open Agent Skills format, and the knowledge
layer is an MCP server. Each host has its own enterprise policy surface; map every control below before enabling
skills on a host. Where a host has no equivalent control, record the gap here and keep T2 and higher skills disabled on
that host until AppSec accepts the compensating CI controls (CI is the backstop for every rule).

| Control | Claude Code | Any other host |
|---|---|---|
| Managed permissions only | `allowManagedPermissionRulesOnly` in `managed-settings.json` | the host's organisation policy for tool permissions |
| Managed hooks only | `allowManagedHooksOnly`; hooks in `/opt/qa-pack/hooks` (root-owned) | a pre-execution gate or a wrapper that runs the same Node hooks |
| MCP allowlist | `allowManagedMcpServersOnly` + `allowedMcpServers` | the host's MCP server allowlist |
| Network sandbox | `sandbox.network.allowManagedDomainsOnly` | host or OS-level egress control |
| Telemetry | `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_EXPORTER_OTLP_ENDPOINT` | the host's OTLP export settings |
| Skills discovery | `.claude/skills` (linked by `scripts/link-skills.mjs`) | the host's skills path, linked the same way |

Managed settings file locations for Claude Code: `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS),
`/etc/claude-code/managed-settings.json` (Linux and WSL), `C:\Program Files\ClaudeCode\managed-settings.json` (Windows),
or the MDM profile. Check with `/status` after every host upgrade.

Package the MDM payload with `node scripts/package-hooks.mjs dist/qa-pack-hooks`, which copies the hooks with the
modules they need, so they never import code from a repository an agent can edit.
