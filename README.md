# Enterprise Playwright AI Skill Pack

[![Playwright](https://img.shields.io/badge/Playwright-1.49.1-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/Governance-Fail--Closed-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Allure](https://img.shields.io/badge/Reporting-Allure-FF7043?logo=qameta&logoColor=white)](https://allurereport.org/)

> **Autonomous Quality Engineering & Agentic Testing Framework for Enterprise Systems.**  
> Transforms conversational AI coding agents (Claude Code, Antigravity, and MCP-compatible platforms) into disciplined, production-grade SDET pairs that plan from project history, enforce architectural rules, execute layered test projects, and report verified evidence.


The complete setup and implementation guide is available in
[`docs/setup-guide.html`](docs/setup-guide.html)); open it in a browser.



## Executive Overview

The **Enterprise Playwright AI Skill Pack** provides an enterprise-ready testing and quality engineering framework. It eliminates fragile, one-shot code generation by channeling every testing, operational, security, and risk request through an **8-step deterministic execution rail** backed by modular skills, strict governance hooks, and historical grounding.

The full interactive implementation guide and reference manual is available in [`Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html`](Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html) (or [`docs/setup-guide.html`](docs/setup-guide.html)).

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │ ──▶ │ Orchestrator │ ──▶ │ Plan/Explore │ ──▶ │ Select Skill │
│  (Human/CI)  │     │ (CLAUDE.md)  │     │ (History/FS) │     │(Skill Tiers) │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│   Evidence   │ ◀── │   Execute    │ ◀── │    Verify    │ ◀── Governance
│(Allure Report│     │ (Impact-run) │     │ (npm verify) │     (Hooks/Linter)
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Core Architectural Pillars

### 1. Deterministic Orchestration (`CLAUDE.md` & `AGENTS.md`)
Every agent interaction follows a strict workflow:
1. **Understand & Ground**: Parse the request, map tickets, and inspect past defects, test plans, and architectural decisions.
2. **Explore Existing Estate**: Inspect existing page objects, modules, and fixtures before authoring new code to prevent duplication.
3. **Select Specialized Skills**: Route deterministically using the zero-drift skill manifest.
4. **Bottom-Up Implementation**: Author data factories first $\rightarrow$ page models $\rightarrow$ fixtures $\rightarrow$ specifications.
5. **Enforce Governance**: Automated hooks lint and check files after every tool edit.
6. **Static Verification**: Validate via strict type checking, lint rules, and architectural constraints (`npm run verify`).
7. **Impact Execution**: Run the narrowest affected test set with repeat executions (`--repeat-each=3`) for new tests.
8. **Structured Evidence**: Conclude every turn with a traceable evidence block.

### 2. Enforced Framework Governance
Architecture rules are enforced in code, not left to agent memory:
* **No XPath Locators**: Enforces accessible role-, label-, and test-id-first locators (`getByRole`, `getByLabel`, `getByTestId`).
* **No Arbitrary Sleeps**: Banned `waitForTimeout` and `networkidle` waits; requires web-first auto-retrying assertions.
* **No Duplicate Page Objects**: Enforces a single class name and single declared `readonly path` per route across `src/pages/`.
* **No Hard-Coded Test Data**: Literal emails, card numbers (Luhn validated), credentials, and absolute URLs are blocked in specs; dynamic data factories and fixtures are mandatory.
* **Dependency Injection**: Direct instantiation (`new ...Page()`) in tests is prohibited; all page models and clients are injected via `@fixtures`.
* **Strict Tagging**: Every specification must carry exactly one priority tag (`@P0`, `@P1`, `@P2`) and one feature tag.

### 3. Layered Intelligence & Historical Grounding
* Connects test design directly to project history (requirements $\rightarrow$ existing specs $\rightarrow$ historical defects $\rightarrow$ root cause analysis).
* Integrates with the `qa-knowledge` MCP server for hybrid retrieval (BM25 + semantic embeddings + knowledge graph).
* Generates retrieval-aware scenario briefs that prove acceptance criteria, probe boundary values, and construct regression guards for past production incidents.

### 4. Defensive, Authorized-Only Security & Posture
* **Application Security**: Covers OWASP Top 10 with non-destructive, authorized-only Playwright checks (auth/session security, BOLA/IDOR, injection handling, CSRF, security headers, SSRF defence).
* **Supply Chain & Infrastructure**: Dependency vulnerability audits, secret scanning, CI/CD pipeline hardening, and CIS cloud/container posture reviews.
* **Evidence-Based Posture Management**: Tracks CVE lifecycles, CISA KEV feeds, and EPSS metrics against priority SLAs; vendor systems are never scanned or probed.

### 5. Unified Allure Reporting
One reporting directory (`allure-results/`) aggregates every test execution across the estate:
* Playwright functional UI, API, accessibility, visual, and mobile specs.
* Pytest security regression probes and guardrail checks.
* Performance and load metrics (Locust, k6, Core Web Vitals).
* AI quality benchmarks, DeepEval/RAGAS evaluation scores, and release gate decisions.

---

## Quick Start & Verification

### Prerequisites
* **Node.js**: v18.0.0 or newer (LTS recommended)
* **Package Manager**: npm, pnpm, or yarn
* **Git**: Installed and initialized

### 1. Installation
Clone the repository and install project dependencies:
```bash
# Install dependencies
npm install

# Install Playwright browser binaries and OS dependencies
npx playwright install --with-deps
```

### 2. Verification Chain
Run the complete governance, type-checking, and lint verification suite:
```bash
npm run verify
```
*Executes `eslint .` (framework rules) $\rightarrow$ `tsc --noEmit` (strict types) $\rightarrow$ `node scripts/governance-check-all.mjs` (governance rules).*

### 3. Test Execution
```bash
# Execute all Playwright projects (functional, api, visual, a11y, security)
npm test

# Run critical path smoke tests
npm run test:smoke

# Run full regression suite
npm run test:regression

# Run specific project layer
npx playwright test --project=functional
npx playwright test --project=api
npx playwright test --project=security
```

---

## Onboarding into a Repository

### Automated Installation via `setup.sh`
Deploy the skill pack into an existing software project without overwriting custom work:

```bash
# Preview changes safely (dry-run mode)
./setup.sh --dry-run /path/to/your-repo

# Install pack into target repository
./setup.sh /path/to/your-repo
```

**Safety Guarantees of `setup.sh`:**
* Existing configuration files are never blindly overwritten; differing files are saved as `.pack-new` for review.
* `.claude/settings.json` is safely merged with automated backups stored in `.skill-pack-backup/<timestamp>/`.
* Pre-existing `CLAUDE.md` files are preserved, adding a single import directive (`@.agents/CLAUDE.pack.md`).
* Automatically symlinks skills into `.claude/skills` and runs the skill validation suite.

---

## Skill Catalogue Summary

The pack includes **47 specialized skills** categorized into distinct operational tiers:

| Tier | Category | Skills Count | Focus Areas |
|:---:|:---|:---:|:---|
| **1** | **Core Development** | 8 | Setup (`project-setup`), test generation (`playwright-test-generation`), page objects (`page-object-engineering`), locators (`locator-strategy`), test data (`test-data-management`), API contracts (`api-testing`, `contract-testing`). |
| **2** | **Execution & Operations** | 6 | CI/CD pipelines (`ci-cd-pipeline-config`), flakiness optimization (`regression-optimization`), suite migration (`migration-analysis`), root-cause analysis (`defect-analysis`), synthetic observability (`observability-monitoring`), SRE budgets (`sre-reliability`). |
| **3** | **Quality Engineering** | 4 | Visual regression (`visual-testing`), accessibility audits (`accessibility-testing`), Core Web Vitals (`performance-testing`), mobile emulation (`mobile-testing`). |
| **4** | **Governance & Meta** | 6 | Architecture governance (`framework-governance`), analytics (`reporting-analytics`), telemetry (`agent-telemetry`), skill quality (`skill-evaluation`), authoring (`skill-authoring`), AI evals (`deepeval`). |
| **5** | **Application Security** | 13 | Defensive web app assessment (`web-app-security-assessment`), auth reviews, injection handling, XSS, SSRF, CSRF, JWT validation, security headers, security regression suite. |
| **6** | **Infrastructure & Risk** | 10 | Dependency audits, secret detection, CI security, cloud security (AWS/Azure), container security (Docker/k8s), threat modeling (`threat-modeling`), posture management (`security-posture-management`). |

---

## Skill Pack Validation & Maintenance

Validate that skills, manifest files, and agent routing logic remain consistent and uncorrupted:

```bash
# Rebuild skills manifest deterministically
node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json

# Validate skill schemas, routing completeness, and trigger accuracy
node scripts/check-skills.mjs .agents/skills-manifest.json tests/skills/trigger-cases.json

# Generate markdown routing table from manifest
node scripts/generate-routing.mjs .agents/skills-manifest.json > routing.generated.md
```

*Continuous Integration:* The GitHub Actions workflow [`.github/workflows/skill-validation.yml`](.github/workflows/skill-validation.yml) runs these checks on every pull request to reject stale manifests or routing drift.

---

## Repository Layout

```text
enterprise-playwright-ai-skill-pack/
├── README.md                                                 # Executive architecture and operational overview
├── setup.sh                                                  # Non-destructive target repository installer
├── Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html # Comprehensive implementation manual
├── package.json                                              # Pinned dependencies and verification scripts
├── playwright.config.ts                                      # Layered test execution configuration
├── tsconfig.json                                             # Strict TypeScript configuration and path aliases
├── eslint.config.mjs                                         # Flat ESLint rules for Playwright and code governance
├── CLAUDE.md                                                 # Core orchestrator and agent behavioral instructions
├── AGENTS.md                                                 # Agent adapter instructions for multi-agent environments
│
├── src/                                                      # Test framework source implementation
│   ├── fixtures/
│   │   └── index.ts                                          # Dependency injection fixture extensions (@fixtures)
│   └── pages/
│       └── home.page.ts                                      # Standardized Page Object Model implementation
│
├── tests/                                                    # Test suites and routing validations
│   ├── functional/
│   │   └── smoke.spec.ts                                     # Baseline tagged smoke test suite
│   └── skills/
│       └── trigger-cases.json                                # Skill routing evaluation dataset (50+ cases)
│
├── .agents/                                                  # Pack configuration and skill modules
│   ├── qa.config.json                                        # Project settings, hosts, tags, and approval gates
│   ├── skills-manifest.json                                  # Machine-readable skill catalog manifest
│   └── skills/                                               # Specialized agent skills (47 directories)
│
├── .claude/                                                  # Agent tooling, permissions, and lifecycle hooks
│   ├── settings.json                                         # Granular tool permissions and hook registrations
│   ├── hooks/
│   │   ├── governance-check.sh                               # PostToolUse lint and syntax validator
│   │   └── stop-gate.sh                                      # Pre-completion fail-closed verification gate
│   └── agents/
│       └── governance-reviewer.md                            # Autonomous sub-agent for code governance review
│
├── .github/
│   └── workflows/
│       └── skill-validation.yml                              # CI pipeline for skill manifest and schema gating
│
├── docs/                                                     # Technical documentation and guides
│   └── setup-guide.html                                      # Standalone interactive offline guide
│
└── scripts/                                                  # Built-in governance and tooling automation
    ├── link-skills.sh                                        # Links .agents/skills into agent runtime folders
    ├── governance-check-all.mjs                              # Standalone governance enforcement engine
    ├── build-skill-manifest.mjs                              # Deterministic skill manifest generator
    ├── generate-routing.mjs                                  # Routing table documentation generator
    └── check-skills.mjs                                      # Skill linting and routing eval runner
```

---

## Non-Negotiables & Definition of Done

1. **Setup-First & Generic**: Project values live in [`.agents/qa.config.json`](.agents/qa.config.json) only—never hard-coded in skills or test files.
2. **Fail-Closed Governance**: Code is valid only when `npm run verify` exits with code `0`. Any waiver requires an inline reason and ticket reference (`// governance-disable-line <rule> -- <reason> (<TICKET-123>)`).
3. **Strict Target Safety**: Production hosts listed in `project.protectedHosts` must never be targeted by automated suites. All tests execute against approved `project.allowedHosts`.
4. **Secret Hygiene**: Zero tolerance for credentials in code, git history, or agent transcripts. Never read `.env*` or auth state storage directly.
5. **Traceable Evidence**: Every completed agent interaction must conclude with the standard evidence block:
   ```text
   Request · Skills used · Changes (files) · Verification · Results/artifacts · Risks/follow-ups
   ```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
