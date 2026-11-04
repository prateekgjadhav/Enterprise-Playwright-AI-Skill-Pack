---
name: skill-evaluation
description: >-
  Validates and measures the skill set itself: builds a machine-readable manifest from every
  SKILL.md, enforces the frontmatter schema, required sections and name/folder match, detects
  overlapping or duplicate skills (trigger collisions and missing "Not for" cross-references),
  verifies routing coverage (every skill routed, no orphan rows), checks tier/domain balance, and
  runs a trigger-accuracy eval against example requests — then gates CI on the results. Use whenever
  the user asks to evaluate, validate, lint or benchmark the skills, generate the manifest or
  routing table from the skills, detect skill overlap or routing drift, or add a skill-quality gate
  to CI. Not for enforcing test-code rules (framework-governance) or authoring a single skill
  (skill-authoring). It measures the pack; it runs deterministically and stores no secrets.
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Skill evaluation

Keep the growing skill set coherent. This skill turns the `SKILL.md` files into a manifest and then
proves the set holds together — schema, no duplication, full routing coverage, balanced tiers, and
good trigger accuracy — so routing can't drift and overlap is caught automatically.

## Non-negotiables
- Runs on the pack's own skills; **deterministic and dependency-light by default** (Node built-ins). An LLM-judge eval step is opt-in and never required for the gate.
- **Hard failures block the build:** frontmatter-schema violations, name/folder mismatch, missing required sections, wrong `pack`, or a routing row without a skill (or a skill without a routing row).
- **Soft signals warn (configurable to fail):** tier imbalance over threshold, high trigger overlap without a mutual "Not for", and trigger-accuracy below target.
- The manifest and routing table are **generated** from the skills, never hand-maintained in two places; no secrets are read or stored.

## Checks
| Check | Type | Rule |
|---|---|---|
| Frontmatter schema | hard | keys `name`/`description`/`metadata`; metadata `tier`/`pack`; `name` == folder |
| Required sections | hard | `## Non-negotiables`, `## Procedure`, `## Definition of Done` present |
| Pack consistency | hard | `pack` == `enterprise-playwright-ai-skill-pack` |
| Routing coverage | hard | every skill has a routing row; no orphan rows |
| Manifest freshness | hard | the committed manifest equals a fresh build from the skills |
| Cross-references | hard | every skill named in a "Not for" line exists |
| Overlap / duplication | soft | trigger-term overlap over threshold between two skills that don't cross-reference via "Not for" |
| Tier balance | soft | no single tier exceeds the configured share (default 45%) |
| Trigger accuracy | soft | example requests route to the expected skill at or above target (default 90%) |

## Templates
```bash
# @skill-example: fragment — commands
node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json  # build manifest
node scripts/generate-routing.mjs .agents/skills-manifest.json > routing.generated.md # regenerate routing
node scripts/check-skills.mjs .agents/skills-manifest.json tests/skills/trigger-cases.json # gate
```
```jsonc
// @skill-example: fragment — tests/skills/trigger-cases.json
[
  { "request": "write a smoke test for the login page", "expect": "playwright-test-generation" },
  { "request": "confirm the server rejects an alg:none JWT", "expect": "jwt-validation-review" },
  { "request": "scan dependencies for known CVEs", "expect": "dependency-vulnerability-audit" },
  { "request": "which open CVEs are on the KEV list and past their SLA?", "expect": "security-posture-management" }
]
```
```yaml
# @skill-example: fragment — CI gate (see .github/workflows/skill-validation.yml)
- run: node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json
- run: node scripts/check-skills.mjs .agents/skills-manifest.json tests/skills/trigger-cases.json  # non-zero fails the build
```

## Procedure
1. Build the manifest from `.agents/skills` (`build-skill-manifest.mjs`); commit it as a generated artifact.
2. Run `check-skills.mjs`: enforce the hard checks and report the soft signals (overlap, tier balance, trigger accuracy).
3. Regenerate the routing table (`generate-routing.mjs`) and diff it against `CLAUDE.md`/the guide; update if it drifted.
4. Maintain `tests/skills/trigger-cases.json` as skills are added; add a case per new skill.
5. Wire the hard checks as a blocking CI gate; review soft signals each run (tier imbalance and overlap are design smells).

## Definition of Done
- Manifest generated from the skills; routing table regenerated and in sync.
- Hard checks pass (schema, sections, name/folder, pack, routing coverage) and gate CI.
- Soft signals reviewed (tier balance, overlap, trigger accuracy); regressions triaged; no secrets stored.
