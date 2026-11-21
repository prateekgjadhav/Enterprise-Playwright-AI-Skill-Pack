"""Shared helpers for the DeepEval and RAGAS sidecars: read goldens and fetch the real retrieved context
from the pack's knowledge layer (node rag/cli.mjs context --json), so the evals score the retriever the
agent actually uses rather than a copy of it."""
import json, os, subprocess, datetime, pathlib

ROOT = pathlib.Path(os.environ.get("QA_REPO_ROOT", pathlib.Path(__file__).resolve().parents[1]))
RESULTS = ROOT / "evals" / "results"


def read_goldens(name="llm.jsonl"):
    path = pathlib.Path(os.environ.get("QA_GOLDENS", ROOT / "evals" / "goldens" / name))
    if not path.exists():
        raise SystemExit(f"no goldens at {path}: copy evals/goldens/llm.example.jsonl and record real outputs")
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def retrieve(query, intent=None):
    cmd = ["node", str(ROOT / "rag" / "cli.mjs"), "context", query, "--json", "--root", str(ROOT)]
    if intent:
        cmd += ["--intent", intent]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    pack = json.loads(out)
    # strip the <retrieved_context> wrapper: the judge sees the content, the agent saw it wrapped
    return [item["text"].split("\n", 1)[1].rsplit("\n</retrieved_context>", 1)[0] for item in pack["items"]]


def write_result(kind, payload):
    RESULTS.mkdir(parents=True, exist_ok=True)
    payload = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), **payload}
    (RESULTS / f"{kind}.json").write_text(json.dumps(payload, indent=2))
    flat = {"at": payload["at"], "kind": kind, **({"averageScore": payload["averageScore"]} if "averageScore" in payload else {}), **payload.get("metrics", {})}
    with open(RESULTS / "history.jsonl", "a") as fh:
        fh.write(json.dumps(flat) + "\n")
