---
name: skill-routing-eval
description: >-
  Measures whether requests reach the right skill: a deterministic lexical router over
  tests/skills/trigger-cases.json reports top-1 and top-3 accuracy, misroutes and trigger-term overlap
  between skills that do not exclude each other. Use whenever descriptions, the routing table or the
  catalogue change, or a request was misrouted, or a request went to the wrong skill. Not for writing
  or splitting the skill (skill-authoring), scanning for unsafe content (skill-scan), or judging model
  answers (llm-eval-gating), or rewording a skill description (skill-authoring).
allowed-tools: Read Grep Glob Bash(node scripts/check-skills.mjs:*)
---

# Skill routing evaluation

If two skills compete for a request, the descriptions are wrong, not the router.

## Non-negotiables
- Never edit trigger cases to make a failing evaluation pass.
- Never lower `skillEvaluation.minTriggerAccuracy` in the same change that needs it.
- The lexical router is a proxy for description quality; LLM-judged routing runs in `llm-eval-gating` with the pinned judge.

## Inputs and outputs
- **In:** the catalogue, skill files and trigger cases
- **Out:** accuracy, misroutes and overlap warnings

## Procedure
1. Run `node scripts/check-skills.mjs --fail-on-soft`.
2. For each misroute, sharpen the losing skill's *Use whenever* or add a *Not for* to the winner.
3. Re-run until top-1 accuracy meets the threshold and no overlap warning remains.

## Verify
- top-1 accuracy at or above `skillEvaluation.minTriggerAccuracy` (0.95)
- no overlap warning

## Evidence
Add to the evidence block: top-1 and top-3 accuracy, misroutes fixed. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every skill wins its own trigger cases and the gate is green.
