# Enterprise Playwright AI Skill Pack

<p align="center">
  <img src="https://playwright.dev/img/playwright-logo.svg" alt="Playwright Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>The Autonomous Quality Engineering & AI-Assisted Testing Framework for Enterprise Systems</strong><br>
  <em>Turn AI coding agents into disciplined, production-grade SDETs that plan from history, enforce architecture, and deliver verified evidence.</em>
</p>

<p align="center">
  <a href="https://playwright.dev/"><img src="https://img.shields.io/badge/Playwright-v1.49.1-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6_Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://eslint.org/"><img src="https://img.shields.io/badge/Governance-Fail--Closed-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint Governance" /></a>
  <a href="https://allurereport.org/"><img src="https://img.shields.io/badge/Reporting-Allure_Framework-FF7043?style=for-the-badge&logo=qameta&logoColor=white" alt="Allure Reporting" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" /></a>
</p>

---

## Table of Contents

- [Why Enterprise Playwright AI Skill Pack?](#why-enterprise-playwright-ai-skill-pack)
- [The 8-Stage Execution Rail](#the-8-stage-execution-rail)
- [Core Architectural Pillars](#core-architectural-pillars)
  - [1. Deterministic Agent Orchestration](#1-deterministic-agent-orchestration)
  - [2. Enforced Fail-Closed Governance](#2-enforced-fail-closed-governance)
  - [3. Historical Grounding & RAG Intelligence](#3-historical-grounding--rag-intelligence)
  - [4. Defensive Security & Risk Posture](#4-defensive-security--risk-posture)
  - [5. Unified Multi-Tier Reporting](#5-unified-multi-tier-reporting)
- [Before vs. After: The Governance Advantage](#before-vs-after-the-governance-advantage)
- [Quick Start & Local Verification](#quick-start--local-verification)
- [Target Repository Onboarding](#target-repository-onboarding)
- [Complete Skill Catalogue](#complete-skill-catalogue)
- [CI/CD Pipeline Integration](#cicd-pipeline-integration)
- [Repository Layout](#repository-layout)
- [The Non-Negotiables & Definition of Done](#the-non-negotiables--definition-of-done)
- [Documentation & Resources](#documentation--resources)

---

## Why Enterprise Playwright AI Skill Pack?

Standard Large Language Models generate fragile automated tests. When tasked with test creation, ad-hoc AI tools frequently introduce **critical test-debt**:
- Unstable XPath and brittle CSS selectors that break across dynamic re-renders.
- Hardcoded sleeps (`waitForTimeout`) that disguise race conditions and multiply CI execution times.
- Fabricated mock data and credentials hard-coded directly into source files.
- Duplicate page objects created for existing routes, fragmenting framework architecture.
- Ungrounded assertions that fail to validate actual business requirements or historical failure modes.

The **Enterprise Playwright AI Skill Pack** solves this by wrapping agent tools (Claude Code, Antigravity, and MCP-compatible environments) in a **deterministic, fail-closed quality framework**.

| Challenge | Ad-Hoc AI Coding | Enterprise Playwright AI Skill Pack |
| :--- | :--- | :--- |
| **Locators** | Brittle XPath / complex CSS (`//div[2]/button`) | Strict role-, label-, and test-id-first locators (`getByRole`, `getByTestId`) |
| **Synchronization** | Arbitrary sleeps (`await page.waitForTimeout(5000)`) | Pure web-first auto-retrying assertions with bounded polling |
| **Architecture** | Monolithic, copy-pasted test scripts | Strict Page Object Models + Dependency Injection via `@fixtures` |
| **Test Data** | Hard-coded emails, passwords, and tokens | Isolated factories, unique workers, automatic teardown, zero credential leaks |
| **Grounding** | Hallucinated requirements and guess-work | RAG-grounded in requirements, tickets, defect history, and root causes |
| **Safety** | May execute unsafe commands on live endpoints | Strict protected host denylists (`project.protectedHosts`), zero production access |
| **Reporting** | Ephemeral, unstructured terminal text | Unified Allure reporting with traces, videos, categories, and evidence blocks |

---

## The 8-Stage Execution Rail

Every request—whether issued by a quality engineer, developer, or CI workflow—is routed through a standardized 8-step execution rail defined in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE 8-STAGE EXECUTION RAIL                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
    [1] Request       ──▶ Ingested via developer prompt, ticket ID, or CI dispatch.
         │
    [2] Orchestrator  ──▶ CLAUDE.md / AGENTS.md evaluates intent & project context.
         │
    [3] Plan & Ground ──▶ qa-knowledge MCP retrieves past tests, defects, and RCA logs.
         │
    [4] Explore Repo  ──▶ Read-only scan of existing pages, modules, and fixtures.
         │
    [5] Select Skills ──▶ Route to specialized skills from the verified 47-skill matrix.
         │
    [6] Governance    ──▶ PostToolUse hooks lint code and enforce the 5 core framework rules.
         │
    [7] Verify        ──▶ Execute static analysis: ESLint + TypeScript + governance engine.
         │
    [8] Execute & Rep ──▶ Run impact-targeted tests (--repeat-each=3); generate Allure report.
```

---

## Core Architectural Pillars

### 1. Deterministic Agent Orchestration
- **Single Source of Truth**: [`CLAUDE.md`](CLAUDE.md) directs every agent behavior. On an unfamiliar repository, it automatically invokes `project-setup` first to discover the stack and scaffold missing configs.
- **Zero-Drift Routing**: Skills are catalogued in [`.agents/skills-manifest.json`](.agents/skills-manifest.json). Routing is generated deterministically (`scripts/generate-routing.mjs`) and validated in CI (`scripts/check-skills.mjs`).
- **Bottom-Up Construction Order**: Data factories $\rightarrow$ Page Objects $\rightarrow$ Fixtures $\rightarrow$ Specifications.

### 2. Enforced Fail-Closed Governance
Framework rules are enforced via executable hooks in `.claude/hooks/` and standalone Node.js validation scripts (`scripts/governance-check-all.mjs`):
1. **No XPath Locators**: Disallows `xpath=` and `//` selectors in `locator()` and `frameLocator()`.
2. **No Arbitrary Sleeps**: Banned `page.waitForTimeout()` and `networkidle` waits. Requires web-first assertions (`await expect(locator).toBeVisible()`).
3. **No Duplicate Page Objects**: Enforces a single class name and single declared `readonly path` per route across `src/pages/`.
4. **No Hard-Coded Data**: Rejects literal emails, card numbers (Luhn checked), passwords, tokens, and absolute URLs.
5. **Mandatory Fixture Injection**: Forbids manual instantiation (`new LoginPage()`) inside specs. All dependencies are injected via `@fixtures`.
6. **Strict Tagging**: Every test must specify exactly one priority tag (`@P0`, `@P1`, `@P2`) and one feature tag (e.g. `@login`, `@checkout`).

> **Waiver Protocol:** Waivers require an explicit inline justification and ticket reference:  
> `// governance-disable-line no-xpath -- Legacy modal lacks accessible role (TICKET-1042)`

### 3. Historical Grounding & RAG Intelligence
- Test design is anchored in reality: Feature requirements $\rightarrow$ existing specs $\rightarrow$ historical defects $\rightarrow$ Root Cause Analyses (RCAs).
- Built-in `qa-knowledge` MCP server provides hybrid search (BM25 for exact codes/stack traces + vector search for semantic requirements + graph search for multi-hop traceability).
- High-fidelity scenario generation: Maps acceptance criteria into positive, negative, boundary, role-permission, and regression guard specs.

### 4. Defensive Security & Risk Posture
- **Defensive Application Security**: Authorised-only security testing covering OWASP Top 10 vulnerabilities (BOLA/IDOR, broken authentication, injection, CSRF, security headers, and SSRF defense).
- **Zero Production Targeting**: Production hosts configured in `project.protectedHosts` are blocked at the network/guardrail layer.
- **Supply Chain & Posture**: Dependency auditing, secret scanning, CI/CD pipeline hardening, and CISA KEV / FIRST EPSS vulnerability prioritization via `security-posture-management`. Vendor systems are never probed or scanned.

### 5. Unified Multi-Tier Reporting
All execution outputs aggregate into a centralized Allure report directory (`allure-results/`):
- Functional, visual, API, accessibility, and mobile specs via `allure-playwright`.
- Security regression probes and fuzzing via `allure-pytest`.
- Load, stress, and Core Web Vitals performance benchmarks.
- AI evaluation scores (DeepEval, RAGAS) and AI release gate decisions.

---

## Before vs. After: The Governance Advantage

```typescript
// ❌ UNGOVERNED AI GENERATION (Brittle, Flaky, Insecure)
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page); // ❌ Direct instantiation
  await page.goto('https://staging.acme.com/login'); // ❌ Hardcoded absolute URL
  await page.locator('//input[@id="user_email"]').fill('admin@acme.com'); // ❌ XPath + Hardcoded email
  await page.locator('//input[@name="pwd"]').fill('Secret123!'); // ❌ XPath + Hardcoded secret
  await page.locator('button.btn-primary').click();
  await page.waitForTimeout(5000); // ❌ Arbitrary sleep / race condition
  expect(await page.locator('h1').innerText()).toBe('Dashboard'); // ❌ Non-retrying assertion
});
```

```typescript
// ✅ ENTERPRISE PLAYWRIGHT AI SKILL PACK (Governed, Resilient, Accessible)
import { test, expect } from '@fixtures'; // ✅ Dependency injection alias

test.describe('Authentication Flows', () => {
  test('valid user authenticates successfully @P0 @smoke @auth', async ({ loginPage, userFactory }) => {
    // ✅ Data created uniquely per worker; credentials sourced from secret store/fixture
    const user = userFactory.createValidUser();
    
    // ✅ Relative navigation leveraging configured baseURL
    await loginPage.goto();
    
    // ✅ Accessible role-based interactions; auto-waiting web assertions
    await loginPage.login(user.username, user.password);
    await expect(loginPage.dashboardHeading).toBeVisible();
  });
});
```

---

## Quick Start & Local Verification

### Prerequisites
- **Node.js**: `18.0.0` or newer (LTS recommended)
- **Git**: Installed and initialized in your repository
- **OS**: macOS, Linux, or Windows (WSL / Git Bash / PowerShell)

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Download Playwright browser binaries
npx playwright install --with-deps
```

### Verification Chain
Run the complete static governance, type-checking, and lint pipeline:
```bash
npm run verify
```
*Executes `eslint .` (framework rules) $\rightarrow$ `tsc --noEmit` (strict types) $\rightarrow$ `node scripts/governance-check-all.mjs` (governance rules).*

### Test Execution
```bash
# Run all configured test projects
npm test

# Run smoke test suite (@smoke)
npm run test:smoke

# Run regression test suite (@regression)
npm run test:regression

# Target isolated project layers
npx playwright test --project=functional
npx playwright test --project=api
npx playwright test --project=security
```

---

## Target Repository Onboarding

Deploy the skill pack into an existing software project without overwriting custom work:

```bash
# 1. Preview changes (Dry-Run mode)
./setup.sh --dry-run /path/to/your-repo

# 2. Install pack into target repository
./setup.sh /path/to/your-repo
```

### Safety Guarantees
- **Non-Destructive**: Pack files that differ from your existing codebase are saved as `.pack-new` for side-by-side comparison.
- **Config Preservation**: Merges `.claude/settings.json` permissions and hooks safely, creating an automated backup under `.skill-pack-backup/<timestamp>/`.
- **Orchestrator Import**: Keeps existing `CLAUDE.md` files intact by appending an `@.agents/CLAUDE.pack.md` import line.
- **Automated Discovery**: Launch Claude Code or Antigravity and prompt: *"Set up the project"*. The `project-setup` skill inspects the repo read-only, detects runtime parameters, writes `.agents/qa.config.json`, and scaffolds missing files.

---

## Complete Skill Catalogue

The framework provides **47 specialized skills** structured across 6 core operational domains:

```
.agents/skills/
├── 1. Core Development (8 skills)
│   ├── project-setup                # Discovers repository & scaffolds missing estate
│   ├── test-scenario-design         # Retrieval-aware scenario briefs from history
│   ├── playwright-test-generation   # Core TypeScript Playwright test authoring
│   ├── page-object-engineering      # Standardized Page Object architecture
│   ├── locator-strategy             # Accessible role- & test-id selector governance
│   ├── test-data-management         # Factory-driven dynamic data & teardown
│   ├── api-testing                  # Request-level REST API and schema validation
│   └── contract-testing             # Consumer-driven contract & drift verification
│
├── 2. Execution & Operations (6 skills)
│   ├── ci-cd-pipeline-config        # Sharded, optimized CI pipelines
│   ├── regression-optimization      # Flakiness eradication & test quarantine
│   ├── migration-analysis           # Porting Cypress/Selenium/Robot to Playwright
│   ├── defect-analysis              # Root-cause analysis from traces & videos
│   ├── observability-monitoring     # Synthetic monitors & health probe validation
│   └── sre-reliability              # SLI/SLO budgets & chaos resilience testing
│
├── 3. Quality Engineering (4 skills)
│   ├── visual-testing               # Screenshot comparison & baseline management
│   ├── accessibility-testing        # Automated axe-core & WCAG 2.2 AA validation
│   ├── performance-testing          # Core Web Vitals (LCP, CLS, INP) & load checks
│   └── mobile-testing               # Mobile web emulation, touch & responsive tests
│
├── 4. Governance & Meta (6 skills)
│   ├── framework-governance         # Enterprise architecture & coding rule audits
│   ├── reporting-analytics          # Test metrics, trend analytics & release gating
│   ├── agent-telemetry              # Agent token, latency & routing observability
│   ├── skill-evaluation             # Skill linting, overlap & accuracy benchmark
│   ├── skill-authoring              # Meta-skill for authoring new skills
│   └── deepeval                     # DeepEval LLM-output regression benchmarking
│
├── 5. Application Security (13 skills)
│   ├── web-app-security-assessment  # Defensive OWASP Top 10 assessment umbrella
│   ├── auth-access-control-review   # Session management, BOLA & IDOR verification
│   ├── api-security-review          # Broken object & function level auth testing
│   ├── injection-handling-review    # SQL, NoSQL, and OS command injection checks
│   ├── xss-output-encoding-review   # Stored, reflected, and DOM XSS verification
│   ├── ssrf-defence-review          # Server-side request forgery defense checks
│   ├── csrf-protection-review       # Anti-CSRF token & SameSite cookie review
│   ├── file-upload-security-review  # Malicious upload & path traversal validation
│   ├── jwt-validation-review        # Token algorithm tampering & expiry validation
│   ├── security-headers-review      # CSP, HSTS, CORS, and clickjacking checks
│   ├── secure-code-review           # Static source code security review (SAST)
│   ├── security-regression-suite    # Assembles security checks into CI regression
│   └── pentest-report-generator     # Findings aggregation with CVSS v3.1 scoring
│
└── 6. Infrastructure, Risk & Posture (10 skills)
    ├── dependency-vulnerability-audit # SCA dependency scanning & SBOM generation
    ├── secrets-detection            # Leaked secret detection in history & commits
    ├── ci-cd-security-validation    # Pipeline hardening & action SHA pinning
    ├── cloud-security-review        # Multi-cloud CIS security benchmark audits
    ├── aws-security-review          # AWS IAM, S3, and CloudTrail posture review
    ├── azure-security-review        # Azure Entra ID, NSG, and Key Vault review
    ├── kubernetes-security-audit    # k8s RBAC and Pod Security Standard audits
    ├── docker-security-review       # Dockerfile linting & base-image hardening
    ├── network-security-review      # Network segmentation & TLS posture review
    └── security-posture-management  # Programme-level CVE/KEV/EPSS risk register
```

---

## CI/CD Pipeline Integration

Here is a recommended GitHub Actions workflow utilizing the pack's verification chain and sharded Playwright runners:

```yaml
name: Quality Gate & Test Execution

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    name: Governance & Static Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: Run Verification Chain
        run: npm run verify

  test:
    name: Playwright Tests
    needs: verify
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium
      - name: Execute Sharded Suite
        run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - name: Upload Allure Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: allure-results-${{ matrix.shardIndex }}
          path: allure-results/
          retention-days: 7
```

---

## Repository Layout

```text
enterprise-playwright-ai-skill-pack/
├── README.md                                                 # Executive architecture and framework guide
├── setup.sh                                                  # Non-destructive target repository installer
├── Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html # Complete reference manual
├── package.json                                              # Pinned dependencies & verification scripts
├── playwright.config.ts                                      # Multi-project test execution configuration
├── tsconfig.json                                             # Strict TypeScript config with @fixtures path alias
├── eslint.config.mjs                                         # Flat ESLint rules for Playwright & governance
├── CLAUDE.md                                                 # Primary orchestrator for AI agent workflows
├── AGENTS.md                                                 # Multi-agent standard instructions adapter
│
├── src/                                                      # Test framework source code
│   ├── fixtures/
│   │   └── index.ts                                          # Fixture extensions & dependency injection
│   └── pages/
│       └── home.page.ts                                      # Standardized Page Object Model implementation
│
├── tests/                                                    # Test suites and routing validations
│   ├── functional/
│   │   └── smoke.spec.ts                                     # Baseline tagged smoke test suite
│   └── skills/
│       └── trigger-cases.json                                # Skill routing evaluation dataset (50+ cases)
│
├── .agents/                                                  # Skill modules and configuration
│   ├── qa.config.json                                        # Project settings, hosts, tags, and approval gates
│   ├── skills-manifest.json                                  # Machine-readable skill catalog manifest
│   └── skills/                                               # 47 modular agent skills
│
├── .claude/                                                  # Agent tooling, permissions, and hooks
│   ├── settings.json                                         # Permissions and hook registrations
│   ├── hooks/
│   │   ├── governance-check.sh                               # PostToolUse lint and syntax validator
│   │   └── stop-gate.sh                                      # Fail-closed pre-completion verify gate
│   └── agents/
│       └── governance-reviewer.md                            # Autonomous sub-agent for code governance review
│
├── .github/
│   └── workflows/
│       └── skill-validation.yml                              # CI pipeline for skill manifest validation
│
├── docs/                                                     # Technical documentation
│   └── setup-guide.html                                      # Standalone interactive offline HTML guide
│
└── scripts/                                                  # Framework tooling & governance scripts
    ├── link-skills.sh                                        # Links .agents/skills into agent runtime folders
    ├── governance-check-all.mjs                              # Standalone governance enforcement engine
    ├── build-skill-manifest.mjs                              # Deterministic skill manifest generator
    ├── generate-routing.mjs                                  # Routing documentation generator
    └── check-skills.mjs                                      # Skill linting and routing benchmark runner
```

---

## The Non-Negotiables & Definition of Done

Every agent response and pull request must strictly comply with the following standards:

1. **Setup-First & Generic**: Project values reside in [`.agents/qa.config.json`](.agents/qa.config.json) only—never hard-coded into skills or specs.
2. **Fail-Closed Governance**: `npm run verify` must pass with exit code `0`. Any waiver requires an inline reason and ticket reference.
3. **Target Protection**: Production hosts in `project.protectedHosts` must never be targeted by automated suites. All tests execute exclusively against approved non-production environments (`project.allowedHosts`).
4. **Secret Hygiene**: Zero tolerance for credentials in code, git history, or agent transcripts. Never read `.env*` or auth state files directly.
5. **Standard Evidence Block**: Every agent interaction concludes with the mandatory evidence block:
   ```text
   Request · Skills used · Changes (files) · Verification · Results/artifacts · Risks/follow-ups
   ```

---

## Documentation & Resources

- 📘 **[Setup and Implementation Guide](docs/setup-guide.html)**: Interactive offline guide covering all architecture tiers, security protocols, and RAG configuration.
- 🎭 **[Official Playwright Documentation](https://playwright.dev/docs/intro)**: Playwright guides, API reference, and locator strategies.
- 🛡️ **[OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)**: Benchmark testing methodologies for web applications.

---

## License

Distributed under the [MIT License](LICENSE).
