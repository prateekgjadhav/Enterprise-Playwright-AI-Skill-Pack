---
name: waiver-registry
description: >-
  Requests a governance waiver as one entry in governance/waivers.yaml — one rule, one path, a reason,
  ticket, owner, a different approver, creation date and expiry of at most 90 days — backed by an
  identity-bound approval attestation. Use whenever a governance rule cannot be met for a justified
  reason, such as a third-party widget without an accessible name, or someone needs an exception to a
  rule. Not for flaky tests (flake-quarantine), fixing the violation (governance-lint), or security
  scope (security-scope-verify), or how to approve it (approval-attestation).
allowed-tools: Read Grep Glob Edit(governance/waivers.yaml) Bash(gh workflow run approve.yml:*)
---

# Waiver registry

An exception is a dated promise to fix, owned by a named person.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- One rule and one path per entry; no wildcards.
- The approver is never the owner; expiry at most 90 days.
- Expired waivers fail CI; renewal needs a new approval.

## Inputs and outputs
- **In:** the violation and the reason
- **Out:** a pending waiver entry and an approval request

## Procedure
1. Write the entry with `id`, `rule`, `path`, `reason`, `ticket`, `owner`, `approver`, `created`, `expires`.
2. Dispatch `approve.yml` through `approval-attestation`; reference the bundle in `attestation`.
3. CI runs the policy; the ESLint plugin honours only approved, unexpired entries.

## Verify
- OPA waiver rules pass

## Evidence
Add to the evidence block: waiver id, expiry, attestation digest. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The exception is narrow, approved, dated and visible.
