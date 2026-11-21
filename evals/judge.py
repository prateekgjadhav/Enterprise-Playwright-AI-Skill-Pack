"""The pinned judge for DeepEval and RAGAS. Every judge call goes through the organisation's OpenAI-compatible
gateway with the model pinned in qa.config.json (ai.judgeModel), temperature 0 and the data-class and skill headers.
There is no default judge: when ai.gateway.baseUrl or ai.judgeModel is empty the evals stop (fail closed), because
a judge that changes between runs makes thresholds meaningless. The token is short-lived (OIDC-exchanged in CI)."""
import json, os, pathlib

ROOT = pathlib.Path(os.environ.get("QA_REPO_ROOT", pathlib.Path(__file__).resolve().parents[1]))


def judge_settings():
    cfg = json.loads((ROOT / ".agents" / "qa.config.json").read_text())
    ai = cfg.get("ai", {})
    base = (ai.get("gateway") or {}).get("baseUrl") or ""
    model = ai.get("judgeModel") or ""
    if not base or not model:
        raise SystemExit("evals: ai.gateway.baseUrl and ai.judgeModel must be set in qa.config.json (no default judge)")
    if model.lower().endswith(("latest", ":latest")):
        raise SystemExit(f"evals: judge model {model!r} is a floating alias; pin an exact model id")
    token = os.environ.get("QA_GATEWAY_TOKEN")  # qa-scan: not-a-secret (environment reference)
    if not token:
        raise SystemExit("evals: QA_GATEWAY_TOKEN is not set (exchange your CI OIDC token for a gateway token)")
    headers = {"x-qa-data-class": "internal", "x-qa-skill": "llm-eval-gating"}
    return {"base_url": base.rstrip("/"), "model": model, "api_key": token, "headers": headers}


def openai_client():
    from openai import OpenAI
    s = judge_settings()
    return OpenAI(base_url=s["base_url"], api_key=s["api_key"], default_headers=s["headers"]), s["model"]


def deepeval_judge():
    """A DeepEval custom model bound to the gateway (DeepEvalBaseLLM is DeepEval's documented extension point)."""
    from deepeval.models.base_model import DeepEvalBaseLLM

    client, model = openai_client()

    class GatewayJudge(DeepEvalBaseLLM):
        def __init__(self):
            self.model = model

        def load_model(self):
            return client

        def generate(self, prompt: str) -> str:
            r = client.chat.completions.create(model=model, temperature=0, messages=[{"role": "user", "content": prompt}])
            return r.choices[0].message.content or ""

        async def a_generate(self, prompt: str) -> str:
            return self.generate(prompt)

        def get_model_name(self):
            return model

    return GatewayJudge()
