---
name: aws-security-review
description: >-
  Read-only AWS security posture review for accounts the team owns and is authorised to assess:
  IAM least-privilege and MFA, public S3 and unencrypted storage, security-group exposure,
  CloudTrail/Config logging, KMS and secrets handling, and public database access, evaluated against
  the CIS AWS Benchmark and AWS best practice using read-only tooling (Prowler, ScoutSuite, or `aws`
  describe/get calls). Use whenever the user asks for an AWS security review or assessment, IAM
  review, S3 exposure check, CIS AWS benchmarking, or cloud misconfiguration findings on AWS. Not
  for Azure (azure-security-review), Kubernetes (kubernetes-security-audit), or app-layer checks
  (web-app-security-assessment). This reviews configuration read-only; it makes no changes and
  exploits nothing.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# AWS security review

Assess the account's configuration against known-good baselines and report the gaps with fixes.
Everything here is read-only observation framed by the shared-responsibility model.

## Non-negotiables
- Authorised accounts only; use a **read-only** role (e.g. the AWS `SecurityAudit` / `ViewOnlyAccess` managed policies). Make no changes.
- Never print access keys, secrets, or full ARNs of sensitive principals in evidence; redact account ids where required.
- A finding is a configuration gap measured against a named benchmark control; cite the control id. Do not attempt privilege escalation or data access to "prove" it.
- Prefer managed tooling over bespoke scripts; record the tool, version and run date.

## Review areas (CIS AWS-aligned)
| Area | Check | Good state |
|---|---|---|
| IAM | root usage, MFA, access-key age, wildcard (`*:*`) policies | root unused + MFA; no wildcards; keys rotated |
| S3 | Block Public Access, bucket/object ACLs, default encryption | public access blocked; SSE enabled |
| Logging | CloudTrail (multi-region), AWS Config, log integrity | enabled org-wide, validated |
| Network | security groups open to `0.0.0.0/0` on sensitive ports; default VPC use | no broad ingress to 22/3389/DB ports |
| Data | RDS/Redshift public accessibility, encryption at rest | not public; encrypted |
| Keys/secrets | KMS key rotation; secrets in Secrets Manager/SSM not in code/env | rotation on; no inline secrets |
| Monitoring | GuardDuty / Security Hub enabled | on, findings triaged |

## Templates
```bash
# @skill-example: fragment — read-only posture scan (authorised account, SecurityAudit role)
prowler aws --compliance cis_3.0_aws -M html json --output-directory ./security/aws   # read-only; CIS mapped
# Spot checks (read-only):
aws s3api get-public-access-block --bucket "$BUCKET"
aws ec2 describe-security-groups --query "SecurityGroups[?IpPermissions[?contains(IpRanges[].CidrIp,'0.0.0.0/0')]].GroupId"
```

## Procedure
1. Confirm authorisation and assume the read-only audit role; record account scope.
2. Run the posture tool mapped to CIS AWS; collect failing controls with ids and resources.
3. Spot-check the high-impact areas (public S3, open security groups, IAM wildcards, logging on).
4. Rate findings by exposure and blast radius; write resource → benchmark control → remediation.
5. Store results with restricted visibility; recommend fixes and a re-scan after they land.

## Definition of Done
- Read-only role used; no changes made; account scope recorded.
- Findings cite CIS/AWS control ids with concrete remediation; high-impact areas spot-checked.
- Sensitive identifiers redacted; results stored restricted.
