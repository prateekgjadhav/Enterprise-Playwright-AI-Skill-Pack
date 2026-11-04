---
name: threat-modeling
description: >-
  Structured threat modelling for a feature or system the team is building: draw the data-flow and
  trust boundaries, enumerate threats with STRIDE, rate them, and propose mitigations and the tests
  that verify them. Covers OWASP A04 (insecure design). Use whenever the user asks for a threat
  model, STRIDE analysis, attack tree, data-flow or trust-boundary diagram, abuse/misuse cases, or
  "what could go wrong with this design", or wants a Playwright threat-modelling assistant to turn
  threats into checks. Not for reviewing an existing architecture's controls
  (security-architecture-review), running the checks (auth-access-control-review,
  injection-handling-review), or external threat intelligence (security-posture-management).
  Design-stage analysis; it touches no running system.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Threat modeling

Find the design flaws before they are built. Model the system, enumerate how it could be abused,
decide what to do about each threat, and link every mitigation to a test.

## Non-negotiables
- A paper exercise on designs and diagrams; it does not probe or access any live system.
- Model what exists: use the real data flows, trust boundaries and assets, not a generic list.
- Every threat ends in a decision — mitigate, accept (with owner), transfer, or eliminate — and every "mitigate" names the control and the test that proves it.
- Keep the model with the feature so it is revisited when the design changes.

## Method
1. **Scope & assets** — what is being built; the data and functions worth protecting.
2. **Diagram** — external entities, processes, data stores, data flows, and the trust boundaries they cross.
3. **Enumerate with STRIDE** per element/flow:

| STRIDE | Threat | Typical control |
|---|---|---|
| Spoofing | identity forged | strong auth, MFA, mutual TLS |
| Tampering | data/code altered | integrity checks, signing, authz, input validation |
| Repudiation | action denied later | audit logging, non-repudiation |
| Information disclosure | data exposed | encryption, least privilege, minimisation |
| Denial of service | availability lost | rate limits, quotas, autoscaling, timeouts |
| Elevation of privilege | gains higher rights | authz checks, sandboxing, least privilege |

4. **Rate** — likelihood × impact (or DREAD/qualitative); focus effort on the top risks.
5. **Mitigate & verify** — assign a control and the test skill that checks it.

## Template
```markdown
# @skill-example: fragment — security/threat-model.md
## System: <feature>        Authoriser: <name>        Date: <date>
### Assets
- <data/function> — <why it matters>
### Diagram (textual DFD)
[User] --login--> (Auth API) --token--> (Orders API) --SQL--> [Orders DB]
Trust boundaries: internet | service mesh | data tier
### Threats (STRIDE)
| # | Element | STRIDE | Threat | Likelihood×Impact | Decision | Control | Verified by |
|---|---|---|---|---|---|---|---|
| 1 | Orders API | E | user reads another's order | H×H | mitigate | object-level authz | auth-access-control-review (A01) |
| 2 | Auth API | S | credential stuffing | M×H | mitigate | rate limit + lockout | auth-access-control-review (A07) |
```

## Procedure
1. Gather the design (docs, diagrams, data model); confirm scope and assets with the team.
2. Build the data-flow diagram and mark trust boundaries.
3. Walk STRIDE element by element; record threats you can justify, not a boilerplate list.
4. Rate and prioritise; assign a decision and control to each, and the verifying test skill.
5. Store the model with the feature; open follow-ups for the mitigations and their tests.

## Definition of Done
- DFD with trust boundaries; STRIDE threats enumerated and rated against real assets.
- Each threat has a decision; each mitigation names a control and a verifying skill.
- Model stored with the feature and linked to follow-up work.
