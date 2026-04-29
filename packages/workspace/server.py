"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import contextlib
import json
import os
import uuid

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

def _traced_call(name, run_type, fn, *args, **kwargs):
    """wrap a function call with langsmith tracing that correctly sets session_id for threads."""
    if not _tracing or not ls_trace:
        return fn(*args, **kwargs)
    inputs = {f'arg{i}': v for i, v in enumerate(args)}
    inputs.update(kwargs)
    with ls_trace(name=name, run_type=run_type, inputs=inputs, metadata={'session_id': _session_id}) as rt:
        result = fn(*args, **kwargs)
        rt.end(outputs={'result': result})
        return result

APP_DIR = os.path.dirname(__file__)
PORT = int(os.environ.get('PORT', 8000))
SERVER_NAME = os.environ.get('MCP_SERVER_NAME', 'openworkspace')
DEFAULT_STEERING_FILE = os.path.join(APP_DIR, 'BRAIN.md')
STEERING_FILE = os.environ.get('STEERING_FILE', DEFAULT_STEERING_FILE)
SCRIPTS_FILE = os.path.join(APP_DIR, 'SCRIPTS.md')

mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
RO = {'readOnlyHint': True, 'openWorldHint': False}


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
def get_steering() -> str:
    """mandatory first call. returns the steering file and workspace scripts reference."""
    return _traced_call('get_steering', 'tool', _read_steering)


@mcp.tool(annotations=RO)
def sandbox_exec(command: str, timeout: int = 120) -> str:
    """run a bash command on the host machine inside the configured workspace."""
    return _traced_call('sandbox_exec', 'tool', sandbox_mod.exec, command=command, timeout=timeout)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        skip = {'/health', '/oauth/authorize', '/oauth/token', '/.well-known/oauth-authorization-server'}
        if request.url.path in skip:
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
