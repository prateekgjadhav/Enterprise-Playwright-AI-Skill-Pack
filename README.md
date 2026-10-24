# Enterprise Playwright AI Skill Pack

Forty-seven narrow skills and one orchestrator for Claude Code (and other agent tools) that turn any request
about Playwright testing — functional, operational, security or risk — into the same path: explore, choose
the right skills, follow the rules, verify, run, and report with evidence. The full guide is
[`docs/setup-guide.html`](docs/setup-guide.html); open it in a browser.

## Requirements

- Claude Code, or another agent tool that reads `AGENTS.md`
- Node.js 18 or newer (the hooks and scripts use it), git, and bash (on Windows, Git Bash or WSL)

## Install into a repository

From this folder:

```bash
./setup.sh /path/to/your-repo          # or: bash setup.sh /path/to/your-repo
./setup.sh --dry-run /path/to/your-repo  # preview first; writes nothing
```

`setup.sh` never overwrites your work:

- New files are added. A pack file that differs from yours is left alone, and the pack's copy is saved
  beside it as `<file>.pack-new` so you can compare them.
- An existing `.claude/settings.json` is merged: the pack's permissions and hooks are added and nothing is
  removed. It asks first and keeps a backup in `.skill-pack-backup/<timestamp>/`.
- An existing `CLAUDE.md` is kept. The orchestrator goes to `.agents/CLAUDE.pack.md`, and setup offers to add
  the one line `@.agents/CLAUDE.pack.md` to your `CLAUDE.md` so Claude Code loads it.
- It then links the skills into `.claude/skills` (symlinks, or copies with `--copy`), builds the skill
  manifest, and runs the skill checks.

Everything except this README, `setup.sh` and `docs/` is copied into your repository.

## First run

Open the repository in Claude Code and ask it to **set up the project**. `project-setup` reads the repository
read-only, writes the detected values into `.agents/qa.config.json`, and scaffolds only what is missing: the
`verify` script, the ESLint rules, `tsconfig`, `playwright.config.ts`, `@fixtures` and one example spec. When
`npm run verify` and a smoke test pass, the governance hooks are live. Then ask for something small, such as
*add a smoke test for the login page*, and check that the reply ends with the evidence block.

For risk and compliance work, add the `security` block described in the guide to `.agents/qa.config.json`
and start with a scoped question, such as *which of our open CVEs are on the KEV list?*

## Start a new repository from the pack

```bash
cp -R enterprise-playwright-ai-skill-pack my-app && cd my-app && git init && scripts/link-skills.sh
```

Replace this README with your own; then ask Claude Code to set up the project.

## Check the skills

```bash
node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json
node scripts/check-skills.mjs .agents/skills-manifest.json tests/skills/trigger-cases.json
node scripts/generate-routing.mjs .agents/skills-manifest.json > routing.generated.md   # optional
```

`.github/workflows/skill-validation.yml` runs the same checks in CI and fails if the committed manifest is
stale.

## Update

Unzip the new pack and run `./setup.sh --force /path/to/your-repo`. Pack files that changed are replaced and
the old ones are backed up first; your own `CLAUDE.md`, `AGENTS.md` and `.claude/settings.json` are still
merged, never replaced.

## Remove

Delete `.agents/skills/`, `.agents/skills-manifest.json`, `.agents/CLAUDE.pack.md` (if present),
`.claude/skills`, `.claude/hooks/governance-check.sh`, `.claude/hooks/stop-gate.sh`,
`.claude/agents/governance-reviewer.md`, `.github/workflows/skill-validation.yml`, `tests/skills/` and the
five scripts in `scripts/`. Then remove the pack's entries from `.claude/settings.json`, the import line from
`CLAUDE.md`, and `.agents/qa.config.json` if nothing else uses it.

## Layout

```text
enterprise-playwright-ai-skill-pack/
├── README.md, setup.sh, docs/setup-guide.html    stay here; not copied into your repository
├── CLAUDE.md                     orchestrator: workflow, routing, rules, evidence format
├── AGENTS.md                     the same instructions for other agent tools
├── .agents/
│   ├── qa.config.json            project settings and approval gates
│   ├── skills-manifest.json      generated from the skills; checked in CI
│   └── skills/                   the 47 skills, one folder each
├── .claude/
│   ├── settings.json             permissions and hooks
│   ├── hooks/                    governance-check.sh (lint each edit), stop-gate.sh (verify before done)
│   └── agents/governance-reviewer.md
├── .github/workflows/skill-validation.yml
├── scripts/                      link-skills.sh, governance-check-all.mjs, build-skill-manifest.mjs,
│                                 generate-routing.mjs, check-skills.mjs
└── tests/skills/trigger-cases.json
```
