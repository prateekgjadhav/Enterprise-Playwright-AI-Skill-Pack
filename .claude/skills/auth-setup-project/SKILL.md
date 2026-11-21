---
name: auth-setup-project
description: >-
  Implements the Playwright setup project that signs in once per configured role through the secret
  provider and saves storage state to .auth/<role>.json, git-ignored and never uploaded, with every
  browser-and-role project depending on it. Use whenever tests need an authenticated session, specs
  log in through the UI repeatedly, or storage state handling must be fixed. Not for role-by-action
  permission tests (multi-role-auth), credentials adapters (secret-provider-fixture), or session
  security testing (authz-session-testing).
allowed-tools: Read Grep Glob Edit(tests/auth.setup.ts) Edit(playwright.config.ts) Bash(npx playwright test --list)
---

# Authentication setup project

Sign in once per role, reuse the state, and never let it leave the runner.

## Non-negotiables
- Credentials come from `secretProvider.get(ref)`; never literals, never printed.
- `.auth/` is git-ignored, excluded from artifacts and deleted by the scrubber.
- State is never shared between environments or roles.

## Inputs and outputs
- **In:** `framework.roles`; `secrets.refs` for each role
- **Out:** `tests/auth.setup.ts`; projects that depend on `setup`

## Procedure
1. For each role, sign in through the sign-in module using the secret provider.
2. Save `page.context().storageState({ path: '.auth/<role>.json' })`.
3. Confirm the browser-and-role projects in `playwright.config.ts` use `storageState` and `dependencies: ['setup']`.
4. Confirm `.auth/` is in `.gitignore`.

## Verify
- `npx playwright test --list` shows setup and the role projects
- `git check-ignore .auth/x.json` succeeds

## Evidence
Add to the evidence block: roles provisioned (names only). Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every role signs in once per run and the state never reaches git or artifacts.
