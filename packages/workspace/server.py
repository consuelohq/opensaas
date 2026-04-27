"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import contextlib
from contextvars import ContextVar
import json
import math
import os

import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

from tools import sandbox as sandbox_mod

try:
    from langsmith import Client as LSClient
    from langsmith import traceable

    _ls = LSClient()
    _tracing = True
except Exception:
    _tracing = False

    def traceable(**kwargs):
        def decorator(fn):
            return fn

        return decorator

APP_DIR = os.path.dirname(__file__)
PORT = int(os.environ.get('PORT', 8000))
SERVER_NAME = os.environ.get('MCP_SERVER_NAME', 'openworkspace')
DEFAULT_STEERING_FILE = os.path.join(APP_DIR, 'BRAIN.md')
STEERING_FILE = os.environ.get('STEERING_FILE', DEFAULT_STEERING_FILE)
SCRIPTS_FILE = os.path.join(APP_DIR, 'SCRIPTS.md')

mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
RO = {'readOnlyHint': True, 'openWorldHint': False}
REQUEST_TRACE_METADATA: ContextVar[dict] = ContextVar('request_trace_metadata', default={})


def _stringify_for_trace(value) -> str:
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, sort_keys=True, default=str)
    except Exception:
        return str(value)


def _estimate_tokens(value) -> int:
    text = _stringify_for_trace(value)
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def _request_thread_metadata(request) -> dict:
    headers = request.headers
    candidates = (
        ('x-langsmith-thread-id', 'header:x-langsmith-thread-id'),
        ('x-thread-id', 'header:x-thread-id'),
        ('x-conversation-id', 'header:x-conversation-id'),
        ('x-session-id', 'header:x-session-id'),
        ('mcp-session-id', 'header:mcp-session-id'),
    )

    for header, source in candidates:
        value = headers.get(header)
        if value:
            return {'thread_id': value, 'thread_source': source}

    return {}


def _workspace_thread_metadata() -> dict:
    request_metadata = REQUEST_TRACE_METADATA.get({})
    if request_metadata.get('thread_id'):
        return request_metadata

    for key in ('WORKSPACE_LANGSMITH_THREAD_ID', 'LANGSMITH_THREAD_ID', 'LANGCHAIN_THREAD_ID'):
        value = os.environ.get(key)
        if value:
            return {'thread_id': value, 'thread_source': f'env:{key}'}

    return {}


def _sandbox_output_metadata(output) -> dict:
    if not isinstance(output, str):
        return {}

    try:
        parsed = json.loads(output)
    except Exception:
        return {}

    if not isinstance(parsed, dict):
        return {}

    stdout = parsed.get('stdout') if isinstance(parsed.get('stdout'), str) else ''
    stderr = parsed.get('stderr') if isinstance(parsed.get('stderr'), str) else ''
    return {
        'workspace_stdout_chars': len(stdout),
        'workspace_stdout_tokens_estimated': _estimate_tokens(stdout),
        'workspace_stderr_chars': len(stderr),
        'workspace_stderr_tokens_estimated': _estimate_tokens(stderr),
        'workspace_exit_code': parsed.get('exitCode'),
    }


def _annotate_current_run(tool_name: str, inputs, output) -> None:
    try:
        from langsmith.run_helpers import get_current_run_tree

        run = get_current_run_tree()
        if not run:
            return

        metadata = {
            'workspace_tool_name': tool_name,
            'workspace_input_chars': len(_stringify_for_trace(inputs)),
            'workspace_input_tokens_estimated': _estimate_tokens(inputs),
            'workspace_output_chars': len(_stringify_for_trace(output)),
            'workspace_output_tokens_estimated': _estimate_tokens(output),
            'workspace_token_estimator': 'chars_div_4_ceil',
        }
        metadata.update(_sandbox_output_metadata(output))

        thread_metadata = _workspace_thread_metadata()
        if thread_metadata.get('thread_id'):
            metadata['thread_id'] = thread_metadata['thread_id']
            metadata['workspace_thread_source'] = thread_metadata.get('thread_source', 'unknown')

        run.metadata.update(metadata)
    except Exception:
        return


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

    scripts = _read_optional_file(SCRIPTS_FILE)
    if scripts:
        content += '\n\n' + scripts

    return content


@mcp.tool(annotations=RO)
@traceable(name='get_steering', run_type='tool')
def get_steering() -> str:
    """mandatory first call. returns the steering file and workspace scripts reference."""
    content = _read_steering()
    _annotate_current_run('get_steering', {}, content)
    return content


@mcp.tool(annotations=RO)
@traceable(name='sandbox_exec', run_type='tool')
def sandbox_exec(command: str, timeout: int = 120) -> str:
    """run a bash command on the host machine inside the configured workspace."""
    output = sandbox_mod.exec(command, timeout)
    _annotate_current_run('sandbox_exec', {'command': command, 'timeout': timeout}, output)
    return output


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        token = REQUEST_TRACE_METADATA.set(_request_thread_metadata(request))
        try:
            skip = {'/health', '/oauth/authorize', '/oauth/token', '/.well-known/oauth-authorization-server'}
            if request.url.path in skip:
                return await call_next(request)
            if bearer_token:
                auth = request.headers.get('authorization', '')
                if auth != f'Bearer {bearer_token}':
                    return JSONResponse({'error': 'unauthorized'}, status_code=401)
            return await call_next(request)
        finally:
            REQUEST_TRACE_METADATA.reset(token)


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
    return JSONResponse({'status': 'ok', 'tools': 2, 'name': SERVER_NAME})


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
