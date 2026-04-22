"""agent invocation tools — spawn opencode and kiro in tmux sessions."""

import json
import os
import subprocess
import time


def _default_cwd() -> str:
    configured = os.environ.get('WORKSPACE_DIR', '').strip()
    if configured:
        return configured
    return os.getcwd()


def invoke_opencode(prompt: str, cwd: str = '') -> str:
    target_cwd = cwd or _default_cwd()
    ts = int(time.time())
    session = f'oc-{ts}'
    prompt_file = f'/tmp/opencode-{ts}.md'

    with open(prompt_file, 'w', encoding='utf-8') as handle:
        handle.write(prompt)

    cmd = f'opencode run --dir {target_cwd} "$(cat {prompt_file})" 2>&1 | tee /tmp/opencode-{ts}.log'
    try:
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session, '-c', target_cwd, cmd],
            capture_output=True,
            text=True,
            timeout=10,
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

    cmd = f'kiro-cli chat --trust-all-tools --no-interactive --agent worker < {prompt_file} 2>&1 | tee /tmp/kiro-{ts}.log'
    try:
        subprocess.run(
            ['tmux', 'new-session', '-d', '-s', session, '-c', target_cwd, cmd],
            capture_output=True,
            text=True,
            timeout=10,
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
