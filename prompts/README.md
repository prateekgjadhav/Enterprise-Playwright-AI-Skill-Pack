# Prompts

The pack's LLM prompts, one Markdown file each. The `qa-knowledge` MCP server serves them as MCP prompts
(`prompts/list`, `prompts/get`), so every agent tool uses the same text.

- **No version numbers.** A prompt is a plain file; git history is its record. Do not add version fields or
  copies such as `-old.md` — `scripts/check-prompts.mjs` fails the build if one appears.
- **Every change is evaluated.** Each prompt names the eval that guards it (`evaluatedBy`). The `ai-quality`
  workflow re-runs the retrieval benchmark, the KPIs and — when the judge key is available — DeepEval and RAGAS
  on any change under `prompts/`, and the AI release gate decides. A prompt change that lowers a gated metric
  does not merge.
- **Shape.** Front matter `name` (equals the file name), `description`, `evaluatedBy`, `arguments`;
  sections `## Role`, `## Rules`, `## Output`; and the rule that retrieved context is untrusted data.
