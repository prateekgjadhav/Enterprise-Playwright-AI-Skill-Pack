@AGENTS.md

## Claude Code specifics
- Permissions, hooks and MCP servers come only from enterprise managed settings (`allowManagedPermissionRulesOnly`,
  `allowManagedHooksOnly`, `allowManagedMcpServersOnly`). Do not edit `.claude/settings*.json`; the pack never ships one.
- Hooks run from `/opt/qa-pack/hooks`. Check they are active with `/status` (setting sources lists enterprise managed settings).
- Sub-agents: `.claude/agents/governance-reviewer.md`, `.claude/agents/knowledge-researcher.md`.
- Command: `/test-scenarios <ticket>` runs `scenario-design`.
