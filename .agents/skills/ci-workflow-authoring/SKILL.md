---
name: ci-workflow-authoring
description: >-
  Writes and changes CI workflows to the hardened baseline — actions pinned to full commit SHAs,
  read-only default token, job-level elevation only, OIDC instead of stored secrets, egress blocking,
  protected environments, concurrency groups and scrub-before-upload. Use whenever a workflow is added
  or changed, CI needs a new job, or a pipeline must run tests in another CI system. Not for sizing
  shards (sharding-config), pinning the runner image (runner-image-pinning), or auditing pins across
  the repo (dependency-pin-audit).
allowed-tools: Read Grep Glob Edit(.github/workflows/**) Bash(node scripts/check-pins.mjs:*)
---

# CI workflow authoring

A pipeline holds credentials: write it like production code.

## Non-negotiables
- Top-level `permissions: { contents: read }`; elevate per job only.
- Every `uses:` pinned to a 40-character SHA with its tag as a comment; images pinned by digest.
- No `pull_request_target` that checks out pull request code; no secrets in workflow-level `env`.
- Artifacts are scrubbed before upload; no raw upload with `if: always()`.

## Inputs and outputs
- **In:** the requested change
- **Out:** a workflow diff

## Procedure
1. Start from `.github/workflows/ci.yml` patterns.
2. Add `step-security/harden-runner` first with `egress-policy: block` and the endpoint list.
3. Use `persist-credentials: false` on checkout.
4. Run `node scripts/check-pins.mjs`.

## Verify
- `check-pins` exits 0
- actionlint clean in CI

## Evidence
Add to the evidence block: permission changes, new pins. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The workflow meets the hardened baseline.
