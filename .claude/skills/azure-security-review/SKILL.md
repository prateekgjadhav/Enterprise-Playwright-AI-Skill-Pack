---
name: azure-security-review
description: >-
  Read-only Azure security posture review for subscriptions the team owns and is authorised to
  assess: Entra ID and RBAC least privilege, public storage accounts and encryption, network
  security group exposure, Key Vault and secrets handling, diagnostic/activity logging, and
  Microsoft Defender for Cloud coverage, evaluated against the CIS Azure Benchmark using read-only
  tooling (Defender for Cloud, ScoutSuite/Prowler, `az` show/list). Use whenever the user asks for
  an Azure security review or assessment, Entra ID/RBAC review, storage exposure check, NSG review,
  CIS Azure benchmarking, or Azure misconfiguration findings. Not for AWS (aws-security-review),
  Kubernetes (kubernetes-security-audit), or app-layer checks (web-app-security-assessment). This
  reviews configuration read-only; it makes no changes and exploits nothing.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Azure security review

Assess the subscription's configuration against the CIS Azure baseline and report gaps with fixes.
Read-only observation, framed by the shared-responsibility model.

## Non-negotiables
- Authorised subscriptions only; use a **read-only** role (e.g. the built-in `Reader` / `Security Reader` roles). Make no changes.
- Never print secrets, keys, or sensitive principal ids; redact tenant/subscription ids where required.
- A finding is a configuration gap against a named CIS control; cite the control id. Do not escalate privilege or access data to "prove" it.
- Prefer managed tooling; record tool, version and run date.

## Review areas (CIS Azure-aligned)
| Area | Check | Good state |
|---|---|---|
| Entra ID | MFA for admins; no legacy auth; guest access scoped | MFA enforced; legacy auth blocked |
| RBAC | least privilege; limited Owner/Contributor at subscription scope | scoped roles; few owners |
| Storage | "Secure transfer required"; public blob access; encryption | HTTPS-only; public access disabled; encrypted |
| Network | NSG rules open to `*`/Internet on sensitive ports; just-in-time VM access | least ingress; JIT where used |
| Key Vault | access policies/RBAC; soft-delete & purge protection; secret expiry | least access; protected; rotating |
| Logging | Activity Log + diagnostic settings to a workspace; retention | enabled, centralised, retained |
| Defender for Cloud | enabled on key resource types; recommendations triaged | on; Secure Score tracked |

## Templates
```bash
# @skill-example: fragment — read-only posture checks (authorised subscription, Reader/Security Reader)
scout azure --cli --report-dir ./security/azure                 # read-only; maps to CIS
# Spot checks (read-only):
az storage account list --query "[?allowBlobPublicAccess==\`true\`].name"
az network nsg list --query "[].securityRules[?access=='Allow' && direction=='Inbound' && (sourceAddressPrefix=='*' || sourceAddressPrefix=='Internet')].name"
```

## Procedure
1. Confirm authorisation and assume the read-only role; record subscription scope.
2. Run the posture tool mapped to CIS Azure; collect failing controls with ids and resources.
3. Spot-check high-impact areas (public storage, open NSGs, admin MFA, logging/Defender on).
4. Rate by exposure and blast radius; write resource → CIS control → remediation.
5. Store results restricted; recommend a re-scan after fixes.

## Definition of Done
- Read-only role used; no changes made; subscription scope recorded.
- Findings cite CIS Azure control ids with remediation; high-impact areas spot-checked.
- Sensitive identifiers redacted; results stored restricted.
