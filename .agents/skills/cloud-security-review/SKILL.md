---
name: cloud-security-review
description: >-
  Cloud-agnostic, read-only security posture review for cloud accounts the team owns and is
  authorised to assess, framed by the shared-responsibility model and CIS benchmarks: identity and
  least privilege, public storage and encryption, network exposure, logging and monitoring, secrets
  and key management. Routes provider specifics to aws-security-review and azure-security-review.
  Use whenever the user asks for a cloud security assessment or review, cloud misconfiguration
  findings, shared-responsibility or CIS cloud benchmarking, or multi-cloud posture — without naming
  a single provider, or across more than one. Not for a single provider's deep review (see
  aws-security-review / azure-security-review), Kubernetes (kubernetes-security-audit), containers
  (docker-security-review), or risk posture across every source (security-posture-management).
  Reviews configuration read-only; it changes and exploits nothing.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Cloud security review

Assess what the team is responsible for in the cloud — identity, data, network, logging, secrets —
against known-good baselines, read-only, and route provider detail to the specialised skills.

## Non-negotiables
- Authorised accounts only; use a **read-only** audit role. Make no changes; attempt no privilege escalation or data access to "prove" a finding.
- Frame every finding with the shared-responsibility model (the provider secures the cloud; the team secures what it runs in it) and a named benchmark control.
- Never print keys, secrets, or sensitive identifiers; redact account ids. Findings get restricted visibility.
- Prefer managed tooling (Prowler, ScoutSuite, provider posture services); record tool, version and run date.

## Provider routing
| Provider | Use |
|---|---|
| AWS | `aws-security-review` (CIS AWS: IAM, S3, security groups, CloudTrail, KMS) |
| Azure | `azure-security-review` (CIS Azure: Entra ID/RBAC, storage, NSGs, Key Vault, Defender) |
| GCP / other | this skill's domain checklist, mapped to the provider's CIS benchmark |

## Domain checklist (provider-independent)
| Domain | Review | Good state |
|---|---|---|
| Identity | least privilege; MFA; no long-lived wildcard admin | scoped roles; MFA on; keys rotated |
| Data | public buckets/blobs; encryption at rest; backups | not public; encrypted; recoverable |
| Network | ingress open to the internet on sensitive ports; segmentation | least exposure; segmented |
| Logging | audit logs on, centralised, integrity-protected | enabled org-wide |
| Secrets/keys | managed vault; rotation; no secrets in code/env | vaulted; rotating |
| Monitoring | threat detection / posture management enabled | on, findings triaged |

## Procedure
1. Confirm authorisation and which account(s)/provider(s) are in scope; assume the read-only role(s).
2. For AWS/Azure, hand off to the provider skill; otherwise run the domain checklist against the provider's CIS benchmark.
3. Collect failing controls with ids and affected resources; rate by exposure and blast radius.
4. Write resource → control → remediation; recommend a re-scan after fixes.
5. Store results restricted; feed anything app-impacting to `web-app-security-assessment`.

## Definition of Done
- Read-only role used; no changes made; scope and provider(s) recorded.
- Findings cite CIS/provider control ids with remediation; identity, data, network, logging, secrets covered.
- Provider specifics routed to the specialised skill; results stored restricted.
