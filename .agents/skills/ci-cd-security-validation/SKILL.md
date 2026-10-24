---
name: ci-cd-security-validation
description: >-
  Secures the CI/CD pipeline itself for repositories the team owns: least-privilege workflow tokens,
  third-party actions pinned to commit SHAs, secrets only from the secret store, required security
  gates (SAST, dependency audit, secret scan) wired into stages, artifact/build provenance, and
  protection of the release path. Covers OWASP A08 (software & data integrity) for the delivery
  pipeline. Use whenever the user asks to secure or audit a pipeline, harden GitHub Actions / GitLab
  CI / Azure DevOps / Jenkins, review workflow permissions, pin actions, add security gates to CI,
  or protect the build/supply chain. Not for building the functional pipeline (ci-cd-pipeline-config)
  or scanning app dependencies in isolation (dependency-vulnerability-audit). It hardens pipeline
  configuration; it does not attack build systems.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# CI/CD security validation

The pipeline is production infrastructure and a prime supply-chain target. Lock down its
permissions, inputs and dependencies, and make security checks required — then protect the path to
release.

## Non-negotiables
- Repositories the team owns only; review and propose configuration, never exfiltrate secrets or tamper with others' pipelines.
- Secrets come from the platform secret store, referenced by name; never printed, echoed, or written to artifacts/logs.
- Third-party actions/images are pinned to an immutable digest/SHA; the Playwright image tag equals the installed version (governance).
- Security gates (SAST, dependency audit, secret scan) are *required*; a failure blocks merge/release. Changes are additive to existing pipelines (never replace one silently).

## Hardening checklist
| Area | Harden to |
|---|---|
| Token scope | `permissions: { contents: read }` by default; widen per-job only as needed |
| Action/image pinning | `uses: owner/action@<sha>`; container pinned to a digest |
| Secrets | secret store only; no plaintext in YAML/env files; masked; least scope; short-lived (OIDC where available) |
| Required gates | SAST (secure-code-review), dependency audit, secret scan — all blocking |
| Untrusted triggers | avoid running untrusted code on `pull_request_target`; don't expose secrets to fork PRs |
| Artifacts/provenance | sign or attest build artifacts; generate provenance (SLSA-style); upload reports, not secrets |
| Release path | branch protection + required checks; restrict who can deploy; environment approvals |
| Caches/deps | `npm ci` from a lockfile; trusted registries; integrity verified |

## Templates
```yaml
# @skill-example: fragment — workflow hardening
permissions: { contents: read }                 # default-deny; raise per job only when required
concurrency: { group: '${{ github.workflow }}-${{ github.ref }}', cancel-in-progress: true }
jobs:
  build:
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@<commit-sha>       # pin third-party actions to a SHA
      - run: npm ci                               # lockfile install, no post-hoc mutation
```
```yaml
# @skill-example: fragment — required security gates (Security stage)
security-gates:
  needs: static
  permissions: { contents: read, security-events: write }
  steps:
    - uses: actions/checkout@<sha>
    - run: npm ci
    - run: npm run audit:ci          # dependency-vulnerability-audit (blocking)
    - run: semgrep ci --error        # secure-code-review SAST (blocking)
    - run: gitleaks detect --redact  # secrets-detection (blocking; redacted)
```

## Procedure
1. Detect the platform and read the existing pipeline; never replace it — add or amend files.
2. Audit against the checklist: token scope, pinning, secret handling, untrusted triggers, release protections.
3. Wire the required security gates (SAST, dependency audit, secret scan) and set them blocking.
4. Add artifact signing/provenance where supported; confirm branch protection and environment approvals.
5. Validate syntax, push to a branch, and report the first run; list any secrets the user must create by name.

## Definition of Done
- Tokens least-privilege; actions/images pinned; secrets only from the store and never logged.
- SAST, dependency audit and secret scan required and blocking; release path protected.
- Changes additive; pipeline runs green on a branch or its first failure is diagnosed.
