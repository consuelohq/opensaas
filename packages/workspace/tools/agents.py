"""agent invocation tools — spawn opencode and kiro in tmux sessions."""

import json
import os
import subprocess
import time
from pathlib import Path

_KIRO_CLI = '/Users/kokayi/.local/bin/kiro-cli'
_OPENCODE = '/Users/kokayi/.opencode/bin/opencode'


def _default_cwd() -> str:
    configured = os.environ.get('WORKSPACE_DIR', '').strip()
    if configured:
        return configured
    return os.getcwd()


def _agent_env() -> dict[str, str]:
    """build an env with a reliable PATH for tmux child processes."""
    env = os.environ.copy()
    home = Path.home()
    candidate_dirs = [
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
    existing = [str(d) for d in candidate_dirs if d.is_dir()]
    env['PATH'] = ':'.join(existing)
    env['HOME'] = str(home)
    return env


def invoke_opencode(prompt: str, cwd: str = '') -> str:
    target_cwd = cwd or _default_cwd()
    ts = int(time.time())
    session = f'oc-{ts}'
    prompt_file = f'/tmp/opencode-{ts}.md'

    with open(prompt_file, 'w', encoding='utf-8') as handle:
        handle.write(prompt)

    cmd = f'{_OPENCODE} run --dir {target_cwd} "$(cat {prompt_file})" 2>&1 | tee /tmp/opencode-{ts}.log'
    try:
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session, '-c', target_cwd, cmd],
            capture_output=True,
            text=True,
            timeout=10,
            env=_agent_env(),
        )
        return json.dumps(
            {
                'spawned': True,
                'session': session,
                'prompt_file': prompt_file,
                'log_file': f'/tmp/opencode-{ts}.log',
                'attach': f'tmux attach -t {session}',
            }
        )
    except Exception as exc:
        return json.dumps({'error': str(exc)})


def invoke_kiro(prompt: str, cwd: str = '') -> str:
    target_cwd = cwd or _default_cwd()
    ts = int(time.time())
    session = f'kiro-{ts}'
    prompt_file = f'/tmp/kiro-{ts}.md'

    with open(prompt_file, 'w', encoding='utf-8') as handle:
        handle.write(prompt)

    cmd = f'{_KIRO_CLI} chat --trust-all-tools --no-interactive --agent worker < {prompt_file} 2>&1 | tee /tmp/kiro-{ts}.log'
    try:
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session, '-c', target_cwd, cmd],
            capture_output=True,
            text=True,
            timeout=10,
            env=_agent_env(),
        )
        return json.dumps(
            {
                'spawned': True,
                'session': session,
                'prompt_file': prompt_file,
                'log_file': f'/tmp/kiro-{ts}.log',
                'attach': f'tmux attach -t {session}',
            }
        )
    except Exception as exc:
        return json.dumps({'error': str(exc)})
