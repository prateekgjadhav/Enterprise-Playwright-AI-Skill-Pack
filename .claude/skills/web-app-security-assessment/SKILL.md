---
name: web-app-security-assessment
description: >-
  Plans and runs an authorised, defensive web-application security assessment with Playwright:
  agrees scope and authorisation, maps the feature to the OWASP Top 10, selects the focused
  security review skills, runs them as non-destructive checks against an owned non-production
  environment, and consolidates findings for the report. Use whenever the user asks for a web app
  security assessment, a penetration test of an app they own, OWASP Top 10 coverage, a security
  review of a feature or release, or a plan for security testing. Not for the single-category
  checks themselves (auth-access-control-review, injection-handling-review,
  xss-output-encoding-review, security-headers-review), API-only scope (api-security-review),
  cloud or infra posture (cloud-security-review), or the write-up (pentest-report-generator).
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Web application security assessment

The orchestrator for application security work: scope it, cover the OWASP Top 10 with the focused
skills, and prove the application enforces its own rules. These checks complement, not replace, a
security team's manual review and penetration testing.

## Non-negotiables
- **Authorised targets only.** Confirm the user owns the application and may test the chosen environment. Default to `staging`/`dev` from `qa.config.json`; never test production or any `protectedHosts`. Record authorisation and target in the report.
- **Non-destructive only.** No data deletion, no denial of service, no exfiltration, nothing beyond the agreed scope. Active scans need approval (`gates.securityScan: "ask"`).
- Never read `.env*`, auth-state files or secrets; never print credentials, tokens or exploit detail. Security findings get restricted visibility.
- Every check names the OWASP category it covers; this skill proves controls hold, it is not an exploitation tool.

## OWASP Top 10 → skill map
| Category | Covered by |
|---|---|
| A01 Broken access control | `auth-access-control-review` |
| A02 Cryptographic failures | `security-headers-review` (transport), `auth-access-control-review` (cookies, token leakage) |
| A03 Injection (SQL/NoSQL/command/path) | `injection-handling-review` |
| A03 Injection (XSS) | `xss-output-encoding-review` |
| A04 Insecure design | `threat-modeling`, `security-architecture-review` |
| A05 Security misconfiguration | `security-headers-review` |
| A06 Vulnerable & outdated components | `dependency-vulnerability-audit` |
| A07 Identification & authentication | `auth-access-control-review` |
| A08 Software & data integrity | `ci-cd-security-validation`, `dependency-vulnerability-audit` |
| A09 Logging & monitoring failures | covered in review notes; assert security events are logged where testable |
| A10 Server-side request forgery | `ssrf-defence-review` |

## Scope sheet
```markdown
# @skill-example: fragment — security/assessment-scope.md
Application:      <name>              Owner / authoriser: <name, confirmed>
Environment:      staging             Out of scope: production, www.example.com (protectedHosts)
In scope:         <routes / endpoints / roles>
OWASP categories: A01, A03, A05, A07  Window: <dates>
Rules:            non-destructive; no DoS; no data deletion; bounded attempts; restricted findings
```

## Procedure
1. Confirm authorisation and the target environment; write the scope sheet and keep it with the report.
2. Map the feature to OWASP categories with the table; pick the focused skills to run.
3. Run each focused skill's checks in `tests/security/`, in the `security` project, using roles and data from fixtures.
4. Add `dependency-vulnerability-audit`, and `security-headers-review` on every assessment as a baseline.
5. Classify each finding: confirmed vulnerability (with category), needs manual verification, false positive, or configuration gap.
6. Hand findings to `pentest-report-generator`; draft restricted defects for confirmed issues, without exploit detail, and file only with approval.

## Definition of Done
- Authorisation and environment recorded; no production or protected-host targets.
- Selected OWASP categories each have at least one check; a dependency audit and a headers check ran.
- Findings classified and passed to the report generator; verify script green.
