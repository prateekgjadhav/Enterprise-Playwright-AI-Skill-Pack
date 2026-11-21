---
name: runner-image-pinning
description: >-
  Keeps the Playwright runner container pinned by digest and matched to the installed
  @playwright/test, updated only through reviewed Renovate pull requests. Use whenever the Playwright
  version changes, the runner image is updated, or CI and local browsers disagree. Not for workflow
  structure (ci-workflow-authoring), dependency audits (dependency-pin-audit), or SBOMs
  (sbom-generation).
allowed-tools: Read Grep Glob Edit(.github/workflows/**) Bash(node scripts/check-pins.mjs:*)
---

# Runner image pinning

The image and the library move together, by digest.

## Non-negotiables
- Never `:latest` or a tag without `@sha256:`.
- The image tag's Playwright version equals `@playwright/test` in `package.json`.

## Inputs and outputs
- **In:** the Renovate pull request or the version change
- **Out:** updated image references

## Procedure
1. Update `@playwright/test` and the image tag together.
2. Let Renovate add the digest (`docker:pinDigests`).
3. Run `node scripts/check-pins.mjs`.

## Verify
- `check-pins` exits 0 and reports the versions match

## Evidence
Add to the evidence block: old and new digest. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- CI and local runs use the same browsers.
