"""sandbox tools — real bash execution on ko's mac mini."""

import json
import subprocess
import os
import re
import datetime

# full PATH so non-interactive shells get homebrew, bun, etc.
_FULL_PATH = ":".join([
    "/Users/kokayi/.bun/bin",
    "/Users/kokayi/.opencode/bin",
    "/Users/kokayi/.local/bin",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
])

_LOG_FILE = "/tmp/sandbox-audit.jsonl"

# commands that are always blocked
_BLOCKED_PATTERNS = [
    r'\brm\s+-rf\s+/',            # rm -rf /
    r'\brm\s+-rf\s+~',            # rm -rf ~
    r'\brm\s+-rf\s+\*',           # rm -rf *
    r'\brm\s+-rf\s+\.',           # rm -rf .
    r'\bmkfs\b',                   # format filesystem
    r'\bdd\s+.*of=/dev/',         # dd to device
    r'>\s*/dev/sd',               # overwrite disk
    r'\bshutdown\b',              # shutdown
    r'\breboot\b',                # reboot
    r'\bsystemctl\s+(stop|disable|mask)\s+(ssh|sshd|cloudflared|tailscaled)', # kill infra services
    r'\blaunchctl\s+remove\b',    # remove launchd services
    r'\bkillall\s+(Finder|Dock|SystemUIServer|cloudflared|tailscaled)', # kill system processes
    r'\bnpm\s+publish\b',         # publish packages
    r'\bgit\s+push\s+.*--force',  # force push
]

# commands that get rewritten (rm -> trash)
_REWRITE_RULES = [
    # rm file -> trash file (but not rm -rf which is blocked above)
    (r'^rm\s+(?!-rf)', 'trash '),
    (r'\brm\s+(?!-rf)(?!-r\s+/)', 'trash '),
]

# paths that should never be written to or deleted from
_PROTECTED_PATHS = [
    '/etc/', '/System/', '/Library/', '/usr/bin/', '/usr/sbin/',
    '/Users/kokayi/.ssh/', '/Users/kokayi/.gnupg/',
]


def _log(command: str, result: dict, blocked: str = None):
    """append to audit log."""
    try:
        entry = {
            "ts": datetime.datetime.now().isoformat(),
            "cmd": command[:500],
            "exit": result.get("exitCode") if not blocked else None,
            "blocked": blocked,
        }
        with open(_LOG_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def _check_guardrails(command: str) -> str | None:
    """return error message if command is blocked, None if ok."""
    for pattern in _BLOCKED_PATTERNS:
        if re.search(pattern, command):
            return f"BLOCKED: destructive command matched pattern '{pattern}'. use trash instead of rm, or ask ko for permission."

    for protected in _PROTECTED_PATHS:
        if re.search(rf'\b(rm|trash|mv|cp\s+.*>|>)\s+.*{re.escape(protected)}', command):
            return f"BLOCKED: cannot modify protected path {protected}"

    return None


def _rewrite(command: str) -> str:
    """apply safe rewrites (rm -> trash)."""
    rewritten = command
    # simple rm (not rm -rf, not rm -r /) -> trash
    if re.match(r'^\s*rm\s+(?!-rf)(?!-r\s+/)', rewritten):
        rewritten = re.sub(r'^\s*rm\s+', 'trash ', rewritten)
    return rewritten


def _env():
    """build env dict with full PATH."""
    env = os.environ.copy()
    env["PATH"] = _FULL_PATH
    env["HOME"] = "/Users/kokayi"
    return env


def exec(command: str, timeout: int = 120) -> str:
    """run bash on ko's mac mini. has rg, fd, bat, eza, gh, node, bun, python3, git, curl, jq, xh, agent-browser, and all env vars. destructive commands are blocked — use trash instead of rm."""
    # guardrails
    blocked = _check_guardrails(command)
    if blocked:
        _log(command, {}, blocked=blocked)
        return json.dumps({"error": blocked, "exitCode": -1})

    # safe rewrites
    command = _rewrite(command)

    try:
        result = subprocess.run(
            ["bash", "-c", command],
            capture_output=True, text=True, timeout=timeout,
            env=_env(),
            cwd="/Users/kokayi/Dev/opensaas",
        )
        out = {
            "stdout": result.stdout[-50000:] if len(result.stdout) > 50000 else result.stdout,
            "stderr": result.stderr[-5000:] if len(result.stderr) > 5000 else result.stderr,
            "exitCode": result.returncode,
        }
        _log(command, out)
        return json.dumps(out)
    except subprocess.TimeoutExpired:
        out = {"error": "timeout", "timeout": timeout}
        _log(command, out)
        return json.dumps(out)


def read_file(path: str) -> str:
    """read a file from the mac mini filesystem."""
    try:
        with open(path, "r") as f:
            content = f.read()
        if len(content) > 100000:
            return content[:100000] + f"\n\n[truncated — {len(content)} total chars]"
        return content
    except Exception as e:
        return json.dumps({"error": str(e)})


def write_file(path: str, content: str) -> str:
    """write content to a file on the mac mini."""
    # protect sensitive paths
    for protected in _PROTECTED_PATHS:
        if path.startswith(protected):
            return json.dumps({"error": f"BLOCKED: cannot write to protected path {protected}"})
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        _log(f"write_file({path})", {"exitCode": 0})
        return json.dumps({"ok": True, "path": path})
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_files(path: str = "/Users/kokayi/Dev/opensaas") -> str:
    """list files in a directory. defaults to the opensaas repo root."""
    try:
        result = subprocess.run(
            ["find", path, "-type", "f", "-maxdepth", "3",
             "-not", "-path", "*/node_modules/*",
             "-not", "-path", "*/.git/*",
             "-not", "-path", "*/dist/*",
             "-not", "-path", "*/.next/*"],
            capture_output=True, text=True, timeout=10,
            env=_env(),
        )
        return result.stdout
    except Exception as e:
        return json.dumps({"error": str(e)})
