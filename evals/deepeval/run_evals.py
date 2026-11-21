"""DeepEval runner: scores the pack's AI outputs from evals/goldens/llm.jsonl and writes
evals/results/deepeval.json for scripts/ai-release-gate.mjs.

  task "generated-test"   GEval test quality + Hallucination (acceptance criteria as context)
  task "rag-answer"       Faithfulness, Answer relevancy, Contextual precision, recall and relevancy
  task "routing"          Tool correctness (the skills/tools the orchestrator chose)
  task "task-completion"  GEval task completion (did the run do what was asked, with evidence)

The judge is pinned in qa.config.json (ai.judgeModel) and reached only through the gateway (evals/judge.py), at
temperature 0. There is no default judge. Scores still move a little between runs, so gate on thresholds, not deltas.
"""
import os, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from common import read_goldens, retrieve, write_result  # noqa: E402

from deepeval import evaluate
from deepeval.test_case import LLMTestCase, LLMTestCaseParams, ToolCall
from deepeval.metrics import (GEval, HallucinationMetric, FaithfulnessMetric, AnswerRelevancyMetric,
                              ContextualPrecisionMetric, ContextualRecallMetric, ContextualRelevancyMetric, ToolCorrectnessMetric)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from judge import deepeval_judge  # noqa: E402

kw = {"model": deepeval_judge()}  # fails closed when the judge is not pinned

test_quality = GEval(name="Test quality", threshold=0.7, **kw, criteria=(
    "Given the acceptance criteria (context), does the generated Playwright test cover each criterion it claims, use web-first "
    "assertions, avoid hard waits and XPath, inject pages through fixtures, and assert only what the criteria state?"),
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.CONTEXT])
task_completion = GEval(name="Task completion", threshold=0.7, **kw, criteria=(
    "Did the output complete the request in the input, end with an evidence block listing skills, changes, verification "
    "and results, and avoid claiming results it did not show?"),
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT])

METRICS = {
    "generated-test": lambda: [test_quality, HallucinationMetric(threshold=0.05, **kw)],
    "rag-answer": lambda: [FaithfulnessMetric(threshold=0.9, **kw), AnswerRelevancyMetric(threshold=0.8, **kw),
                           ContextualPrecisionMetric(threshold=0.8, **kw), ContextualRecallMetric(threshold=0.8, **kw),
                           ContextualRelevancyMetric(threshold=0.6, **kw)],
    "routing": lambda: [ToolCorrectnessMetric(threshold=1.0)],
    "task-completion": lambda: [task_completion],
}


def case(g):
    ctx = g.get("retrieval_context")
    if ctx is None and g.get("retrieve"):
        ctx = retrieve(g["input"], g.get("intent"))
    return LLMTestCase(
        input=g["input"], actual_output=g.get("actual_output", ""), expected_output=g.get("expected_output"),
        context=g.get("context"), retrieval_context=ctx,
        tools_called=[ToolCall(name=t) for t in g.get("tools_called", [])] or None,
        expected_tools=[ToolCall(name=t) for t in g.get("expected_tools", [])] or None)


def main():
    goldens = read_goldens()
    scores = {}
    for task, make in METRICS.items():
        cases = [case(g) for g in goldens if g.get("task") == task]
        if not cases:
            continue
        result = evaluate(test_cases=cases, metrics=make())
        for tr in result.test_results:
            for md in tr.metrics_data or []:
                key = md.name.split(" [")[0].strip().lower().replace(" ", "_")
                scores.setdefault(key, []).append(md.score or 0.0)
    metrics = {k: round(sum(v) / len(v), 3) for k, v in scores.items()}
    quality = [v for k, v in metrics.items() if k != "hallucination"]
    write_result("deepeval", {"averageScore": round(sum(quality) / len(quality), 3) if quality else None, "metrics": metrics, "cases": len(goldens)})
    print("deepeval:", metrics)


if __name__ == "__main__":
    main()
