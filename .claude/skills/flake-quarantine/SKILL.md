---
name: flake-quarantine
description: >-
  Quarantines a confirmed flaky test with an owner, ticket and expiry of at most 14 days in
  governance/quarantine.yaml, tags it @quarantine so it runs in the non-blocking job, and requires an
  identity-bound approval. Use whenever flake-triage has confirmed a flake that cannot be fixed at
  once and it blocks merges, or a flaky test blocks every merge. Not for confirming flakiness
  (flake-triage), rule exceptions (waiver-registry), or skipping tests.
allowed-tools: Read Grep Glob Edit(governance/quarantine.yaml) Edit(tests/**) Bash(gh workflow run approve.yml:*)
---

# Flake quarantine

Quarantine keeps the signal visible while the cause is fixed; it is never a hiding place.

## Gate
Disabled by default. It is enabled for a repository only when it is listed in `qa.config.json` `skills.enabled` with an approval attestation, and each external action it takes needs its own attestation from `approval-attestation`. Chat approval is not approval.

## Non-negotiables
- Never quarantine a `@P0` test.
- Expiry is at most 14 days; renewal needs a new triage run and a new approval.
- Quarantined tests still run and report in the non-blocking job.

## Inputs and outputs
- **In:** the `flake-triage` evidence
- **Out:** a `quarantine.yaml` entry and the `@quarantine` tag

## Procedure
1. Write the entry: test, tags, owner, ticket, added, expires, evidence.
2. Add `@quarantine` to the test's tags.
3. Request approval through `approval-attestation`.
4. Policy checks expiry, owner and priority in CI.

## Verify
- OPA quarantine rules pass

## Evidence
Add to the evidence block: entry, expiry, attestation digest. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The flake is isolated, owned, time-boxed and still visible.
