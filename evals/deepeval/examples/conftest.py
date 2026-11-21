import sys, pathlib, importlib.util
here = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("deepeval_run_shim", here.parent / "run_evals.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
sys.modules["deepeval_run_shim"] = mod
