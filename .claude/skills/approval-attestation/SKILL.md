---
name: approval-attestation
description: >-
  Obtains an identity-bound, signed approval for a gated action — waiver, quarantine, baseline update,
  knowledge promotion, enabling an optional skill, defect filing or risk acceptance — through the
  approve.yml workflow in a protected environment with required reviewers, and verifies the signed
  bundle. Use whenever a T3 action needs approval or someone asks how to approve a gated change, or
  someone asks how to approve something or requests sign-off. Not for the waiver content
  (waiver-registry), security testing scope (security-scope-verify), or release signing
  (release-signing-verify), or pending memory entries (knowledge-provenance).
allowed-tools: Read Grep Glob Bash(gh workflow run approve.yml:*) Bash(node scripts/verify-attestation.mjs:*)
---

# Approval attestation

Approval in a chat is not approval; a signed statement from a named identity is.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- Never accept "yes" in a conversation as approval.
- The requester and approver differ; the environment enforces required reviewers and prevents self-review.
- The attestation binds the action, the subject digest and an expiry.

## Inputs and outputs
- **In:** the action; the subject's sha256
- **Out:** `governance/approvals/<id>.json` and its `.sigstore.json` bundle

## Procedure
1. `gh workflow run approve.yml -f action=<action> -f subject=<path> -f digest=<sha256>`.
2. A reviewer in the environment approves; the workflow signs the statement keylessly.
3. `node scripts/verify-attestation.mjs governance/approvals/<id>.json` checks signer, digest and expiry.

## Verify
- `verify-attestation` exits 0

## Evidence
Add to the evidence block: attestation id, approver identity, digest. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The gated action has a verified, identity-bound approval.
