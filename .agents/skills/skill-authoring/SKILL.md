---
name: skill-authoring
description: >-
  Meta-skill for extending this pack: create or revise a SKILL.md that matches the pack's exact
  conventions — spec-compliant frontmatter (name, description, metadata), the right tier, a clear
  single responsibility with "Not for" neighbours, non-negotiables, a coverage table, working
  templates, a procedure and a definition of done — and update the routing table and guide so the
  new skill is discoverable. Use whenever the user asks to add, author, scaffold, refactor or
  review a skill, define a new capability for the pack, fix a skill's frontmatter or routing, or
  check that a skill follows the conventions. Not for enforcing code rules in test code
  (framework-governance) or writing tests (playwright-test-generation). New skills stay narrow,
  non-duplicative and, if security-related, defensive and authorised-only.
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Skill authoring

How the pack grows without drifting. Every new skill looks and behaves like the existing ones,
routes cleanly, and earns its place by covering a real gap rather than duplicating a neighbour.

## Non-negotiables
- **One job per skill.** Before authoring, check the inventory and routing table; if an existing skill covers it, enhance that skill instead of adding a duplicate.
- Frontmatter is spec-compliant and complete: `name` (matches the folder, kebab-case), a folded `description` that states what it does, a `Use whenever…` trigger and a `Not for X (other-skill)` exclusion, and `metadata` with `tier` and `pack`.
- Body follows the house shape: `# Title`, a one-line philosophy, `## Non-negotiables`, a coverage/rules table, templates marked `// @skill-example: fragment — <path>`, `## Procedure`, `## Definition of Done`. British spelling in prose.
- Security-related skills inherit the security non-negotiables (authorised, non-production targets, non-destructive, no exploit output) and are defensive only.
- Adding a skill is not done until the routing table (`CLAUDE.md`) and the guide are updated and `npm run verify` passes.

## Tier guide
| Tier | Meaning | Examples |
|---|---|---|
| 1 | Core development primitives reused everywhere | test generation, page objects, locators, data, api |
| 2 | Execution and operations | CI/CD, regression, migration, defect analysis, observability, SRE |
| 3 | Specialised quality engineering domains | visual, accessibility, performance, security checks, mobile |
| 4 | Governance and meta | framework governance, reporting, this skill |

## Templates
```yaml
# @skill-example: fragment — .agents/skills/<new-skill>/SKILL.md (frontmatter)
---
name: <new-skill>
description: >-
  <what it does, how>. Use whenever the user asks <triggers>. Not for <X> (<other-skill>).
metadata:
  tier: "<1-4>"
  pack: "enterprise-playwright-ai-skill-pack"
---
```
```markdown
# @skill-example: fragment — routing row to add in CLAUDE.md and the guide
| <request phrase> | <new-skill> | <usually-with skills> |
```

## Procedure
1. Confirm the gap: search the inventory and routing table; if it already exists, switch to enhancing that skill.
2. Pick the tier using the guide; choose a kebab-case name that doesn't collide.
3. Write the SKILL.md in the house shape with real templates and a definition of done.
4. Add the routing row to `CLAUDE.md` and the guide; name neighbours in the description's "Not for" line.
5. Validate: rebuild the manifest (`node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json`), add a case to `tests/skills/trigger-cases.json`, run `node scripts/check-skills.mjs`, then `npm run verify`.

## Definition of Done
- New (or revised) SKILL.md matches the frontmatter schema and house shape; name matches folder; no duplicate capability.
- Routing table and guide updated; neighbours cross-referenced.
- `npm run verify` passes; security skills, if any, are defensive and authorised-only.
