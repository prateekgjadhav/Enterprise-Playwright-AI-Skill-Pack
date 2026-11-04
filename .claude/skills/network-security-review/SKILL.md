---
name: network-security-review
description: >-
  Network security architecture and configuration review for environments the team owns: trust
  zones and segmentation, firewall/security-group rules and ingress exposure, TLS configuration and
  certificate hygiene, management-plane access, and egress controls, assessed from configuration and
  documentation against best practice. Use whenever the user asks for a network security review,
  segmentation or firewall-rule review, TLS/certificate configuration checks, exposure or
  attack-surface review, or zero-trust network design feedback. Not for cloud account posture
  (cloud-security-review / aws / azure), Kubernetes network policies (kubernetes-security-audit), or
  app-layer checks (web-app-security-assessment). This reviews configuration and design; active
  scanning or probing of hosts is out of scope and, where permitted at all, stays gated and
  authorised.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Network security review

Reduce exposure and enforce segmentation by reviewing how the network is configured and designed —
from rules, topology and TLS config, not by attacking it.

## Non-negotiables
- Review from configuration and documentation the team owns (firewall/SG exports, topology diagrams, TLS/cert config, load-balancer and ingress rules).
- **No active network attacks.** Port scanning, host enumeration, or traffic interception are out of scope here; any active testing is a separate, explicitly authorised activity and stays gated (`gates.securityScan: "ask"`) and off `protectedHosts`/production.
- A finding is an exposure or misconfiguration against a stated best practice; rate by exposure and blast radius. Findings get restricted visibility.
- Public TLS endpoints may be checked with read-only configuration graders (e.g. an SSL config report) on authorised hosts.

## Review areas
| Area | Review | Good state |
|---|---|---|
| Segmentation | trust zones; flat vs tiered network; east-west controls | tiered; least cross-zone access |
| Ingress exposure | rules open to `0.0.0.0/0`; sensitive ports (22/3389/DB) exposed | minimal public surface; no broad admin ingress |
| Egress | unrestricted outbound; data-exfil paths | egress allow-listed where feasible |
| TLS | protocol/cipher strength; cert validity, chain, expiry; HSTS at the edge | modern TLS; valid, monitored certs |
| Management plane | admin interfaces/bastions exposed; VPN/zero-trust access | admin access restricted/brokered |
| DDoS/edge | edge protection; rate limiting at the boundary | protected |
| Monitoring | flow logs; IDS/IDP; alerting | logged and alerted |

## Templates
```markdown
# @skill-example: fragment — security/network/exposure-review.md
Scope: <environment, owned>        Sources: SG export, topology diagram, TLS config
| Area | Observation (rule/config) | Risk | Best-practice gap | Remediation |
|---|---|---|---|---|
| Ingress | SG allows 0.0.0.0/0 → 22 | High | admin port world-open | restrict to bastion/VPN CIDR |
| TLS | TLS 1.0 enabled at edge | Medium | legacy protocol | disable < TLS 1.2; modern ciphers |
```

## Procedure
1. Confirm authorisation and gather configuration/topology for the owned environment.
2. Review segmentation, ingress/egress rules, TLS config, and management-plane access against the table.
3. Where authorised, run read-only TLS configuration grading on public endpoints; never scan or probe hosts here.
4. Rate findings by exposure and blast radius; write observation → gap → remediation.
5. Route cloud-specific items to `cloud-security-review`/provider skills; store results restricted.

## Definition of Done
- Review based on owned configuration/design; no active scanning performed in this skill.
- Segmentation, ingress/egress, TLS and management-plane reviewed against best practice.
- Findings rated with remediation; cloud items routed; results stored restricted.
