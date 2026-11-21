---
description: Design retrieval-aware test scenarios for a requirement or feature
argument-hint: <REQUIREMENT-ID or feature description>
---
Use the `scenario-design` skill for: $ARGUMENTS

1. Call `scenario_brief` on the qa-knowledge MCP server (requirement id, or `query` for free text).
2. Review it with the `scenario-synthesis` prompt; keep covered ACs out of the new list.
3. Ask the open questions before any P0 work.
4. Write `test-plan.md` and list the scenarios to hand to `spec-authoring`.
End with the evidence block, including the cited context ids.
