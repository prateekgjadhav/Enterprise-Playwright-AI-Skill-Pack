---
name: security-architecture-review
description: >-
  Design-level security review of a system or feature the team owns: evaluate the architecture
  against security principles (defence in depth, least privilege, zero trust, secure defaults, fail
  secure), check that identity, data protection, secrets, logging and trust boundaries are designed
  in, and map required controls to the skills that verify them. Covers OWASP A04 (insecure design).
  Use whenever the user asks for a security architecture review, a design or control-coverage review,
  a security design assessment, zero-trust or defence-in-depth feedback, or "is this architecture
  secure". Not for enumerating new threats from scratch (threat-modeling), source-level review
  (secure-code-review), or network topology specifics (network-security-review). It reviews design
  and documents; it touches no running system.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Security architecture review

Judge whether security is built into the design, not bolted on. Review the architecture against
principles, confirm the essential controls exist by design, and tie each to a verifying check.

## Non-negotiables
- A review of designs, diagrams and docs for systems the team owns; it does not probe or access any live environment.
- Measure against stated principles and the organisation's requirements; every gap gets a concrete recommendation and an owner.
- Map each required control to the skill/test that proves it, so "designed" becomes "verified".
- Pairs with `threat-modeling` (which enumerates threats); this skill judges the design's response to them. Findings get restricted visibility.

## Principles & what to confirm
| Principle | Confirm in the design |
|---|---|
| Defence in depth | no single control is the only thing standing between attacker and asset |
| Least privilege | components, services and users get the minimum access; segmented duties |
| Secure defaults | safe out of the box; features fail closed, not open |
| Zero trust | identity verified per request; no implicit network trust |
| Data protection | classification; encryption in transit and at rest; minimisation and retention |
| Identity & authz | centralised authn; server-side authz at every boundary; session/token design |
| Secrets & keys | managed vault; rotation; nothing in code/images/config |
| Observability | security events logged, centralised, and alertable |
| Resilience | rate limits, quotas, timeouts; graceful degradation |

## Template
```markdown
# @skill-example: fragment — security/architecture-review.md
## System: <name>   Authoriser: <name>   Inputs: <design docs/diagrams>   Date: <date>
### Trust boundaries & data flows
<summary or reference to the threat-modeling DFD>
### Control coverage
| Principle/Control | Designed? | Gap | Recommendation | Verified by |
|---|---|---|---|---|
| Server-side authz at API | partial | some checks client-side | enforce per-request authz | api-security-review (API1/API5) |
| Secrets management | no | secrets in config | adopt a vault; reference by name | secrets-detection |
| Transport encryption | yes | — | — | security-headers-review (A02) |
```

## Procedure
1. Gather the design (architecture docs, diagrams, data model) and the security requirements; confirm scope.
2. Walk the principles table; for each, judge whether the design provides the control and note gaps.
3. Build the control-coverage matrix; map each control to its verifying skill/test.
4. Prioritise gaps by risk; give each a concrete recommendation and an owner.
5. Store the review with the design; open follow-ups and link the verifying tests.

## Definition of Done
- Design reviewed against the principles; control-coverage matrix produced.
- Each gap has a prioritised recommendation, an owner, and a verifying skill/test.
- Review stored with the design; no live system accessed; results restricted.
