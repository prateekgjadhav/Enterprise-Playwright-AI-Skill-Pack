---
name: knowledge-provenance
description: >-
  Handles agent write-back to project knowledge and memory: proposals land in a staged area with
  source, author, evidence ids, sha256, classification and ACL, are redacted and injection-scanned,
  and are promoted to the trusted tier only with a verified approval attestation. Use whenever a
  learning, RCA or pattern should be remembered, staged knowledge awaits review, or poisoned knowledge
  must be revoked, or pending memory entries must be approved. Not for retrieving knowledge
  (knowledge-retrieval), approvals in general (approval-attestation), or ingesting repository files
  (knowledge-retrieval).
allowed-tools: Read Grep Glob Bash(node rag/cli.mjs memory:*) Bash(node scripts/verify-attestation.mjs:*)
---

# Knowledge provenance

Memory is a supply chain: provenance in, approval to promote, revocation out.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- Never write to the trusted tier directly; `memory write` only stages.
- `memory approve` requires `--by <identity>` and `--attestation <bundle>`; the bundle is verified in CI.
- Staged content is excluded from retrieval.

## Inputs and outputs
- **In:** the learning with evidence ids
- **Out:** a staged entry; after approval, a promoted entry with provenance

## Procedure
1. `node rag/cli.mjs memory write --scope project --kind pattern --title … --content … --evidence <ids>`.
2. Request approval through `approval-attestation`.
3. `node rag/cli.mjs memory approve <id> --by <identity> --attestation governance/approvals/<id>.sigstore.json`.
4. To revoke: `memory reject <id>` or remove the promoted line and re-ingest.

## Verify
- the promoted entry carries `approvedBy` and `approvalBundleDigest`

## Evidence
Add to the evidence block: staged id, attestation digest. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Only reviewed, attributable knowledge reaches retrieval.
