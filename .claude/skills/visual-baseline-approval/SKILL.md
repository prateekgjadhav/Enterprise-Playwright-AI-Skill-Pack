---
name: visual-baseline-approval
description: >-
  Prepares a baseline-update pull request with before, after and diff images regenerated in the pinned
  runner image, and requires an identity-bound approval from the design QA owners before the new
  baselines merge. Use whenever a visual diff reflects an intended UI change and the baselines must be
  accepted, or the visual diff is intended and the snapshots must be updated. Not for writing visual
  assertions (visual-snapshot-authoring), investigating an unexpected diff (failure-rca), or approving
  waivers (waiver-registry).
allowed-tools: Read Grep Glob Bash(gh workflow run update-baselines.yml:*) Bash(gh workflow run approve.yml:*) Bash(gh pr create:*)
---

# Visual baseline approval

A baseline change is a product decision; a person with the right role makes it.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- Baselines are regenerated only by the CI workflow in the pinned image, never on a workstation.
- Baseline updates never share a pull request with code changes.
- No self-approval: the approver differs from the requester and belongs to the design QA owners.

## Inputs and outputs
- **In:** the CI diff artifacts; the intended change
- **Out:** a pull request labelled `visual-baseline` with an approval attestation

## Procedure
1. Confirm the diff is intended (link the ticket).
2. Dispatch the baseline workflow in the pinned image for the affected specs.
3. Open the pull request with before/after/diff images.
4. Request approval through `approval-attestation`.

## Verify
- the attestation verifies and the approver is in `@org/design-qa`

## Evidence
Add to the evidence block: pull request, attestation digest, approver identity. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- New baselines merged with a verified approval.
