---
name: skill-authoring
description: >-
  Writes one new narrow skill — kebab-case name, a description with Use whenever and Not for lines,
  least-privilege allowed-tools for its tier, the required sections and trigger cases — and registers
  it in the catalogue and the routing table. Use whenever a capability has no owning skill, a skill
  does two jobs and must be split, or a description must be reworded to stop routing overlap, or
  someone asks to create a new skill, split a skill or reword a skill description. Not for scanning
  skills for unsafe content (skill-scan), measuring routing accuracy (skill-routing-eval), or
  regenerating the guide (docs-generation).
allowed-tools: Read Grep Glob Edit(.agents/skills/**) Write(.agents/skills/**) Edit(.agents/skills-catalog.json) Edit(tests/skills/trigger-cases.json) Edit(AGENTS.md) Bash(node scripts/check-skills.mjs:*) Bash(node scripts/skill-scan.mjs:*) Bash(node scripts/check-allowed-tools.mjs:*)
---

# Skill authoring

A skill does one job and says which jobs it is not for.

## Non-negotiables
- Frontmatter holds `name`, `description` and `allowed-tools` only: no version, owner or metadata fields. Tier and default live in `.agents/skills-catalog.json`.
- `allowed-tools` is path- and command-scoped; never a bare `Bash`, `Edit`, `Write` or `Bash(*)`.
- New T3 and T4 skills are `default: off`.
- A skill never tells the agent to fetch instructions from the network.

## Inputs and outputs
- **In:** the capability request; the catalogue and routing table
- **Out:** `.agents/skills/<name>/SKILL.md`, a catalogue entry, a routing row, at least three trigger cases

## Procedure
1. Prove no skill owns it: read the routing table and run `node scripts/check-skills.mjs` for overlap.
2. Pick the tier from the highest-impact action the skill takes.
3. Write the sections: Non-negotiables, Inputs and outputs, Procedure, Verify, Evidence, Definition of Done.
4. Add the catalogue entry, the routing row in `AGENTS.md` and trigger cases.
5. Run `node scripts/check-skills.mjs`, `node scripts/skill-scan.mjs` and `node scripts/check-allowed-tools.mjs`.
6. Open a pull request; the release workflow rebuilds and signs the lock after merge.

## Verify
- all three checks exit 0
- the new skill wins top-1 on its own trigger cases

## Evidence
Add to the evidence block: skill name, tier, overlap report, trigger accuracy. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The skill is narrow, least-privilege, routed, tested and reviewed.
