---
name: dependency-pin-audit
description: >-
  Audits that every third-party reference is pinned — npm packages to exact versions with a committed
  lock file and verified registry signatures, GitHub Actions to full commit SHAs, container images to
  digests, Python requirements by hash — and that Renovate manages the updates. Use whenever
  dependencies, workflows or images change, before a release, or someone asks whether the supply chain
  is pinned. Not for generating the SBOM (sbom-generation), verifying the pack signature
  (release-signing-verify), or writing workflows (ci-workflow-authoring).
allowed-tools: Read Grep Glob Bash(node scripts/check-pins.mjs:*) Bash(npm audit signatures)
---

# Dependency pin audit

Pins are integrity controls: a reference that can move is a reference that can be swapped.

## Non-negotiables
- No version ranges, no tags without digests, no unhashed Python requirements.
- Renovate pull requests touching T3 or T4 paths are never auto-merged.

## Inputs and outputs
- **In:** manifests, lock files, workflows
- **Out:** a pin report

## Procedure
1. `node scripts/check-pins.mjs`.
2. `npm audit signatures`.
3. Fix each finding or let Renovate's pin pull request do it.

## Verify
- both commands exit 0

## Evidence
Add to the evidence block: violations found and fixed. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every third-party reference is immutable.
