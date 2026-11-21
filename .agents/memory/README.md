# Agent memory

- `project/` — this repository's verified lessons: `patterns.jsonl`, `defects.jsonl`, `architectural-decisions.jsonl`.
- `team/` — lessons shared across repositories: `best-practices.jsonl`, `migration-patterns.jsonl`, `security-findings.jsonl`.
- `pending/` — proposals waiting for a person (`node rag/cli.mjs memory pending`, `memory approve <id> --by <identity> --attestation governance/approvals/<id>.sigstore.json`). Git-ignored and excluded from retrieval.
- `reputation.json` — retrieval feedback per document.

Entries are evidence-backed, redacted and injection-scanned on write (`knowledge-provenance` skill).
