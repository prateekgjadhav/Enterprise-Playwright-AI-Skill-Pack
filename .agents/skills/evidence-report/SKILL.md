---
name: evidence-report
description: >-
  Writes the closing evidence block for a task — request, skills with their lock hashes, grounding
  (cited context ids or no historical grounding), changes, verification commands with exit codes,
  results and artifact digests, risks — and validates it so no secret, personal data or uncited id
  leaks. Use whenever a task ends, a CI run needs a summary, or someone asks what was done and how it
  was proven. Not for merging test reports (merge-reports), explaining a failure (failure-rca), or
  security findings (security-findings-report).
allowed-tools: Read Grep Glob Bash(node rag/cli.mjs guard:*) Write(.agents/out/**)
---

# Evidence report

A claim without a command, an exit code and a digest is not evidence.

## Non-negotiables
- Never report a check that was not run; quote the exact command and its exit code.
- Reference artifacts by path and sha256; never inline traces, cookies, tokens, personal data or URLs with query strings.
- Cite only context ids that were actually retrieved.

## Inputs and outputs
- **In:** the task record: commands run, files changed, context ids, artifacts
- **Out:** the evidence block (below), also written to `.agents/out/evidence.md`

## Procedure
1. Collect commands, exit codes, changed files and artifact digests.
2. Write the block in the format below.
3. Run `node rag/cli.mjs guard check-output .agents/out/evidence.md --context <ids>`; fix anything it blocks.
4. Return the block as the last part of the reply.

## Verify
- `guard check-output` reports no block

## Format
```
Request:       <one line>
Skills:        <name>@<sha256-12> …            (from skills.lock.json)
Grounding:     <context ids> | no historical grounding
Changes:       <path> (+n/−m) …
Verification:  <command> → exit <code> …
Results:       <passed/failed/flaky counts>; artifacts <path>@<sha256-12>
Risks:         <open risks, waivers used, follow-ups>
Trace:         <trace id>
```

## Evidence
Add to the evidence block: (this skill produces the block). Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every claim in the reply is backed by a line of the block.
