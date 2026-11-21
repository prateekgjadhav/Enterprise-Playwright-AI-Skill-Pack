"""Pytest-style DeepEval checks for `deepeval test run evals/deepeval/examples` — one assertion per golden,
so a regression names the exact output that got worse."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
import pytest
from deepeval import assert_test
from common import read_goldens
from deepeval_run_shim import case, METRICS  # noqa: F401  (see conftest.py)

GOLDENS = [g for g in read_goldens() if g.get("task") in METRICS]


@pytest.mark.parametrize("golden", GOLDENS, ids=[g.get("id", str(i)) for i, g in enumerate(GOLDENS)])
def test_golden(golden):
    assert_test(case(golden), METRICS[golden["task"]]())
