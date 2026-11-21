# Security policy

## Reporting
Report vulnerabilities in the pack privately through the repository's private vulnerability reporting, or to the
security contact your organisation publishes. Do not open a public issue. Reports are acknowledged within two business
days; critical issues are fixed or mitigated within seven days.

## Scope
In scope: skills and their instructions, `AGENTS.md`, hooks, policy, the installer, workflows, the knowledge layer and
MCP server, and the scrubber. Out of scope: the applications the pack tests.

## Supported releases
Only the latest signed release is supported. A release is identified by the sha256 of `skills.lock.json`, the signed
tag `pack-<digest12>` and its Sigstore bundle; there are no version numbers. Verify before installing:

    cosign verify-blob skills.lock.json --bundle skills.lock.json.sigstore.json \
      --certificate-identity "<release identity from /opt/qa-pack/trust.json>" \
      --certificate-oidc-issuer https://token.actions.githubusercontent.com

## Malicious skill or MCP tool
If a skill, prompt or MCP tool description looks manipulated: stop using the pack, add the lock digest to
`governance/revoked-digests.txt` through a pull request reviewed by AppSec, and report it as above. `pack-integrity`
rejects revoked digests.
