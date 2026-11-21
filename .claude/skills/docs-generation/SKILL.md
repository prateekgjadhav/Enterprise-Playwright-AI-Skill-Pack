---
name: docs-generation
description: >-
  Regenerates the setup guide from the repository itself — catalogue, skill frontmatter, every shipped
  file and the lock — so the documentation cannot drift from what ships, and checks in CI that the
  committed guide is current. Use whenever skills, the catalogue, policies, hooks, workflows or the
  guide template change, or CI reports the guide is stale, or someone asks to regenerate or update the
  setup guide. Not for writing skill content (skill-authoring), verifying release signatures
  (release-signing-verify), or the evidence block of a task (evidence-report).
allowed-tools: Read Grep Glob Edit(docs/**) Bash(node scripts/gen-docs.mjs:*)
---

# Documentation generation

Documentation is a build artifact of the sources it describes.

## Non-negotiables
- Never hand-edit the generated guide; change `docs/guide.template.html` or the source files.
- No version numbers, changelog or release history anywhere in the guide.
- The guide embeds files as text only; it never embeds `.env*`, `.auth/`, indexes or generated results.

## Inputs and outputs
- **In:** `docs/guide.template.html` and the repository files
- **Out:** `Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html`

## Procedure
1. Edit the template when prose must change.
2. Run `node scripts/gen-docs.mjs`.
3. Run `node scripts/gen-docs.mjs --check` and commit the result.

## Verify
- `node scripts/gen-docs.mjs --check` exits 0
- the guide's skill count equals the catalogue's

## Evidence
Add to the evidence block: guide digest, embedded file count. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The committed guide matches the sources byte for byte.
