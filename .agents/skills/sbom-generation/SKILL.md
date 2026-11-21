---
name: sbom-generation
description: >-
  Generates a CycloneDX software bill of materials for the pack and the test project with npm sbom,
  and attaches it to the release as a signed attestation. Use whenever a release is prepared, a
  customer or auditor asks for an SBOM, or dependencies change significantly. Not for pin audits
  (dependency-pin-audit), signature verification (release-signing-verify), or vulnerability triage.
allowed-tools: Read Grep Glob Bash(npm sbom:*) Write(.agents/out/**)
---

# SBOM generation

Ship the list of what you ship.

## Non-negotiables
- Generate from the lock file; never hand-edit the SBOM.
- No secrets or internal URLs in component metadata.

## Inputs and outputs
- **In:** `package-lock.json`
- **Out:** `sbom.cdx.json`

## Procedure
1. `npm sbom --sbom-format cyclonedx --omit dev=false > .agents/out/sbom.cdx.json`.
2. Check the component count against the lock file.
3. The release workflow attests and attaches it.

## Verify
- the SBOM parses and lists every locked package

## Evidence
Add to the evidence block: SBOM digest, component count. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The release carries a signed SBOM.
