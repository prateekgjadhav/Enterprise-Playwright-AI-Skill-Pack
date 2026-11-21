---
name: release-signing-verify
description: >-
  Verifies a pack release before install and in CI: the cosign keyless bundle over skills.lock.json
  against the expected signer identity and issuer, the GitHub build-provenance attestation of the
  release archive, the revoked-digest list, and every file hash in the lock. Use whenever the pack is
  installed or updated, CI starts, or someone asks whether the skills are genuine. Not for generating
  the SBOM (sbom-generation), pin audits (dependency-pin-audit), or approvals (approval-attestation).
allowed-tools: Read Grep Glob Bash(cosign verify-blob:*) Bash(gh attestation verify:*) Bash(node scripts/verify-lock.mjs:*)
---

# Release signature verification

Install nothing whose origin and content you have not verified.

## Non-negotiables
- Never continue after a mismatch or verification error; never retry without verification.
- The expected identity comes from managed configuration (`/opt/qa-pack/trust.json`) or CI variables, never from the repository.

## Inputs and outputs
- **In:** `skills.lock.json`, its bundle, the release archive `pack-<digest12>.zip`
- **Out:** pass or fail with the reason

## Procedure
1. `cosign verify-blob skills.lock.json --bundle skills.lock.json.sigstore.json --certificate-identity <id> --certificate-oidc-issuer <issuer>`.
2. `gh attestation verify pack-<digest12>.zip --repo <org>/<pack-repo>` (build provenance of the release archive).
3. `node scripts/verify-lock.mjs` (hashes, extra files, revoked digests).

## Verify
- all three succeed

## Evidence
Add to the evidence block: lock digest, signer identity. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The installed pack is exactly the signed release.
