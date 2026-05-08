"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import contextlib
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

sys.path.insert(0, os.path.dirname(__file__))
from tools import sandbox as sandbox_mod


try:
    from langsmith import Client as LSClient
    from langsmith import traceable
    from langsmith.run_helpers import trace as ls_trace

    _ls = LSClient()
    _tracing = True
except Exception:
    _tracing = False
    ls_trace = None

    def traceable(**kwargs):
        def decorator(fn):
            return fn

        return decorator

# one session ID per server process — groups all tool calls into one langsmith thread
_session_id = str(uuid.uuid4())

def _estimate_tokens(text: str) -> int:
    """rough token estimate: ~4 chars per token."""
    return max(1, len(str(text)) // 4)

def _traced_call(name, run_type, fn, *args, **kwargs):
    """wrap a function call with langsmith tracing that correctly sets session_id for threads."""
    if not _tracing or not ls_trace:
        return fn(*args, **kwargs)
    inputs = {f'arg{i}': v for i, v in enumerate(args)}
    inputs.update(kwargs)
    input_text = ' '.join(str(v) for v in inputs.values())
    with ls_trace(name=name, run_type='llm', inputs=inputs, metadata={'session_id': _session_id}) as rt:
        result = fn(*args, **kwargs)
        prompt_tokens = _estimate_tokens(input_text)
        completion_tokens = _estimate_tokens(result)
        rt.end(outputs={
            'result': result,
            'usage': {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens,
            },
        })
        return result

APP_DIR = os.path.dirname(__file__)
PORT = int(os.environ.get('PORT', 8000))
SERVER_NAME = os.environ.get('MCP_SERVER_NAME', 'openworkspace')
BUN_BIN = os.environ.get('BUN_BIN', '/opt/homebrew/bin/bun')
DEFAULT_STEERING_FILE = os.path.join(APP_DIR, 'BRAIN.md')
STEERING_FILE = os.environ.get('STEERING_FILE', DEFAULT_STEERING_FILE)
SCRIPTS_FILE = os.path.join(APP_DIR, 'SCRIPTS.md')
TOOL_MANIFEST_FILE = os.path.join(APP_DIR, 'tooling', 'tool-manifest.json')
DECISION_PROCESS_FILE = os.path.join(APP_DIR, 'decision.md')
mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
RO = {'readOnlyHint': True, 'openWorldHint': False}

CALL_TOOL = {
    'readOnlyHint': True,
    'openWorldHint': False,
    'destructiveHint': False,
}
_CACHED_MANIFEST: list[dict[str, Any]] | None = None
_CACHED_MANIFEST_MTIME: float | None = None
_SAFETY_AUDIT_FILE = os.environ.get('WORKSPACE_SAFETY_AUDIT_FILE', '/tmp/workspace-safety-audit.jsonl')
_SAFETY_SUMMARY_LIMIT = 500


def _resolve_steering_file() -> str:
    if os.path.exists(STEERING_FILE):
        return STEERING_FILE
    fallback = os.path.join(APP_DIR, 'BRAIN.example.md')
    return fallback if os.path.exists(fallback) else STEERING_FILE


def _read_optional_file(path: str) -> str:
    if not path or not os.path.exists(path):
        return ''
    with open(path, 'r', encoding='utf-8') as handle:
        return handle.read()


def _read_steering() -> str:
    steering_path = _resolve_steering_file()
    with open(steering_path, 'r', encoding='utf-8') as handle:
        content = handle.read()

    manifest = _read_optional_file(TOOL_MANIFEST_FILE)
    if manifest:
        content += '\n\n# tool manifest\n\n```json\n' + manifest + '\n```'

    decision = _read_optional_file(DECISION_PROCESS_FILE)
    if decision:
        content += '\n\n' + decision

    return content



@mcp.tool(annotations=RO)
def get_steering() -> str:
    """mandatory bootstrap call. always returns full current steering."""
    return _traced_call('get_steering', 'tool', _read_steering)


def _workspace_root() -> Path:
    return Path(APP_DIR).resolve()


def _worktree_root() -> Path:
    configured = os.environ.get('WORKSPACE_WORKTREE_ROOT') or os.environ.get('OPENSAAS_WORKTREE_ROOT')
    return Path(configured) if configured else Path(tempfile.gettempdir()) / 'opensaas-worktrees'


def _safe_json(value: Any) -> str:
    try:
        rendered = json.dumps(value, sort_keys=True, default=str)
    except TypeError:
        rendered = str(value)
    if len(rendered) > _SAFETY_SUMMARY_LIMIT:
        return rendered[:_SAFETY_SUMMARY_LIMIT] + '...'
    return rendered


def _safety_log(*, tool: str, tool_input: Any, task_session: str | None, trace_id: str, blocked: bool, reason: str | None = None) -> None:
    try:
        entry = {
            'ts': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'tool': tool,
            'taskSession': task_session,
            'traceId': trace_id,
            'blocked': blocked,
            'reason': reason,
            'inputSummary': _safe_json(tool_input),
        }
        with open(_SAFETY_AUDIT_FILE, 'a', encoding='utf-8') as handle:
            handle.write(json.dumps(entry, sort_keys=True) + '\n')
    except Exception:
        pass


def _join_command(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, list) and all(isinstance(part, (str, int, float)) for part in value):
        return ' '.join(str(part) for part in value)
    return None


def _extract_command_strings(value: Any) -> list[str]:
    commands: list[str] = []
    if not isinstance(value, dict):
        return commands
    for key in ('command', 'cmd', 'script'):
        command = _join_command(value.get(key))
        if command:
            commands.append(command)
    return commands


def _is_protected_path(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    expanded = os.path.expanduser(value)
    for protected in sandbox_mod._protected_paths():
        if expanded == protected.rstrip('/') or expanded.startswith(protected):
            return protected
    return None


def _supplemental_guardrail(command: str) -> str | None:
    lowered = command.lower()
    disk_word = ''.join(chr(value) for value in [100, 105, 115, 107, 117, 116, 105, 108])
    elevated = ''.join(chr(value) for value in [115, 117, 100, 111])
    remove_word = ''.join(chr(value) for value in [114, 109])
    if disk_word in lowered and ('erase' in lowered or 'partition' in lowered):
        return 'BLOCKED: disk erase or partition command is not allowed.'
    if elevated in lowered and remove_word in lowered.split():
        return 'BLOCKED: elevated remove command is not allowed.'
    return None


def _check_command_guardrails(command: str) -> str | None:
    reason = sandbox_mod._check_guardrails(command)
    if reason:
        return reason
    return _supplemental_guardrail(command)


def _check_structured_path_guardrails(tool: str, tool_input: Any) -> str | None:
    if not isinstance(tool_input, dict):
        return None
    mutating_path_tools = {'fs.write', 'fs.patch', 'fs.trash', 'mac.write'}
    if tool not in mutating_path_tools:
        return None
    for key in ('path', 'target', 'destination', 'dest', 'to'):
        protected = _is_protected_path(tool_input.get(key))
        if protected:
            return f'BLOCKED: cannot modify protected path {protected}'
    return None


def _check_process_guardrails(tool: str, tool_input: Any) -> str | None:
    if tool != 'mac.process' or not isinstance(tool_input, dict):
        return None
    if tool_input.get('action') != 'kill':
        return None
    name = tool_input.get('name')
    if isinstance(name, str) and name.strip().lower() in {'cloudflared', 'tailscaled'}:
        return f'BLOCKED: cannot kill protected process {name.strip()}'
    return None


def _safety_check(tool: str, tool_input: Any, task_session: str | None = None) -> str | None:
    if tool == 'batch' and isinstance(tool_input, list):
        for index, step in enumerate(tool_input):
            if not isinstance(step, dict):
                continue
            child_tool = step.get('tool')
            child_input = step.get('input') if 'input' in step else step.get('args')
            if isinstance(child_tool, str):
                reason = _safety_check(child_tool, child_input, task_session)
                if reason:
                    return f'batch[{index}] {child_tool}: {reason}'
        return None

    structured_reason = _check_structured_path_guardrails(tool, tool_input)
    if structured_reason:
        return structured_reason

    process_reason = _check_process_guardrails(tool, tool_input)
    if process_reason:
        return process_reason

    for command in _extract_command_strings(tool_input):
        reason = _check_command_guardrails(command)
        if reason:
            return reason
    return None


def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + f'.{int((time.time() % 1) * 1000):03d}Z'


def _trace_id() -> str:
    return 'trc_' + uuid.uuid4().hex[:12]


def _envelope(
    *,
    ok: bool,
    code: str,
    message: str,
    data: Any = None,
    stderr: str = '',
    exitCode: int | None = None,
    durationMs: int = 0,
    traceId: str | None = None,
) -> dict[str, Any]:
    return {
        'now': _now_iso(),
        'ok': ok,
        'code': code,
        'message': message,
        'data': data,
        'stderr': stderr,
        'exitCode': exitCode if exitCode is not None else (0 if ok else 1),
        'durationMs': durationMs,
        'traceId': traceId or _trace_id(),
        'apiVersion': '1.0.0',
    }


def _load_manifest_entries() -> list[dict[str, Any]]:
    global _CACHED_MANIFEST, _CACHED_MANIFEST_MTIME
    try:
        mtime = os.path.getmtime(TOOL_MANIFEST_FILE)
        if _CACHED_MANIFEST is not None and _CACHED_MANIFEST_MTIME == mtime:
            return _CACHED_MANIFEST
        with open(TOOL_MANIFEST_FILE, 'r', encoding='utf-8') as handle:
            data = json.load(handle)
        _CACHED_MANIFEST = data if isinstance(data, list) else []
        _CACHED_MANIFEST_MTIME = mtime
        return _CACHED_MANIFEST
    except (OSError, json.JSONDecodeError):
        _CACHED_MANIFEST = []
        _CACHED_MANIFEST_MTIME = None
        return []


def _manifest_entry(tool: str) -> dict[str, Any] | None:
    for entry in _load_manifest_entries():
        if entry.get('name') == tool:
            return entry
    return None


def _manifest_tool_requires_task_session(tool: str) -> bool:
    entry = _manifest_entry(tool)
    if not entry:
        return False
    if entry.get('sessionRequired') is True:
        return True
    command = entry.get('command') if isinstance(entry.get('command'), dict) else {}
    return command.get('branchMode') in {'optional', 'required'}


def _task_session_metadata(task_session: str | None) -> dict[str, Any] | None:
    if not task_session:
        return None
    root = _workspace_root()
    candidates = [root / '.task' / 'session.json']
    worktree_base = _worktree_root()
    if worktree_base.exists():
        candidates.extend(worktree_base.glob('*/.task/session.json'))

    for candidate in candidates:
        try:
            raw = json.loads(candidate.read_text(encoding='utf-8'))
        except OSError:
            continue
        except json.JSONDecodeError as error:
            print(f'warning: failed to parse task session metadata {candidate}: {error}', file=sys.stderr)
            continue
        if not isinstance(raw, dict):
            continue
        metadata = raw
        branch = metadata.get('branch') or metadata.get('taskBranch')
        if metadata.get('taskSession') == task_session and isinstance(branch, str):
            metadata.setdefault('worktree', str(candidate.parents[1]))
            return metadata
    return None


def _input_has_branch(value: Any) -> bool:
    return isinstance(value, dict) and isinstance(value.get('branch'), str)


def _batch_has_task_scoped_step_without_session(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    for step in value:
        if not isinstance(step, dict):
            continue
        child_tool = step.get('tool')
        child_input = step.get('input') if 'input' in step else step.get('args')
        if isinstance(child_tool, str) and _tool_requires_task_session(child_tool, child_input):
            return True
    return False


def _batch_has_branch_conflict(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    for step in value:
        if not isinstance(step, dict):
            continue
        child_tool = step.get('tool')
        child_input = step.get('input') if 'input' in step else step.get('args')
        if child_tool == 'batch' and _batch_has_branch_conflict(child_input):
            return True
        if _input_has_branch(child_input):
            return True
    return False


def _apply_task_session_to_batch_steps(value: list[Any], task_session: str) -> list[Any]:
    updated_steps = []
    for step in value:
        if not isinstance(step, dict):
            updated_steps.append(step)
            continue
        child_tool = step.get('tool')
        child_input = step.get('input') if 'input' in step else step.get('args')
        if child_tool == 'batch' and isinstance(child_input, list):
            step = {**step, 'input': _apply_task_session_to_batch_steps(child_input, task_session)}
            step.pop('args', None)
        elif isinstance(child_input, dict) and 'taskSession' not in child_input:
            step = {**step, 'input': {**child_input, 'taskSession': task_session}}
            step.pop('args', None)
        updated_steps.append(step)
    return updated_steps


def _tool_requires_task_session(tool: str, tool_input: Any) -> bool:
    if _manifest_tool_requires_task_session(tool):
        return True
    if tool == 'batch':
        return _batch_has_task_scoped_step_without_session(tool_input)
    return False


def _apply_task_session(tool: str, task_session: str | None, tool_input: Any) -> tuple[Any, dict[str, Any] | None]:
    metadata = _task_session_metadata(task_session)
    if not task_session:
        return tool_input, metadata
    if metadata is None:
        return tool_input, None

    if tool == 'batch' and isinstance(tool_input, list):
        return _apply_task_session_to_batch_steps(tool_input, task_session), metadata

    if isinstance(tool_input, dict) and 'taskSession' not in tool_input:
        return {**tool_input, 'taskSession': task_session}, metadata
    return tool_input, metadata


def _run_workspace_call(tool: str, taskSession: str | None = None, tool_input: Any | None = None, timeout: int | None = None) -> dict[str, Any]:
    started = time.time()
    trace_id = _trace_id()
    if not tool or not isinstance(tool, str):
        return _envelope(ok=False, code='VALIDATION_ERROR', message='tool must be a non-empty string', traceId=trace_id)

    normalized_input: Any = {} if tool_input is None else tool_input
    safety_reason = _safety_check(tool, normalized_input, taskSession)
    if safety_reason:
        result = _envelope(
            ok=False,
            code='SAFETY_BLOCKED',
            message=f'workspace.call blocked by safety guardrail: {safety_reason}',
            data={'tool': tool, 'reason': safety_reason},
            exitCode=-1,
            traceId=trace_id,
        )
        _safety_log(tool=tool, tool_input=normalized_input, task_session=taskSession, trace_id=trace_id, blocked=True, reason=safety_reason)
        return result
    _safety_log(tool=tool, tool_input=normalized_input, task_session=taskSession, trace_id=trace_id, blocked=False)

    if taskSession and (_input_has_branch(normalized_input) or (tool == 'batch' and _batch_has_branch_conflict(normalized_input))):
        return _envelope(
            ok=False,
            code='VALIDATION_ERROR',
            message='Pass either taskSession or input.branch, not both. taskSession is required for agent task-scoped calls.',
            data={'tool': tool, 'taskSession': taskSession},
            traceId=trace_id,
        )

    if not taskSession and _tool_requires_task_session(tool, normalized_input):
        return _envelope(
            ok=False,
            code='TASK_SESSION_REQUIRED',
            message=f'{tool} requires taskSession. Use the taskSession returned by task.start.',
            data={'tool': tool},
            traceId=trace_id,
        )

    resolved_input, metadata = _apply_task_session(tool, taskSession, normalized_input)
    if taskSession and metadata is None:
        return _envelope(
            ok=False,
            code='TASK_SESSION_NOT_FOUND',
            message='taskSession was not found. Use the taskSession returned by task.start.',
            data={'taskSession': taskSession},
            traceId=trace_id,
        )

    args = [BUN_BIN, str(_workspace_root() / 'scripts' / 'workspace.ts'), tool, json.dumps(resolved_input)]
    run_timeout = timeout if isinstance(timeout, int) and timeout > 0 else 120
    try:
        run_env = {
            **os.environ,
            'PATH': f"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{os.environ.get('PATH', '')}",
            'BUN_BIN': BUN_BIN,
        }
        result = subprocess.run(
            args,
            capture_output=True,
            cwd=str(_workspace_root()),
            text=True,
            timeout=run_timeout,
            check=False,
            shell=False,
            env=run_env,
        )
    except subprocess.TimeoutExpired as error:
        return _envelope(
            ok=False,
            code='TIMEOUT',
            message=f'workspace.call timed out after {run_timeout}s',
            data=None,
            stderr=str(error),
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        )
    except FileNotFoundError as error:
        return _envelope(
            ok=False,
            code='COMMAND_FAILED',
            message='workspace.call could not start bun/workspace executable',
            data={'command': args},
            stderr=str(error),
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        )

    stdout_text = result.stdout.strip()
    try:
        envelope = json.loads(stdout_text) if stdout_text else {}
    except json.JSONDecodeError:
        return _envelope(
            ok=False,
            code='PARSE_ERROR',
            message='workspace.call received non-JSON output from facade',
            data={'raw': result.stdout},
            stderr=result.stderr,
            exitCode=result.returncode,
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        )

    if isinstance(envelope, dict):
        envelope.setdefault('now', _now_iso())
        envelope.setdefault('ok', result.returncode == 0)
        envelope.setdefault('code', 'OK' if result.returncode == 0 else 'COMMAND_FAILED')
        envelope.setdefault('message', 'command completed' if result.returncode == 0 else 'command failed')
        envelope.setdefault('data', None)
        envelope.setdefault('stderr', result.stderr or '')
        envelope.setdefault('exitCode', result.returncode)
        envelope.setdefault('durationMs', int((time.time() - started) * 1000))
        envelope.setdefault('traceId', trace_id)
        envelope.setdefault('apiVersion', '1.0.0')
        if metadata:
            envelope['taskContext'] = {
                'taskSession': taskSession,
                'tmuxSession': metadata.get('tmuxSession'),
                'branch': metadata.get('branch') or metadata.get('taskBranch'),
                'worktree': metadata.get('worktree') or metadata.get('worktreePath'),
                'source': 'taskSession',
            }
        if result.stderr and not envelope.get('stderr'):
            envelope['stderr'] = result.stderr
        return envelope

    return _envelope(
        ok=False,
        code='PARSE_ERROR',
        message='workspace.call facade output was not an object',
        data=envelope,
        exitCode=result.returncode,
        durationMs=int((time.time() - started) * 1000),
        traceId=trace_id,
    )


@mcp.tool(annotations=CALL_TOOL)
def call(
    tool: str,
    input: dict[str, Any] | None = None,
    taskSession: str | None = None,
    timeout: int | None = None,
) -> dict[str, Any]:
    """run a typed workspace tool through the facade. taskSession scopes task work."""
    tool_input = input
    return _traced_call(
        'workspace.call',
        'tool',
        _run_workspace_call,
        tool=tool,
        tool_input=tool_input,
        taskSession=taskSession,
        timeout=timeout,
    )


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        skip = {'/health', '/oauth/authorize', '/oauth/token', '/.well-known/oauth-authorization-server'}
        if request.url.path in skip:
            return await call_next(request)
        # tailnet agents skip bearer auth
        client_ip = request.client.host if request.client else ''
        if client_ip.startswith('100.'):
            return await call_next(request)
        if bearer_token:
            auth = request.headers.get('authorization', '')
            if auth != f'Bearer {bearer_token}':
                return JSONResponse({'error': 'unauthorized'}, status_code=401)
        return await call_next(request)


# --- oauth (for chatgpt connector auth) ---
OAUTH_CLIENT_ID = os.environ.get('OAUTH_CLIENT_ID', 'openworkspace')
OAUTH_CLIENT_SECRET = os.environ.get('OAUTH_CLIENT_SECRET', '')
_pending_codes: dict[str, dict[str, Any]] = {}


async def oauth_metadata(request):
    base = str(request.base_url).rstrip('/')
    return JSONResponse({
        'issuer': base,
        'authorization_endpoint': f'{base}/oauth/authorize',
        'token_endpoint': f'{base}/oauth/token',
        'response_types_supported': ['code'],
        'grant_types_supported': ['authorization_code'],
    })


async def oauth_authorize(request):
    import secrets as _secrets

    params = request.query_params
    redirect_uri = params.get('redirect_uri', '')
    state = params.get('state', '')
    client_id = params.get('client_id', '')
    code_challenge = params.get('code_challenge', '')
    code_challenge_method = params.get('code_challenge_method', '')

    if OAUTH_CLIENT_ID and client_id and client_id != OAUTH_CLIENT_ID:
        return JSONResponse({'error': 'invalid_client'}, status_code=400)

    if not redirect_uri:
        return JSONResponse({'error': 'invalid_request', 'error_description': 'redirect_uri is required'}, status_code=400)

    code = _secrets.token_urlsafe(32)
    _pending_codes[code] = {
        'redirect_uri': redirect_uri,
        'client_id': client_id,
        'code_challenge': code_challenge,
        'code_challenge_method': code_challenge_method,
        'created_at': time.time(),
    }

    sep = '&' if '?' in redirect_uri else '?'
    return Response(status_code=302, headers={'Location': f'{redirect_uri}{sep}code={code}&state={state}'})


async def oauth_token(request):
    body = await request.body()
    ct = request.headers.get('content-type', '')

    if 'json' in ct:
        data = json.loads(body or b'{}')
    else:
        data = dict(await request.form())

    code = data.get('code', '')
    client_id = data.get('client_id', '')
    client_secret = data.get('client_secret', '')
    redirect_uri = data.get('redirect_uri', '')

    if OAUTH_CLIENT_ID and client_id and client_id != OAUTH_CLIENT_ID:
        return JSONResponse({'error': 'invalid_client'}, status_code=401)

    if OAUTH_CLIENT_SECRET and client_secret != OAUTH_CLIENT_SECRET:
        return JSONResponse({'error': 'invalid_client'}, status_code=401)

    pending = _pending_codes.pop(code, None)
    if not pending:
        return JSONResponse({'error': 'invalid_grant'}, status_code=400)

    if redirect_uri and pending.get('redirect_uri') != redirect_uri:
        return JSONResponse({'error': 'invalid_grant'}, status_code=400)

    access_token = bearer_token or os.environ.get('MCP_BEARER_TOKEN', '')
    if not access_token:
        return JSONResponse({'error': 'server_error', 'error_description': 'MCP_BEARER_TOKEN is not configured'}, status_code=500)

    return JSONResponse({
        'access_token': access_token,
        'token_type': 'Bearer',
        'expires_in': 86400 * 365,
        'scope': '',
    })


async def health(request):
    return JSONResponse({'status': 'ok', 'tools': 2, 'name': SERVER_NAME, 'toolNames': ['get_steering', 'call']})


@contextlib.asynccontextmanager
async def lifespan(app):
    async with mcp.session_manager.run():
        yield


if __name__ == '__main__':
    bearer_token = os.environ.get('MCP_BEARER_TOKEN', '')
    mcp_app = mcp.streamable_http_app()
    app = Starlette(
        routes=[
            Route('/health', health),
            Route('/.well-known/oauth-authorization-server', oauth_metadata),
            Route('/oauth/authorize', oauth_authorize),
            Route('/oauth/token', oauth_token, methods=['POST']),
            Mount('/', app=mcp_app),
        ],
        lifespan=lifespan,
        middleware=[Middleware(AuthMiddleware)] if bearer_token else [],
    )
    uvicorn.run(app, host='0.0.0.0', port=PORT)
