---
name: security-posture-management
description: >-
  Programme-level security risk management for the software the team ships and the vendors it
  relies on: an SBOM inventory (own and vendor-supplied, with VEX), the CVE lifecycle across every
  scanner (deduplicate, enrich with CISA KEV and EPSS, prioritise, set SLAs, track exceptions to
  expiry), vendor risk assessed from the evidence vendors supply, compliance mapping with
  audit-ready evidence, and security posture as trended metrics. Use whenever the user asks about
  vendor or third-party risk, SBOM intake or VEX, CVE triage, SLAs or exceptions, "are we affected
  by CVE-…", KEV or EPSS prioritisation, threat intelligence, compliance or audit evidence, a risk
  register, or posture metrics. Not for scanning dependencies (dependency-vulnerability-audit),
  images (docker-security-review) or cloud accounts (cloud-security-review), design-time threats
  (threat-modeling), one engagement's report (pentest-report-generator) or test dashboards
  (reporting-analytics). It never scans a vendor or exploits a CVE.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Security posture management

Know what you ship, what it is exposed to, who you depend on, and whether you can prove it. This
skill turns what the scanning skills find — plus SBOMs, VEX, vendor evidence and threat
intelligence — into one deduplicated risk register in which every item has a priority, an owner
and a deadline, and every claim has a source.

## Non-negotiables
- **Manage risk; never attack.** Work from scanner output, SBOMs, VEX, the evidence vendors supply and public advisories. Never scan, probe or log in to a vendor's systems, and never fetch, run or write exploit code: "exploited in the wild" is a sourced fact (CISA KEV, a vendor advisory), not something to demonstrate.
- **Every fact is sourced and dated.** CVE details, KEV listings, EPSS scores and vendor evidence carry their source and retrieval date, because they change daily. A feed that fails to load is an error, never "not listed". Figures come from the registers and scans only; report explicit metrics, not an opaque composite score.
- **Every open item has an owner and a deadline.** Priority sets the SLA from `security.slaDays`. Accepting a risk is never automatic: an exception needs a named approver (`gates.riskAcceptance`; treat a missing gate as `ask`), a compensating control, a ticket and an expiry, and an expired exception reopens the item.
- **Evidence, not attestation.** The compliance map links controls to evidence and gaps; it never states that the organisation is compliant or certified, because only an auditor attests. Regulatory reports (such as EU CRA Article 14) are the named owner's decision: flag candidates, never file them.
- **Confidential by default.** Vendor reports (SOC 2, penetration test summaries) stay out of the repository: record where they are and summarise them, never copy them in. Registers and posture reports have restricted visibility and hold no secrets. Questionnaires and evidence requests are drafted here and sent by a person.

## Workstreams
| Workstream | Works from | Produces |
|---|---|---|
| SBOM inventory | CycloneDX or SPDX SBOMs from `dependency-vulnerability-audit` and `docker-security-review`; SBOMs from vendors | one SBOM per shipped release, checked for the minimum elements (supplier, name, version, purl, dependencies, author, timestamp), with its VEX beside it |
| CVE management | findings from every scanner (dependencies, images, SAST, assessments, cloud) and new advisories re-matched against stored SBOMs | one record per CVE × component × asset with priority, SLA date, owner, status and VEX state |
| Threat intelligence | CISA KEV, FIRST EPSS, OSV/GitHub/NVD advisories, vendor PSIRT notices | dated exploitation context on every record; an alert when a CVE in the inventory joins KEV |
| Vendor risk | the vendor register; SOC 2 Type II or ISO 27001 evidence; questionnaire answers (SIG Lite, CAIQ); vendor SBOM and VEX; contract clauses | a tier, rating, gaps and next review date per vendor |
| Compliance | the frameworks in `security.frameworks`; CI gates, scan history and the registers | a control → evidence → gap matrix an auditor can sample |
| Posture | everything above | the posture metrics, trended, for `reporting-analytics` and the release go/no-go |

## Prioritise (first match wins)
| Priority | Rule | Default SLA |
|---|---|---|
| P1 | affected (present, not VEX `not_affected`) and listed in CISA KEV, or exploitation confirmed by the vendor | 7 days |
| P2 | CVSS 9.0 or above, or EPSS at or above `security.epssThreshold`, on a reachable path in a production or internet-facing asset | 30 days |
| P3 | CVSS 7.0–8.9, or the P2 conditions on an internal-only asset | 90 days |
| P4 | anything else that is affected (dev-only, unreachable, low severity) | 180 days |

