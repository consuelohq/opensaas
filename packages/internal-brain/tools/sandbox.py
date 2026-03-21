"""sandbox tools — bash execution via just-bash CLI."""

import json
import subprocess


def _run(cmd: str, timeout: int = 30) -> dict:
    try:
        result = subprocess.run(
            ["npx", "just-bash", "-c", cmd, "--json"],
            capture_output=True, text=True, timeout=timeout,
        )
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return {"stdout": result.stdout, "stderr": result.stderr, "exitCode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"error": "timeout", "timeout": timeout}
    except FileNotFoundError:
        return {"error": "just-bash not found — is node/npm installed?"}


def exec(command: str, timeout: int = 120) -> str:
    """run a bash command in the sandbox. has access to preloaded files at /workspace/."""
    return json.dumps(_run(command, timeout))


def read_file(path: str) -> str:
    """read a file from the sandbox filesystem."""
    return json.dumps(_run(f"cat {path}"))


def write_file(path: str, content: str) -> str:
    """write content to a file in the sandbox filesystem."""
    escaped = content.replace("'", "'\\''")
    return json.dumps(_run(f"cat > {path} << 'BRAINEOF'\n{escaped}\nBRAINEOF"))


def list_files(path: str = "/workspace") -> str:
    """list files in a sandbox directory."""
    return json.dumps(_run(f"find {path} -type f"))
