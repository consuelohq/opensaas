"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import contextlib
import json
import os
import subprocess
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
DEFAULT_STEERING_FILE = os.path.join(APP_DIR, 'BRAIN.md')
STEERING_FILE = os.environ.get('STEERING_FILE', DEFAULT_STEERING_FILE)
SCRIPTS_FILE = os.path.join(APP_DIR, 'SCRIPTS.md')
TOOL_MANIFEST_FILE = os.path.join(APP_DIR, 'tooling', 'tool-manifest.json')
DECISION_PROCESS_FILE = os.path.join(APP_DIR, 'decision.md')
TASK_SESSION_REQUIRED_TOOLS = {
    'fs.read', 'fs.search', 'fs.list', 'fs.write', 'fs.patch', 'fs.trash',
    'task.exec', 'task.push', 'task.pr', 'task.finish', 'review.run', 'verify',
    'checkFiles', 'editFlow',
}

mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
RO = {'readOnlyHint': True, 'openWorldHint': False}
_STEERING_LOADED = False


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
def get_steering() -> dict | str:
    """mandatory bootstrap call. returns full steering once per server process."""
    global _STEERING_LOADED
    if _STEERING_LOADED:
        return {
            'ok': True,
            'code': 'ALREADY_LOADED',
            'message': 'Steering is already loaded for this session. Use workspace.call for workspace operations.',
            'data': {'loaded': True},
        }

    _STEERING_LOADED = True
    return _traced_call('get_steering', 'tool', _read_steering)


def _workspace_root() -> Path:
    return Path(APP_DIR).resolve()


def _task_session_metadata(task_session: str | None) -> dict[str, Any] | None:
    if not task_session:
        return None

    root = _workspace_root()
    candidates = [root / '.task' / 'session.json']
    worktree_base = Path('/private/tmp/opensaas-worktrees')
    if worktree_base.exists():
        candidates.extend(worktree_base.glob('*/.task/session.json'))

    for candidate in candidates:
        try:
            metadata = json.loads(candidate.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            continue
        if metadata.get('taskSession') == task_session:
            metadata.setdefault('worktree', str(candidate.parents[1]))
            return metadata
    return None


def _apply_task_session(tool: str, task_session: str | None, input_data: Any) -> tuple[Any, dict[str, Any] | None]:
    metadata = _task_session_metadata(task_session)
    if not task_session:
        return input_data, metadata
    if metadata is None:
        return input_data, None

    if tool == 'batch' and isinstance(input_data, list):
        updated_steps = []
        for step in input_data:
            if not isinstance(step, dict):
                updated_steps.append(step)
                continue
            child_input = step.get('input') if isinstance(step.get('input'), dict) else step.get('args')
            if isinstance(child_input, dict) and 'taskSession' not in child_input and 'branch' not in child_input:
                child_input = {**child_input, 'taskSession': task_session}
                step = {**step, 'input': child_input}
                step.pop('args', None)
            updated_steps.append(step)
        return updated_steps, metadata

    if isinstance(input_data, dict) and 'taskSession' not in input_data and 'branch' not in input_data:
        return {**input_data, 'taskSession': task_session}, metadata
    return input_data, metadata


def _has_explicit_branch(input_data: Any) -> bool:
    return isinstance(input_data, dict) and isinstance(input_data.get('branch'), str)


def _tool_requires_task_session(tool: str, input_data: Any) -> bool:
    if tool in TASK_SESSION_REQUIRED_TOOLS:
        return True

    if tool == 'batch' and isinstance(input_data, list):
        for step in input_data:
            if not isinstance(step, dict):
                continue
            child_tool = step.get('tool')
            child_input = step.get('input') if 'input' in step else step.get('args')
            if isinstance(child_tool, str) and _tool_requires_task_session(child_tool, child_input):
                return True

    return False


def _missing_task_session_error(tool: str) -> dict[str, Any]:
    return {
        'ok': False,
        'code': 'TASK_SESSION_REQUIRED',
        'message': f'{tool} requires taskSession. Use the taskSession returned by task.start or pass explicit input.branch as a compatibility escape hatch.',
        'data': {'tool': tool},
    }


def _run_workspace_call(tool: str, taskSession: str | None = None, input: Any | None = None, timeout: int | None = None) -> dict[str, Any]:
    if not tool or not isinstance(tool, str):
        return {'ok': False, 'code': 'VALIDATION_ERROR', 'message': 'tool must be a non-empty string', 'data': None}

    input_data: Any = {} if input is None else input
    if not taskSession and _tool_requires_task_session(tool, input_data) and not _has_explicit_branch(input_data):
        return _missing_task_session_error(tool)

    resolved_input, metadata = _apply_task_session(tool, taskSession, input_data)
    if taskSession and metadata is None:
        return {
            'ok': False,
            'code': 'TASK_SESSION_NOT_FOUND',
            'message': 'taskSession was not found. Use the taskSession returned by task.start.',
            'data': {'taskSession': taskSession},
        }

    args = ['bun', str(_workspace_root() / 'scripts' / 'workspace.ts'), tool, json.dumps(resolved_input)]
    run_timeout = timeout if isinstance(timeout, int) and timeout > 0 else 120
    try:
        result = subprocess.run(args, capture_output=True, cwd=str(_workspace_root()), text=True, timeout=run_timeout)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'code': 'TIMEOUT', 'message': f'workspace.call timed out after {run_timeout}s', 'data': None}

    stdout_text = result.stdout.strip()
    try:
        envelope = json.loads(stdout_text) if stdout_text else {}
    except json.JSONDecodeError:
        return {
            'ok': False,
            'code': 'PARSE_ERROR',
            'message': 'workspace.call received non-JSON output from facade',
            'data': {'raw': result.stdout},
            'stderr': result.stderr,
            'exitCode': result.returncode,
        }

    if isinstance(envelope, dict):
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

    return {'ok': False, 'code': 'PARSE_ERROR', 'message': 'workspace.call facade output was not an object', 'data': envelope}


