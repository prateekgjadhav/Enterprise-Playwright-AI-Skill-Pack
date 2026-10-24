# Enterprise Playwright AI Skill Pack — Orchestrator

You are working in a software repository that uses, or will use, Playwright for test automation.
This file decides how every request is handled; the skills in `.agents/skills/` do the work. The
pack is **generic**: project-specific values live in `.agents/qa.config.json`, never in skills.

## Step 0 — On an unfamiliar repo, set up first
If this is the first run in a repo (or `.agents/qa.config.json` is unpopulated, or `npm run verify`
does not exist), route to **`project-setup`** before anything else. It reads the repository
read-only, writes the detected values into `.agents/qa.config.json`, and scaffolds only what is
missing (package.json `verify` script, the ESLint five-rule config, `tsconfig`,
`playwright.config.ts`, `@fixtures`, one example spec) so the governance hooks can actually run.
Do not assume a reference implementation exists — discover it, then create what is missing.

## The workflow (every request)
1. **Understand the request**; fetch the ticket if a tracker is connected.
2. **Explore the repository**: existing pages, modules, fixtures and nearby specs, so nothing is duplicated.
3. **Select skills** from the routing table: usually one primary plus one or two supporting. Security requests go to an umbrella skill, which delegates to the focused checks; risk, compliance and posture requests go to `security-posture-management`, which consumes their findings.
4. **Do the work bottom-up**: data → pages → modules → fixtures → specs.
5. **Apply governance**: the hooks lint every edited file as it is written.
6. **Verify** with `npm run verify` (lint, types, governance, dependency rules).
7. **Execute** the narrowest tests that cover the change, with repeats for new tests.
8. **Report** with the evidence block.

When two skills seem to fit, prefer the one whose "Not for" line does not exclude the request. The
routing table and skill manifest are generated from the skills (`scripts/build-skill-manifest.mjs`,
`scripts/generate-routing.mjs`), so routing cannot drift; `scripts/check-skills.mjs` gates it in CI.

## Routing (primary → usually with)
- **Onboard / bootstrap / "make this work in my repo"** → `project-setup`
- Write/automate UI, E2E, smoke, regression tests → `playwright-test-generation` (+ page-object-engineering, test-data-management)
- Page objects, components, modules → `page-object-engineering` (+ locator-strategy)
- Selector / element-not-found / strict-mode / XPath → `locator-strategy`
- Test data, factories, seeding, cleanup → `test-data-management`
- REST endpoints, schemas, contracts, endpoint auth → `api-testing`
- Pipelines, CI, sharding, scheduled runs → `ci-cd-pipeline-config`
- Flaky, slow suite, retries, quarantine → `regression-optimization`
- Migrate Robot Framework / Selenium / Cypress / TestNG → `migration-analysis`
- Failed test, trace/log analysis, bug report → `defect-analysis`
- Screenshot comparison, baselines → `visual-testing`
- Accessibility, WCAG, keyboard → `accessibility-testing`
- Core Web Vitals, page speed, load → `performance-testing`
- Mobile web, responsive, touch → `mobile-testing`
- Observability, synthetic monitors, health/readiness → `observability-monitoring`
- SLIs/SLOs, error budgets, resilience → `sre-reliability`
- Reports, dashboards, trends, release readiness → `reporting-analytics`
- Standards, lint rules, "is this compliant?" → `framework-governance`
- Trace the agent, LLM-call cost, routing decision → `agent-telemetry`
- Evaluate the skills; manifest; overlap; routing drift → `skill-evaluation`
- Add/scaffold/review a skill → `skill-authoring`
- Evaluate AI-output quality (generated tests, migrations, reports, routing) → `deepeval`

### Penetration Testing (defensive, authorised-only — route umbrella-first)
- Web-app security assessment / OWASP Top 10 coverage → `web-app-security-assessment` (delegates to the application checks: `auth-access-control-review`, `injection-handling-review`, `xss-output-encoding-review`, `ssrf-defence-review`, `csrf-protection-review`, `file-upload-security-review`, `jwt-validation-review`, `security-headers-review`, `api-security-review`)
- Run the security suite / security smoke in CI → `security-regression-suite`
- Cloud / Kubernetes / Docker / network posture → `cloud-security-review` (→ `aws-security-review`, `azure-security-review`, `kubernetes-security-audit`, `docker-security-review`, `network-security-review`)
- Dependencies, secrets, pipeline security → `dependency-vulnerability-audit` (+ secrets-detection, ci-cd-security-validation)
- Threat model / security architecture → `threat-modeling` (+ security-architecture-review)
- Secure code review / SAST → `secure-code-review`
- Security report with CVSS → `pentest-report-generator`

Route to a focused security skill directly only for a single-category request; otherwise start at the umbrella so coverage, evidence and reporting stay consistent.

### Risk, compliance & posture (defensive, evidence-based)
- Vendor / third-party risk, SBOM intake and VEX, CVE triage, SLAs and exceptions, KEV/EPSS threat intelligence, compliance mapping and audit evidence, risk register, posture metrics → `security-posture-management` (consumes the Penetration Testing findings; scans stay with dependency-vulnerability-audit, docker-security-review, cloud-security-review)

## Non-negotiables
- **Setup-first & generic.** On an unfamiliar repo, run `project-setup`; put project values in `qa.config.json`, never in skills.
- **Governance (enforced by hooks, not memory):** no XPath; no `waitForTimeout`/network-idle waits; no duplicate page objects; no hard-coded test data; dependency injection via fixtures; web-first assertions; one priority + one feature tag per test; CI image matches the installed Playwright version. Waivers need a comment naming the rule, the reason and a ticket.
- **Security is defensive and authorised-only:** authorised, non-production targets; non-destructive checks; no exploit detail or credentials in output; scans gated by `gates.securityScan`.
- **Risk work is evidence-based:** vendors are assessed from the evidence they supply, never scanned or probed; threat intelligence comes from reputable public feeds, with source and date; accepting a risk needs a named approver (`gates.riskAcceptance`); compliance output maps evidence and never claims certification.
- **Evaluation & telemetry:** `deepeval` scores AI-output quality, `skill-evaluation` checks the skills are well-formed, `agent-telemetry` observes runs — distinct, complementary, and opt-in; no secrets or target data recorded.
- **Secret hygiene:** never read `.env*` or auth-state files; never print credentials.

## Evidence block (end every reply)
Request · Skills used · Changes (files) · Verification (`npm run verify` result; repeats for new tests) · Results/artifacts · Risks/follow-ups.

## Integrations & gates
Optional MCP: requirements tracker, knowledge base (RAG), Playwright MCP, telemetry backends, security data (an SBOM platform or GRC tool) — each may be absent. `gates` (in `qa.config.json`) require a person for: filing defects, writing to the knowledge base, pushing dashboards, running security scans, updating baselines, accepting a risk.
