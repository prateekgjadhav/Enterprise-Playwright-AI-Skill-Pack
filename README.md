# Enterprise Playwright AI Skill Pack

Sixty-four narrow skills that let AI coding agents write, run and maintain Playwright tests under rules that machines
enforce: managed settings and root-owned hooks on workstations, an OPA policy and AST lint rules in CI, and a signed
lock over every pack file. It is vendor-neutral (any OpenAI-compatible model gateway, any secret store, any OTLP
backend, any agent host that reads `AGENTS.md` and Agent Skills) and keeps models at authoring time only: tests run
deterministically.

The full guide is `Enterprise_Playwright_AI_Skill_Pack__Setup_and_Implementation_Guide.html`, generated from this
repository by `node scripts/gen-docs.mjs` (CI fails when it is stale).

## No version numbers
Nothing in the pack carries a version, changelog or release history. A release *is* its content: the sha256 of
`skills.lock.json` (every file's hash), signed keylessly by `release.yml` and published as `pack-<digest12>`.
Third-party dependencies are still pinned exactly (actions to commit SHAs, images to digests, npm to exact versions,
Python by hash): those pins are integrity controls, not pack versions.

## Install into a repository
1. Platform team: `node scripts/package-hooks.mjs dist/qa-pack`, fill `dist/qa-pack/trust.json`, deploy it root-owned
   to `/opt/qa-pack` and `managed-settings.json` to the agent host's managed path through MDM (see `managed/host-adapters.md`).
2. Download a release `pack-<digest12>.zip`, verify it, unzip it:
   `gh attestation verify pack-<digest12>.zip --repo <org>/<pack-repo>`
3. Preview, then apply: `./install.sh ../your-repo` → review `.skill-pack.patch` → `./install.sh ../your-repo --apply [--pr]`.
   The installer verifies the signature and every hash, never writes `.claude/settings*.json`, never edits an existing
   `CLAUDE.md`, keeps no backups (git is the rollback) and leaves your own scaffold files alone.
4. In the repository: `node scripts/link-skills.mjs`, then ask the agent to set up the pack (or paste
   `BOOTSTRAP_PROMPT.md`): `repo-discovery` → `config-proposal` → review and merge `.claude/qa.config.json`.

## First commit checklist (things that need network access or your organisation)
- `npm install` once and commit `package-lock.json` (CI uses `npm ci --ignore-scripts` and `npm audit signatures`).
- Pin every GitHub Action to a commit SHA and every image to a digest: merge Renovate's onboarding "pin dependencies"
  pull request, or run `pinact run`. `node scripts/check-pins.mjs` stays red until then.
- `pip-compile --generate-hashes --output-file evals/requirements.txt evals/requirements.in` and commit it.
- After `npm ci`, vet and pin the Playwright test MCP server: `node scripts/mcp-pin.mjs --write --server playwright-test`.
- Set the repository variables `QA_RELEASE_IDENTITY`, `QA_ENV` and your secret store's OIDC settings; create the
  protected environments `e2e`, `approvals` (required reviewers, prevent self-review) and `release`.
- Replace `@org/...` in `.github/CODEOWNERS` with your teams (at least two per control path).

## Verify
```
npm run verify:pack      # lock, skills, least privilege, skill scan, prompts, guide
npm run verify           # + config, typecheck, AST lint, test discovery (once configured)
npm run test:pack        # the pack's own self-tests (node --test)
opa test policy/         # policy unit tests
```

## Layout
```
AGENTS.md  CLAUDE.md               orchestrator (host-neutral) and the Claude Code shim
.claude/skills/<64>/SKILL.md       the skills; .claude/skills-catalog.json holds tier, category and default
.claude/qa.config.json             empty on purpose: the loader fails closed until an environment is approved
hooks/  managed/                   managed hooks (Node, fail closed) and the MDM payload
policy/  governance/               OPA policy and tests; waivers, quarantine, approvals, scopes, revoked digests
eslint/                            AST governance rules
rag/                               knowledge layer and qa-knowledge MCP server (Node, no dependencies)
scripts/                           lock, verification, scanning, scrubbing, installer, docs generator, gates
src/  tests/  playwright.config.ts reference framework: fixtures, secret providers, page objects, modules, factories
evals/  prompts/                   DeepEval and RAGAS sidecars with a pinned judge; prompt files
gateway/  telemetry/               model route declaration; pinned span contract
.github/workflows/                 ci, release, approve, knowledge-reindex, update-baselines
```

Licensed under Apache-2.0. Report vulnerabilities as described in `SECURITY.md`.