@mcp.tool()
def call(tool: str, input: Any | None = None, taskSession: str | None = None, timeout: int | None = None) -> dict[str, Any]:
    """run a typed workspace tool through the facade. taskSession scopes task work."""
    return _traced_call('workspace.call', 'tool', _run_workspace_call, tool=tool, input=input, taskSession=taskSession, timeout=timeout)


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
_pending_codes = {}


async def oauth_metadata(request):
    base = str(request.base_url).rstrip('/')
    return JSONResponse({
        'issuer': base,
        'authorization_endpoint': f'{base}/oauth/authorize',
        'token_endpoint': f'{base}/oauth/token',
        'response_types_supported': ['code'],
        'grant_types_supported': ['authorization_code'],
        'code_challenge_methods_supported': ['S256'],
    })


async def oauth_authorize(request):
    import secrets as _secrets
    params = request.query_params
    redirect_uri = params.get('redirect_uri', '')
    state = params.get('state', '')
    code = _secrets.token_urlsafe(32)
    _pending_codes[code] = redirect_uri
    sep = '&' if '?' in redirect_uri else '?'
    return Response(status_code=302, headers={'Location': f'{redirect_uri}{sep}code={code}&state={state}'})


async def oauth_token(request):
    body = await request.body()
    ct = request.headers.get('content-type', '')
    if 'json' in ct:
        data = json.loads(body)
    else:
        data = dict(await request.form())
    code = data.get('code', '')
    client_secret = data.get('client_secret', '')
    if OAUTH_CLIENT_SECRET and client_secret != OAUTH_CLIENT_SECRET:
        return JSONResponse({'error': 'invalid_client'}, status_code=401)
    if code not in _pending_codes:
        return JSONResponse({'error': 'invalid_grant'}, status_code=400)
    del _pending_codes[code]
    return JSONResponse({
        'access_token': bearer_token,
        'token_type': 'bearer',
        'expires_in': 86400 * 365,
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
