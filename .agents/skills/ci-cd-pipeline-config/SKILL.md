---
name: ci-cd-pipeline-config
description: >-
  Creates and maintains CI/CD pipelines that run the Playwright suite and the wider quality
  layers on GitHub Actions, GitLab CI, Azure DevOps or Jenkins: stage ordering, sharding with blob
  report merging, the pinned Playwright container image, caching, secrets, artifacts, scheduled
  performance and security jobs, and quality gates. Use whenever the user asks to add, fix, speed
  up or review a pipeline, run tests in CI, shard tests, publish reports, or schedule nightly or
  cloud-grid runs. Not for making the tests themselves faster or less flaky
  (regression-optimization).
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# CI/CD pipeline configuration

Cheap checks first, expensive ones last; every run leaves evidence behind.

## Non-negotiables
- The container image tag equals the installed `@playwright/test` version (`mcr.microsoft.com/playwright:v<version>-noble`). Governance checks this.
- Secrets come from the CI secret store, never the repository. Actions pinned to a commit SHA where the platform allows.
- Artifacts are uploaded on every outcome (`if: always()` or the platform equivalent).
- Shards write blob reports; one job merges them into HTML, JUnit and JSON.
- Performance and active security jobs run on main, release or a schedule — never on every pull request.

## Stage order
| Stage | Runs | When |
|---|---|---|
| Install | `npm ci` in the pinned image | always |
| Static | lint, typecheck, governance | always |
| API | `npx playwright test --project=api` | always |
| UI | `--project=chromium --shard=i/n` with `PW_SHARDED=1` (blob reporter) | always; PRs may use `--only-changed=origin/<base>` plus `@smoke` |
| Security | `--project=security`, dependency audit | always (checks), schedule (ZAP baseline) |
| Merge | `npx playwright merge-reports --reporter html,junit,json ./all-blob-reports` | after UI, even when it fails |
| Performance | k6 load scripts | main or release only |
| Report and notify | publish reports, notify from upstream job results | always |

## GitHub Actions skeleton
```yaml
# @skill-example: fragment
name: playwright
on: { pull_request: {}, push: { branches: [main] }, schedule: [{ cron: '0 2 * * *' }] }
concurrency: { group: '${{ github.workflow }}-${{ github.ref }}', cancel-in-progress: true }
permissions: { contents: read }
jobs:
  static:
    runs-on: ubuntu-latest
    container: { image: mcr.microsoft.com/playwright:v1.64.1-noble }
    steps:
      - uses: actions/checkout@v5
      - run: npm ci
      - run: npm run verify
  ui:
    needs: static
    runs-on: ubuntu-latest
    container: { image: mcr.microsoft.com/playwright:v1.64.1-noble, options: --ipc=host }
    strategy: { fail-fast: false, matrix: { shard: [1, 2, 3, 4] } }
    env: { CI: true, PW_SHARDED: 1, BASE_URL: '${{ vars.BASE_URL }}', TEST_USER_PASSWORD: '${{ secrets.TEST_USER_PASSWORD }}' }
    steps:
      - uses: actions/checkout@v5
      - run: npm ci
      - run: npx playwright test --project=chromium -G @quarantine --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v5
        if: ${{ !cancelled() }}
        with: { name: 'blob-report-${{ matrix.shard }}', path: blob-report, retention-days: 7 }
  merge:
    needs: ui
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    container: { image: mcr.microsoft.com/playwright:v1.64.1-noble }
    steps:
      - uses: actions/checkout@v5
      - run: npm ci
      - uses: actions/download-artifact@v5
        with: { path: all-blob-reports, pattern: blob-report-*, merge-multiple: true }
      - run: npx playwright merge-reports --reporter html,junit,json ./all-blob-reports
      - uses: actions/upload-artifact@v5
        with: { name: playwright-report, path: playwright-report }
```

## Platform notes
| Platform | Sharding | Image | Notes |
|---|---|---|---|
| GitHub Actions | `strategy.matrix` | `container.image` | `actions/download-artifact` with `merge-multiple` |
| GitLab CI | `parallel: N` with `$CI_NODE_INDEX/$CI_NODE_TOTAL` | `image:` | publish `junit` under `artifacts.reports` |
| Azure DevOps | `strategy.parallel` with `System.JobPositionInPhase` | `container:` | publish with `PublishTestResults@2` |
| Jenkins | `matrix` axis or parallel stages | `agent { docker { image … } }` | stash blob reports, unstash to merge |

## Procedure
1. Detect the platform and any existing pipeline; never replace one — add a new file or propose changes.
2. Read the installed Playwright version and pin the image to it.
3. Build the stages above; set timeouts; cache dependencies; cancel superseded runs.
4. Wire secrets and variables by name only, and list the ones the user must create.
5. Validate the syntax where a linter exists, then push to a branch and report the first run.

## Definition of Done
- The pipeline runs green on a branch, or its first failure is diagnosed.
- Image tag equals the Playwright version; artifacts uploaded on failure; merged report published.
