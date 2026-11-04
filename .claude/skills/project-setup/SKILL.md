---
name: project-setup
description: >-
  Reads an unfamiliar repository and sets the pack up in it, generically. First it discovers the
  stack read-only (package manager, Node, any existing Playwright config and tests, ESLint/tsconfig,
  the test-id attribute, base URL and environments, CI platform, app type, existing page objects and
  fixtures, and any legacy suites), writes the project-specific values into .agents/qa.config.json,
  and then scaffolds only what is missing so that `npm run verify` and the layered Playwright
  projects actually run. Use whenever the user installs or onboards the pack, points it at a new or
  existing repository, asks to bootstrap, initialise or set up the framework, or says "make this
  work in my project". Not for ongoing rule enforcement (framework-governance), converting a legacy
  suite (migration-analysis), or writing feature tests (playwright-test-generation). Discovery is
  read-only and nothing is overwritten without confirmation.
metadata:
  tier: "1"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Project setup

Meet the repository where it is. **Read what already exists first, then create only what is
missing**, and write project-specific values into config rather than hard-coding them — so the pack
is generic and runs on any repo. Setup is the orchestrator's first step on an unfamiliar project;
until it is done, the governance hooks (which call `eslint` and `npm run verify`) have nothing to
run.

## Non-negotiables
- **Discovery is read-only.** Produce a discovery report before writing anything. Never read `.env*`, secrets or auth-state files.
- **Generic, never hard-coded.** Project-specific values (base URL, test-id attribute, environment names, Playwright version, CI platform) live in `.agents/qa.config.json` only — never baked into skills or specs.
- **Create only what is missing.** Never overwrite an existing config, test or page object without showing a diff and getting confirmation. Respect the repo's existing choices (package manager, test-id attribute, folder layout).
- **Done means runnable.** Setup is complete only when `npm run verify` exists and passes and a smoke test runs green — otherwise the hooks are inert.
- **Hand off, don't duplicate:** a legacy suite → `migration-analysis`; no tests yet → `playwright-test-generation`; ongoing enforcement → `framework-governance`.

## Phase 1 — Read the repo (discovery, read-only)
| Signal | Where to look | Used for |
|---|---|---|
| Package manager | `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` | which install/run commands to use |
| Node version | `.nvmrc`, `engines`, CI files | toolchain |
| Existing Playwright | `playwright.config.*` | reuse vs. scaffold |
| Existing tests | `tests/**`, `**/*.spec.*`, `e2e/**`, `cypress/**` | don't duplicate; infer the layout |
| ESLint / TypeScript | `eslint.config.*` / `.eslintrc*` / `tsconfig.json` | reuse vs. scaffold; the `verify` chain |
| Test-id attribute | existing `getByTestId` / `data-test*` usage | `framework.testIdAttribute` |
| Base URL / environments | README, CI, `.env.example` (names only) | `project.environments`, `defaultEnv`, `protectedHosts` |
| CI platform | `.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `Jenkinsfile` | `ci.platform` |
| App type | deps (react/vue/next; express/fastify) | which skills apply |
| Page objects / fixtures | `src/pages`, `@fixtures` alias | reuse — don't recreate |
| Legacy suites | `*.robot`, Selenium/Cypress/TestNG markers | hand to `migration-analysis` |

Write a short discovery report: what exists, what's missing, and the detected values.

## Phase 2 — Set up (create only what is missing)
| Artifact | Create if missing | Why |
|---|---|---|
| `.agents/qa.config.json` | populate from discovery | the one place project values live |
| `package.json` scripts | `verify` + test scripts | makes the governance hooks runnable |
| ESLint flat config | the five governance rules | what `framework-governance` enforces |
| `tsconfig.json` | strict TS for tests | the `verify` chain |
| `playwright.config.ts` | layered projects + reporters, pinned to the detected version | execution |
| `@fixtures` | `test` + `apiAs(role)` fixtures | dependency injection |
| one example page object + spec | a passing smoke per layer | proves it runs |
| skill links | `scripts/link-skills.sh` | expose skills to Claude Code |

## Templates
```jsonc
// @skill-example: fragment — package.json (makes the hooks runnable)
{
  "scripts": {
    "verify": "eslint . --max-warnings=0 && tsc --noEmit && node scripts/governance-check-all.mjs",
    "test": "playwright test"
  },
  "devDependencies": { "@playwright/test": "1.64.1", "eslint": "^9", "eslint-plugin-playwright": "^2", "typescript": "^5" }
}
```
```javascript
// @skill-example: fragment — eslint.config.mjs (the five governance rules, enforceable)
import playwright from 'eslint-plugin-playwright';
export default [
  playwright.configs['flat/recommended'],              // bans waitForTimeout, networkidle waits, etc.
  { files: ['**/*.ts', '**/*.tsx'], rules: {
    'no-restricted-syntax': ['error',
      { selector: "CallExpression[callee.property.name='locator'] > Literal[value=/^(xpath=|\\/\\/)/]", message: 'No XPath locators — use role/label/test-id (locator-strategy).' },
      { selector: "NewExpression[callee.name=/Page$/]", message: 'No new …Page() in specs — inject via fixtures.' },
    ],
  }},
];
```
```typescript
// @skill-example: fragment — playwright.config.ts (layered projects; version from qa.config.json)
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  reporter: [['html'], ['blob']],
  use: { baseURL: process.env.BASE_URL, testIdAttribute: 'data-testid' },
  projects: [
    { name: 'functional', testDir: 'tests/functional' },
    { name: 'api',        testDir: 'tests/api' },
    { name: 'visual',     testDir: 'tests/visual' },
    { name: 'a11y',       testDir: 'tests/a11y' },
    { name: 'security',   testDir: 'tests/security', grep: /@security/, retries: 0 },
  ],
});
```
```jsonc
// @skill-example: fragment — .agents/qa.config.json (populated from discovery, not invented)
{
  "project":   { "name": "<detected>", "environments": ["dev","staging"], "defaultEnv": "staging", "protectedHosts": [] },
  "framework": { "root": ".", "playwrightVersion": "<detected>", "testIdAttribute": "<detected>", "fixturesImport": "@fixtures" },
  "ci":        { "platform": "<detected>" },
  "gates":     { "fileDefects": "ask", "securityScan": "ask", "updateBaselines": "ask" }
}
```

## Procedure
1. **Discover** (read-only): inspect the signals above; write the discovery report; detect project values.
2. **Config**: draft `.agents/qa.config.json` from the detected values and show it; don't invent values.
3. **Scaffold only what is missing** (package.json `verify`, the ESLint five-rule config, tsconfig, playwright.config, fixtures, one example spec/page object); show diffs; never overwrite without confirmation.
4. **Link** the skills and ensure `npm run verify` exists.
5. **Prove it**: run `npm run verify` and one smoke test — both green. Route any legacy suite to `migration-analysis`, an empty suite to `playwright-test-generation`.
6. **Report** what was found and what was created.

## Definition of Done
- Discovery report produced; `.agents/qa.config.json` populated from real detected values; nothing project-specific hard-coded in skills.
- Only-missing artifacts scaffolded; nothing overwritten without confirmation.
- `npm run verify` exists and passes and a smoke test runs green — the governance hooks are now live.
