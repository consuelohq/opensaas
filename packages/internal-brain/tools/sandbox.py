"""sandbox tools — real bash execution in the railway container."""

import json
import subprocess
import os


def exec(command: str, timeout: int = 120) -> str:
    """run a command in the real container environment. has python (pandas, numpy, scikit-learn, supabase, httpx), node (@supabase/supabase-js), curl, jq, and all env vars (SUPABASE_URL, SUPABASE_KEY, etc)."""
    try:
        result = subprocess.run(
            ["bash", "-c", command],
            capture_output=True, text=True, timeout=timeout,
            env=os.environ.copy(),
        )
        return json.dumps({
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exitCode": result.returncode,
        })
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "timeout", "timeout": timeout})


def read_file(path: str) -> str:
    """read a file from the container filesystem."""
    try:
        with open(path, "r") as f:
            return f.read()
    except Exception as e:
        return json.dumps({"error": str(e)})


def write_file(path: str, content: str) -> str:
    """write content to a file in the container filesystem."""
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return json.dumps({"ok": True, "path": path})
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_files(path: str = "/app") -> str:
    """list files in a container directory."""
    try:
        result = subprocess.run(
            ["find", path, "-type", "f", "-maxdepth", "3"],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout
    except Exception as e:
        return json.dumps({"error": str(e)})
