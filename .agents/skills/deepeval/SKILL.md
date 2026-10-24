---
name: deepeval
description: >-
  Evaluates the quality of the AI outputs the pack produces, using the open-source DeepEval
  framework ("Pytest for LLMs"): scores generated tests, migration conversions, defect analyses,
  reports and the orchestrator's skill-routing with LLM-as-judge (G-Eval), RAG, tool-use and
  task-completion metrics, against golden datasets, and gates regressions in CI. Use whenever the
  user asks to evaluate or regression-test AI/LLM output quality, score generated tests or
  migrations or reports, check RAG faithfulness or answer relevancy, verify tool/routing
  correctness, build an eval dataset of goldens, or add an LLM-quality gate to CI. Not for static
  skill-set checks — frontmatter, overlap, routing coverage (skill-evaluation) — or runtime
  telemetry of agent runs (agent-telemetry); DeepEval scores whether the outputs are good, which
  those two do not. Runs locally; a provider key is needed only for LLM-judge metrics.
metadata:
  tier: "4"
  pack: "enterprise-playwright-ai-skill-pack"
---

# DeepEval

Measure whether the AI outputs the pack generates are actually good. `skill-evaluation` proves the
skills are well-formed and routable, and `agent-telemetry` shows what the agent did; DeepEval closes
the loop by scoring the *output quality* and gating regressions before they reach users.

## Non-negotiables
- **Local-first.** Evaluations run in the team's own environment (`evals/deepeval/`). An LLM-judge metric needs a provider key (e.g. `OPENAI_API_KEY`) taken from the secret store — never hard-coded, never printed. Sending results to a cloud (Confident AI) is opt-in only.
- **Complements, does not replace.** DeepEval scores output quality; it does not replace `skill-evaluation`'s static checks or `agent-telemetry`'s traces, and it is not a substitute for the human review of security findings.
- **Goldens hold no secrets or production data.** Datasets are redacted, synthetic or sampled with approval; a report eval's `retrieval_context` is the findings, not live credentials.
- **Thresholds are explicit and versioned.** Every metric has a stated threshold; a failing score fails the CI gate. LLM-judge scores are non-deterministic, so pin the judge model and treat small score moves as noise.

## What to evaluate (pack output → metric)
| Pack AI output | DeepEval metric | Checks |
|---|---|---|
| Generated test (`playwright-test-generation`) | `GEval` "Test quality" + `FaithfulnessMetric` (AC as context) | covers the acceptance criteria, web-first assertions, no hard waits, asserts only what the AC says |
| Migration conversion (`migration-analysis`) | `GEval` "Parity" (legacy test as context) | checks the same behaviour as the legacy test; no weakened or dropped assertions |
| Defect analysis (`defect-analysis`) | `AnswerRelevancyMetric` + `GEval` "Actionability" | the root-cause addresses the failure and is actionable |
| Report (`pentest-report-generator`, `reporting-analytics`) | `FaithfulnessMetric` (findings as context) | every claim is supported by the findings; no hallucinated results |
| Orchestrator routing (CLAUDE.md skill selection) | `ToolCorrectnessMetric` (+ `GEval` rationale) | the expected skill/tool was chosen (deterministic; no key needed) |
| RAG grounding (knowledge MCP) | `ContextualRelevancyMetric` + `FaithfulnessMetric` + `AnswerRelevancyMetric` | the RAG triad: retrieve the right context and stay grounded |

## Eval modes (match the scope)
- **End-to-end** — treat a skill's output as a black box: input, actual output, expected behaviour, metrics. Best for generated tests, reports, defect drafts.
- **Component-level** — score individual spans/tools/retrievers from `agent-telemetry` traces. Best for routing, tool calls, RAG retrieval.
- **Trajectory-based** — score the agent's whole plan→tool→handoff chain as one trajectory. Best for multi-step tasks (a full migration or assessment run).

## Templates
```bash
# @skill-example: fragment — install (Python sidecar, separate from the TS pack)
pip install -r evals/deepeval/requirements.txt      # deepeval + pytest
export OPENAI_API_KEY=...                            # from the secret store; only for LLM-judge metrics
```
```python
# @skill-example: fragment — a test case + metric (evals/deepeval/examples/…)
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from deepeval.metrics import GEval

test_quality = GEval(
    name="Test quality",
    criteria="Given the acceptance criteria (context), does the generated Playwright test cover them, "
             "use web-first assertions, avoid hard waits, and assert only what the criteria state?",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.CONTEXT],
    threshold=0.7,
)

def test_login_spec_quality():
    case = LLMTestCase(input="AC: user logs in with valid creds", actual_output="<generated spec>",
                       context=["User can log in with valid credentials and lands on the dashboard"])
    assert_test(case, [test_quality])      # fails the build below the threshold
```
```yaml
# @skill-example: fragment — CI gate (add an eval stage alongside skill-validation)
llm-evals:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - run: pip install -r evals/deepeval/requirements.txt
    - run: deepeval test run evals/deepeval/examples   # non-zero fails on a quality regression
      env: { OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }} }   # LLM-judge metrics only
```

## Procedure
1. Install the sidecar (`evals/deepeval/requirements.txt`); set the judge key from the secret store for LLM-judge metrics.
2. Capture the pack's outputs as test cases: the generated artifact as `actual_output`, the ticket/legacy test/findings as `context`/`retrieval_context`, and the chosen skills as `tools_called`. Traces from `agent-telemetry` feed component- and trajectory-level cases.
3. Pick metrics from the table; set explicit thresholds; keep goldens in `evals/deepeval/datasets/` (redacted, no secrets).
4. Run `deepeval test run evals/deepeval/examples` (or `evaluate(...)` for a one-off); review scores and the judge's reasons.
5. Wire the run as a CI gate beside `skill-validation`; gate on hard thresholds, treat small LLM-judge moves as noise, and add a golden per new AI capability.

## Definition of Done
- Each evaluated output type has at least one metric with an explicit threshold and a golden in `datasets/`.
- Evals run locally; the judge key comes from the secret store and is never printed; no secrets or production data in goldens.
- The eval gate runs in CI beside `skill-validation`; regressions fail the build; results complement `skill-evaluation` and `agent-telemetry`.
