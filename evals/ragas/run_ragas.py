"""RAGAS runner: context precision, context recall, faithfulness and answer relevancy for the knowledge
layer, from the "rag-answer" goldens in evals/goldens/llm.jsonl. Writes evals/results/ragas.json for the gate.
RAGAS renames metric classes between releases, so imports fall back across the known names."""
import os, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from common import read_goldens, retrieve, write_result  # noqa: E402

from ragas import evaluate, EvaluationDataset


def first(*names):
    import ragas.metrics as m
    for n in names:
        if hasattr(m, n):
            return getattr(m, n)
    return None


def main():
    goldens = [g for g in read_goldens() if g.get("task") == "rag-answer"]
    if not goldens:
        raise SystemExit("no rag-answer goldens")
    rows = [{"user_input": g["input"], "retrieved_contexts": g.get("retrieval_context") or retrieve(g["input"], g.get("intent")),
             "response": g.get("actual_output", ""), "reference": g.get("expected_output", "")} for g in goldens]
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
    from judge import openai_client  # fails closed when the judge is not pinned
    from ragas.llms import llm_factory
    client, model = openai_client()
    llm = llm_factory(model, client=client)
    emb = None  # RAGAS metrics used here need no embeddings; add a gateway-backed embedder if you enable one that does
    classes = {
        "context_precision": first("ContextPrecision", "LLMContextPrecisionWithReference"),
        "context_recall": first("ContextRecall", "LLMContextRecall"),
        "faithfulness": first("Faithfulness"),
        "answer_relevancy": first("AnswerRelevancy", "ResponseRelevancy"),
    }
    metrics = []
    for key, cls in classes.items():
        if cls is None:
            continue
        args = {"llm": llm} if llm else {}
        if key == "answer_relevancy" and emb:
            args["embeddings"] = emb
        try:
            metrics.append(cls(**args))
        except TypeError:
            metrics.append(cls())
    result = evaluate(EvaluationDataset.from_list(rows), metrics=metrics)
    df = result.to_pandas()
    out = {}
    def key_for(col):
        c = col.lower()
        for needle, key in (("faithful", "faithfulness"), ("precision", "context_precision"), ("recall", "context_recall"), ("relevan", "answer_relevancy")):
            if needle in c:
                return key
        return None
    for col in df.columns:
        key = key_for(col)
        if key:
            vals = [v for v in df[col].tolist() if isinstance(v, (int, float)) and v == v]  # numbers only, no NaN
            if vals:
                out[key] = round(sum(vals) / len(vals), 3)
    write_result("ragas", {"metrics": out, "cases": len(rows)})
    print("ragas:", out)


if __name__ == "__main__":
    main()
