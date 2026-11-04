---
name: framework-governance
description: >-
  Enterprise architecture governance for a Playwright TypeScript framework: enforces no XPath, no
  waitForTimeout, no duplicate page objects, no hard-coded test data and dependency injection
  through fixtures, using ESLint, dependency rules, a governance script, Claude Code hooks and
  review checklists, with a waiver process. Use whenever the user asks to set up, audit, enforce
  or review framework standards, coding rules, lint rules, architecture boundaries, or whether
  changes follow the framework conventions, and before reporting any test-code change as done.
  Not for writing new tests (playwright-test-generation).
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Framework governance

Rules that are enforced by tools, not by memory. Every rule below has a check that fails the
build.

## Non-negotiables
- Every rule is enforced by a tool and fails the build; none depends on memory or review alone.
- `npm run verify` is the single command that hooks, CI and people run, and nothing is reported done while it fails.
- A rule may be waived only with a comment naming the rule, the reason and a ticket; stale waivers fail.

## Rules and enforcement
| Rule | Enforced by |
|---|---|
| **No XPath** | ESLint `no-restricted-syntax` on `locator()` / `frameLocator()` strings starting with `xpath=` or `//`; the governance script as a backstop |
| **No `waitForTimeout`** (and no `networkidle`, no sleeps) | `playwright/no-wait-for-timeout`, `playwright/no-networkidle` |
| **No duplicate page objects** | the governance script: one class name and one `readonly path` per route across `src/pages` |
| **No hard-coded test data** | the governance script flags literal emails, card numbers, passwords and absolute URLs in `tests/`, `src/pages/`, `src/modules/` (opt-out comment requires a reason) |
| **Dependency injection** | ESLint bans `new …Page()` / `new …Module()` in `tests/**`; dependency rules: specs import only `@fixtures`, pages are leaves |
| Web-first assertions; no `expect` in pages | `playwright/prefer-web-first-assertions`; `no-restricted-imports` in `src/pages/**` |
| No focused or paused tests, no element handles, no `force` | `playwright/no-focused-test`, `no-page-pause`, `no-element-handle`, `no-force-option` |
| Tags: one priority plus one feature tag | the governance script lists tests (`npx playwright test --list --reporter=json`) and checks tags |
| Container image equals the Playwright version | the governance script compares CI files with `@playwright/test` |
| Nothing reported done while checks fail | Claude Code hooks: PostToolUse lints each edited file; Stop runs the verify script |

## ESLint core (flat config)
```javascript
// @skill-example: fragment — eslint.config.mjs
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';
const XPATH = { selector: "CallExpression[callee.property.name=/^(locator|frameLocator)$/] > Literal[value=/^(xpath=|\\(*\\u002F\\u002F)/]", message: 'No XPath: follow the locator priority.' };
export default tseslint.config(
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts', 'tests/**/*.ts'], ...playwright.configs['flat/recommended'],
    rules: { 'playwright/no-wait-for-timeout': 'error', 'playwright/no-networkidle': 'error', 'playwright/prefer-web-first-assertions': 'error',
             'playwright/no-element-handle': 'error', 'playwright/no-force-option': 'error', 'playwright/no-focused-test': 'error', 'no-console': 'error',
             'no-restricted-syntax': ['error', XPATH] } },
  { files: ['tests/**/*.ts'], rules: { 'playwright/no-raw-locators': 'error',
    'no-restricted-syntax': ['error', XPATH, { selector: 'NewExpression[callee.name=/(Page|Module)$/]', message: 'Inject pages and modules through fixtures.' }] } },
  { files: ['src/pages/**/*.ts'], rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@playwright/test', importNames: ['expect'], message: 'Assertions belong in specs.' }] }] } },
);
```

## Verify script
`"verify": "eslint . --max-warnings=0 && tsc --noEmit && node scripts/governance-check-all.mjs"` — the single command that hooks, CI and people all run. `scripts/governance-check-all.mjs` ships with the pack and is the governance script in the table above; waive one line with `// governance-disable-next-line <rule> -- <reason> (<TICKET>)`. Once dependency rules are enforced with dependency-cruiser, append `&& depcruise src tests --config .dependency-cruiser.cjs`.

## Claude Code hooks (`.claude/settings.json`)
- **PostToolUse** on `Edit|Write|MultiEdit`: run ESLint on the edited TypeScript file; exit 2 with the errors so Claude fixes them before continuing.
- **Stop**: when test code changed, run the verify script; exit 2 on failure (respect `stop_hook_active` to avoid loops).

## Waivers
A rule may be waived only with a comment naming the rule, the reason and a ticket, for example `// eslint-disable-next-line playwright/no-raw-locators -- third-party widget, no accessible name (PROJ-456)`. ESLint `reportUnusedDisableDirectives: 'error'` removes stale waivers. Waivers are listed in each review.

## Procedure
1. Get the changed files (`git diff --name-only origin/main...`).
2. Run the verify script; any failure blocks.
3. Read each file against the table: layer placement, locator priority, data sourcing, tags, assertions, waits.
4. Report a table: file, rule, line, block or warn, fix. Say "No blocking issues" only when verify passes and nothing blocks.

## Definition of Done
- Verify passes; no unexplained waivers; review table delivered.
