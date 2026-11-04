---
name: security-regression-suite
description: >-
  Assembles the focused security checks into a maintainable, non-destructive Playwright regression
  suite for an application the team owns: consistent `tests/security/` layout, `@security` tagging
  and the `security` project, a stable baseline so only new findings fail, and CI wiring that runs
  the deterministic checks on every pipeline and heavier passive scans on a schedule. Use whenever
  the user asks to generate a security regression suite, a "Playwright security scanner/validator"
  that runs repeatably, a security smoke/baseline for CI, or to organise existing security tests.
  Not for authoring a single category's checks (the focused *-review skills) or general CI
  structure (ci-cd-pipeline-config). It runs and organises the defensive checks; it adds no
  offensive scanning.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Security regression suite

The runner that ties the focused security skills together so a release can be re-checked in one
command. Deterministic control checks gate every pipeline; the passive baseline scan runs on a
schedule. Nothing here attacks the application.

## Non-negotiables
- Authorised, non-production targets only (`staging`/`dev`); never `protectedHosts`. Active/passive scans stay gated (`gates.securityScan: "ask"`).
- Compose only the defensive checks from the `*-review` skills; the suite proves controls hold and is not an exploitation harness.
- Deterministic, non-destructive checks run on every pipeline; a stable baseline means only *new* findings fail the build.
- Tags follow governance (one priority + one feature, plus `@security`); no secrets or tokens in specs or artifacts.

## Suite layout
| Path | Holds | From |
|---|---|---|
| `tests/security/access-control.*` | A01/A07 checks | auth-access-control-review |
| `tests/security/injection-handling.*` | A03 handling | injection-handling-review |
| `tests/security/xss-handling.*` | A03 XSS | xss-output-encoding-review |
| `tests/security/security-headers.*` | A05/A02 headers, CORS | security-headers-review |
| `tests/security/api-authz.*` | OWASP API Top 10 | api-security-review |
| `tests/security/{ssrf,csrf,file-upload,jwt}.*` | A10 / CSRF / upload / A02 | respective review skills |
| scheduled | ZAP baseline (passive), dependency audit, secrets scan | security-regression-suite (ZAP baseline), dependency-vulnerability-audit, secrets-detection |

## Templates
```typescript
// @skill-example: fragment — playwright.config.ts (security project)
import { defineConfig } from '@playwright/test';
export default defineConfig({
  projects: [
    { name: 'security', testDir: 'tests/security', grep: /@security/, retries: 0 }, // deterministic: no retries masking flakiness
  ],
});
```
```bash
# @skill-example: fragment — commands
npx playwright test --project=security                     # full security regression
npx playwright test --project=security -g "@P0"            # security smoke (gate PRs)
npx playwright test --project=security --repeat-each=3 <new.spec.ts>   # stability for new checks
```

## Procedure
1. Confirm authorisation and environment; create the `security` project and `tests/security/` layout if absent.
2. Generate/collect checks from the focused skills; tag them `@security` + priority + feature.
3. Establish the baseline (record current accepted state); wire the suite so only new findings fail.
4. In CI (`ci-cd-pipeline-config`): run `@P0` security on PRs, the full security project on main, and passive scans (ZAP baseline, dependency audit, secrets) on a schedule — never active scans on every PR.
5. Run `--project=security`, then `npm run verify`; publish results as artifacts.

## Definition of Done
- `security` project and `tests/security/` layout in place; checks tagged per governance.
- Deterministic checks gate the pipeline; passive scans scheduled; baseline recorded.
- No offensive scanning added; verify and the security project green (or new findings triaged).
