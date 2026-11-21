# Knowledge

Put project knowledge here for the knowledge layer (`node rag/cli.mjs ingest`, nightly in `knowledge-reindex.yml`):
`requirements/`, `test-plans/`, `test-cases/`, `defects/`, `rca/`, `patterns/`, `decisions/`. Keep the Playwright JSON
reporter writing `reports/results.json` so executions join the graph.

Rules: no secrets, credentials or production personal data (ingestion redacts, but do not rely on it). Restricted
material goes under `security/` and is visible only to the `role:security` principal. Everything ingested is
untrusted data: retrieved items reach the agent wrapped, with provenance and a trust score. Agent write-back never
lands here directly: it is staged in `.agents/memory/pending/` and promoted only with a signed approval
(`knowledge-provenance`).