- VEX `not_affected` closes a record only with a justification (component not present, vulnerable code not present or not in the execute path, not controllable by an adversary, inline mitigations exist), and the record reopens when the component or the VEX changes.
- KEV is a curated floor, not a census: a vendor's confirmation of exploitation counts the same. Teams that use CISA SSVC map Act → P1, Attend → P2, Track* → P3, Track → P4.
- With PCI DSS in scope, keep critical-ranked vulnerabilities inside one month of the patch's release (requirement 6.3.3).
- If an exploited vulnerability is in a product the organisation sells in the EU, flag it the same day to the owner of EU CRA Article 14 reporting (an early warning is due within 24 hours through ENISA's single reporting platform).

## Vendor tiers
| Tier | Typical vendor | Evidence to request | Review |
|---|---|---|---|
| Critical | holds restricted data, has production access, or sits in the release path (CI, registry, hosted runtime) | SOC 2 Type II report or ISO 27001 certificate with its scope; full questionnaire; SBOM and VEX for software it delivers; breach-notice and vulnerability-disclosure clauses | yearly, and after any incident at the vendor |
| High | holds internal data or integrates with our systems | SOC 2 Type II or ISO 27001; short questionnaire | yearly |
| Low | no data and no access | public security page; standard contract terms | at renewal |

## Compliance map (examples; scope comes from `security.frameworks`)
| Activity | SOC 2 | ISO/IEC 27001:2022 | NIST CSF 2.0 | PCI DSS v4.0.1 | Also |
|---|---|---|---|---|---|
| Component inventory (SBOM) | CC6.1 | A.5.9 | ID.AM-02 | 6.3.2 | SSDF PS.3.2; EU CRA Annex I Part II |
| Vulnerability management | CC7.1 | A.8.8 | ID.RA-01, ID.RA-08 | 6.3.1, 6.3.3 | SSDF RV.1–RV.2; NIST 800-53 RA-5, SI-2; EU CRA Art. 14 |
| Threat intelligence | — | A.5.7 | ID.RA-02 | 6.3.1 | NIST 800-53 PM-16, SI-5 |
| Supplier risk | CC9.2 | A.5.19–A.5.22 | GV.SC-04, GV.SC-07 | 12.8 | SSDF PW.4.4; NIST 800-53 SR-6 |
| Exceptions and risk acceptance | CC3.2 | clause 6.1.3 | ID.RA-07 | — | — |
| Posture monitoring | CC4.1 | clause 9.1 | GV.OV-03 | — | NIST 800-53 CA-7 |

Cite the framework version the auditor uses, and the control id on every piece of evidence.

## Posture metrics
| Metric | Definition | Example target |
|---|---|---|
| KEV exposure | open, affected, KEV-listed CVEs in shipped assets | 0 |
| SLA compliance | items closed within SLA ÷ items due in the period, per priority | ≥ 95% |
| Past-SLA backlog | open items beyond their due date, per priority | 0 for P1–P2 |
| Time to remediate | median days from open to fixed, per priority | inside the SLA |
| Exceptions | open, expiring within 30 days, expired | 0 expired |
| SBOM coverage | shipped releases with a current SBOM ÷ shipped releases | 100% |
| Vendor coverage | critical and high vendors with in-date evidence and review ÷ all of them | 100% |
| Control evidence | in-scope controls with current evidence ÷ in-scope controls, per framework | rising |

## Templates
```yaml
# @skill-example: fragment — security/risk-register.yaml (one record per CVE × component × asset)
- id: RR-0142
  cve: <CVE id>
  component: pkg:npm/<name>@<version>        # purl, from the SBOM
  asset: checkout-api                        # production, internet-facing
  sources: [dependency-vulnerability-audit, docker-security-review]   # duplicates merged
  cvss: { score: 9.8, vector: "<vector string>" }
  kev: { listed: true, dateAdded: 2026-10-14, retrieved: 2026-10-24 }
  epss: { score: 0.94, percentile: 0.99, date: 2026-10-24 }
  vex: affected                              # affected | not_affected | fixed | under_investigation
  reachable: true
  priority: P1
  slaDue: 2026-10-31                         # opened + security.slaDays.P1
  owner: payments-team
  status: in_progress                        # open | in_progress | fixed | accepted | not_affected
  ticket: SEC-2291
  controls: [SOC2:CC7.1, ISO27001:A.8.8, PCI:6.3.3]
  exception: null                            # or { approver, reason, compensatingControl, ticket, expires }
```
```yaml
# @skill-example: fragment — security/vendors.yaml (evidence is referenced by location, never copied in)
- vendor: <name>
  service: payment gateway
  tier: critical
  data: [cardholder, personal]
  access: production API
  evidence:
    soc2TypeII: { period: 2025-10-01/2026-09-30, location: "<evidence store link>", exceptionsNoted: 1 }
    questionnaire: { type: SIG Lite, completed: 2026-08-12 }
    sbom: { format: CycloneDX, received: 2026-09-02, vex: true }
  contract: { breachNoticeHours: 72, rightToAudit: true, vulnerabilityDisclosure: true }
  gaps: ["MFA not enforced for vendor support staff; fix agreed by 2026-12-31"]
  rating: medium
  owner: <name>
  lastReview: 2026-09-15
  nextReview: 2027-09-15
```
```jsonc
// @skill-example: fragment — .agents/qa.config.json (add)
"security": {
  "frameworks": ["SOC2", "ISO27001"],             // in scope; drives the compliance map
  "slaDays": { "P1": 7, "P2": 30, "P3": 90, "P4": 180 },
  "epssThreshold": 0.1,                           // EPSS at or above this raises priority
  "riskRegister": "security/risk-register.yaml",
  "vendorRegister": "security/vendors.yaml",
  "sbomDir": "security/sbom",
  "mcpServer": null                               // optional SBOM platform or GRC tool
}
// and in "gates": "riskAcceptance": "ask"
```
```javascript
// @skill-example: fragment — scripts/posture.mjs (enrichment step; public feeds only, every value dated)
const KEV = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const EPSS = 'https://api.first.org/data/v1/epss?cve=';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);   // a failed feed is never "not listed"
  return res.json();
}

export async function enrich(records) {
  const retrieved = new Date().toISOString().slice(0, 10);
  const kev = new Map((await getJson(KEV)).vulnerabilities.map((v) => [v.cveID, v.dateAdded]));
  const ids = [...new Set(records.map((r) => r.cve))];
  const epss = new Map();
  for (let i = 0; i < ids.length; i += 50) {                          // EPSS takes comma-separated batches
    const { data } = await getJson(EPSS + ids.slice(i, i + 50).join(','));
    for (const d of data) epss.set(d.cve, { score: Number(d.epss), percentile: Number(d.percentile), date: d.date });
  }
  return records.map((r) => ({ ...r,
    kev: { listed: kev.has(r.cve), dateAdded: kev.get(r.cve) ?? null, retrieved },
    epss: epss.get(r.cve) ?? null }));
}
```
```yaml
# @skill-example: fragment — .github/workflows/security-posture.yml (nightly; reads our own SBOMs and public feeds only)
on: { schedule: [{ cron: '0 5 * * *' }], workflow_dispatch: {} }
permissions: { contents: read }
jobs:
  posture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: anchore/scan-action/download-grype@<pinned-sha>   # pin by SHA (ci-cd-security-validation)
        id: grype
      - run: mkdir -p reports && ${{ steps.grype.outputs.cmd }} sbom:security/sbom/app.cdx.json --vex security/vex/app.openvex.json -o json > reports/sbom-match.json
      - run: node scripts/posture.mjs reports/sbom-match.json   # merge, enrich, then fail on a new affected KEV entry, a past-SLA P1/P2 or an expired exception
      - uses: actions/upload-artifact@v5
        if: ${{ !cancelled() }}
        with: { name: security-posture, path: reports/ }
```

## Procedure
1. **Scope** — the products and releases, vendors and frameworks in scope; add the `security` block to `qa.config.json` and create the registers it names if they are missing.
2. **Inventory** — collect one SBOM per shipped release (ask `dependency-vulnerability-audit` or `docker-security-review` for any that are missing) and every vendor SBOM; check the minimum elements; keep each VEX beside its SBOM.
3. **Consolidate** — import findings from the scanning skills and re-match the stored SBOMs against current advisories; merge duplicates into one record per CVE × component × asset; apply VEX.
4. **Enrich and prioritise** — add dated KEV and EPSS context; apply the priority table; set SLA date, owner and ticket (filed through `gates.fileDefects`); flag possible CRA Article 14 cases to their owner the same day.
5. **Vendors** — tier each vendor, draft requests for missing evidence (a person sends them), review what arrives, and record gaps, rating and next review.
6. **Exceptions and compliance** — draft exceptions with control, ticket and expiry for a named approver; map evidence to the in-scope controls and list the gaps.
7. **Report and repeat** — compute the posture metrics with trend, hand the summary to `reporting-analytics` (release go/no-go) or `pentest-report-generator` (formal report), and schedule the nightly re-match through `ci-cd-pipeline-config`.

## Definition of Done
- Every shipped release has a current SBOM (with VEX where relevant) and is re-matched against new advisories on a schedule.
- Every affected finding is one deduplicated record with dated KEV and EPSS context, a priority, an SLA date and an owner; no exception is unapproved, uncompensated or expired.
- Critical and high vendors have in-date evidence, a rating and a next review; no vendor system was scanned or probed.
- The compliance map links in-scope controls to evidence and gaps without claiming compliance; posture metrics are reported with trend; every artifact is restricted and secret-free.
