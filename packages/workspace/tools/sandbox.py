"""sandbox tools — real bash execution on the local machine with guardrails."""

import datetime
import json
import os
import re
import subprocess
from pathlib import Path

_LOG_FILE = '/tmp/sandbox-audit.jsonl'
_REQUIRED_TOOL_HINTS = ['rg', 'fd', 'bat', 'gh', 'node', 'bun', 'xh', 'agent-browser', 'opencode', 'kiro-cli']
_BLOCKED_PATTERNS = [
    r'\brm\s+-rf\s+/',
    r'\brm\s+-rf\s+~',
    r'\brm\s+-rf\s+\*',
    r'\brm\s+-rf\s+\.',
    r'\bmkfs\b',
    r'\bdd\s+.*of=/dev/',
    r'>\s*/dev/sd',
    r'\bshutdown\b',
    r'\breboot\b',
    r'\bsystemctl\s+(stop|disable|mask)\s+(ssh|sshd|cloudflared|tailscaled)',
    r'\blaunchctl\s+remove\b',
    r'\bkillall\s+(Finder|Dock|SystemUIServer|cloudflared|tailscaled)',
    r'\bnpm\s+publish\b',
    r'\bgit\s+push\s+.*--force',
]


def _workspace_dir() -> str:
    configured = os.environ.get('WORKSPACE_DIR', '').strip()
    if configured:
        return configured
    return os.getcwd()


def _protected_paths() -> list[str]:
    home = str(Path.home())
    return [
        '/etc/',
        '/System/',
        '/Library/',
        '/usr/bin/',
        '/usr/sbin/',
        f'{home}/.ssh/',
        f'{home}/.gnupg/',
    ]


def _candidate_path_dirs() -> list[str]:
    home = Path.home()
    candidates = [
        home / '.bun' / 'bin',
        home / '.opencode' / 'bin',
        home / '.local' / 'bin',
        Path('/opt/homebrew/bin'),
        Path('/usr/local/bin'),
        Path('/usr/bin'),
        Path('/bin'),
        Path('/usr/sbin'),
        Path('/sbin'),
    ]
    path_dirs = [Path(part) for part in os.environ.get('PATH', '').split(':') if part]
    seen: set[str] = set()
    ordered: list[str] = []
    current_path = os.environ.get('PATH', '').split(':')

    for directory in candidates + path_dirs:
        directory_str = str(directory)
        if directory_str in seen or not directory.exists() or not directory.is_dir():
            continue
        if directory_str in current_path:
            ordered.append(directory_str)
            seen.add(directory_str)
            continue
        if any((directory / tool_name).exists() for tool_name in _REQUIRED_TOOL_HINTS):
            ordered.append(directory_str)
            seen.add(directory_str)
    return ordered


def _log(command: str, result: dict, blocked: str | None = None) -> None:
    try:
        entry = {
            'ts': datetime.datetime.now().isoformat(),
            'cmd': command[:500],
            'exit': result.get('exitCode') if not blocked else None,
            'blocked': blocked,
        }
        with open(_LOG_FILE, 'a', encoding='utf-8') as handle:
            handle.write(json.dumps(entry) + '\n')
    except Exception:
        pass


def _check_guardrails(command: str) -> str | None:
    for pattern in _BLOCKED_PATTERNS:
        if re.search(pattern, command):
            return f"BLOCKED: destructive command matched pattern '{pattern}'. use trash instead of rm."
    for protected in _protected_paths():
        if re.search(rf'\b(rm|trash|mv|cp\s+.*>|>)\s+.*{re.escape(protected)}', command):
            return f'BLOCKED: cannot modify protected path {protected}'
    return None


def _rewrite(command: str) -> str:
    rewritten = command
    if re.match(r'^\s*rm\s+(?!-rf)(?!-r\s+/)', rewritten):
        rewritten = re.sub(r'^\s*rm\s+', 'trash ', rewritten)
    return rewritten


def _env() -> dict[str, str]:
    env = os.environ.copy()
    env['PATH'] = ':'.join(_candidate_path_dirs())
    env['HOME'] = str(Path.home())
    return env


def exec(command: str, timeout: int = 120) -> str:
    """run bash in the configured workspace. destructive commands are blocked."""
    blocked = _check_guardrails(command)
    if blocked:
        _log(command, {}, blocked=blocked)
        return json.dumps({'error': blocked, 'exitCode': -1})

    safe_command = _rewrite(command)
    try:
        result = subprocess.run(
            ['bash', '-c', safe_command],
            capture_output=True,
            cwd=_workspace_dir(),
            env=_env(),
            text=True,
            timeout=timeout,
        )
        output = {
            'stdout': result.stdout[-50000:] if len(result.stdout) > 50000 else result.stdout,
            'stderr': result.stderr[-5000:] if len(result.stderr) > 5000 else result.stderr,
            'exitCode': result.returncode,
        }
        _log(safe_command, output)
        return json.dumps(output)
    except subprocess.TimeoutExpired:
        output = {'error': 'timeout', 'timeout': timeout}
        _log(safe_command, output)
        return json.dumps(output)


def read_file(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            content = handle.read()
        if len(content) > 100000:
            return content[:100000] + f'\n\n[truncated — {len(content)} total chars]'
        return content
    except Exception as exc:
        return json.dumps({'error': str(exc)})


def write_file(path: str, content: str) -> str:
    for protected in _protected_paths():
        if path.startswith(protected):
            return json.dumps({'error': f'BLOCKED: cannot write to protected path {protected}'})
    try:
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(content)
        _log(f'write_file({path})', {'exitCode': 0})
        return json.dumps({'ok': True, 'path': path})
    except Exception as exc:
        return json.dumps({'error': str(exc)})


def list_files(path: str = '') -> str:
    target_path = path or _workspace_dir()
    try:
        result = subprocess.run(
            [
                'find',
                target_path,
                '-type',
                'f',
                '-maxdepth',
                '3',
                '-not',
                '-path',
                '*/node_modules/*',
                '-not',
                '-path',
                '*/.git/*',
                '-not',
                '-path',
                '*/dist/*',
                '-not',
                '-path',
                '*/.next/*',
            ],
            capture_output=True,
            env=_env(),
            text=True,
            timeout=10,
        )
        return result.stdout
    except Exception as exc:
        return json.dumps({'error': str(exc)})
