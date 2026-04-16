"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import contextlib
import json
import os

import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

from tools import agents as agents_mod
from tools import brain as brain_mod
from tools import github as github_mod
from tools import handoff as handoff_mod
from tools import sandbox as sandbox_mod
from tools import slack as slack_mod

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
REPO_TREE_FILE = os.environ.get('REPO_TREE_FILE', '')

mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
RO = {'readOnlyHint': True, 'openWorldHint': False}


def _resolve_steering_file() -> str:
    if os.path.exists(STEERING_FILE):
        return STEERING_FILE
    fallback = os.path.join(APP_DIR, 'BRAIN.example.md')
    return fallback if os.path.exists(fallback) else STEERING_FILE


def _read_optional_file(path: str) -> str:
    if not path:
        return ''
    if not os.path.exists(path):
        return ''
    with open(path, 'r', encoding='utf-8') as handle:
        return handle.read()


def _read_steering() -> str:
    steering_path = _resolve_steering_file()
    with open(steering_path, 'r', encoding='utf-8') as handle:
        content = handle.read()

    tree_content = _read_optional_file(REPO_TREE_FILE)
    if tree_content:
        content += '\n\n## optional repo tree\n' + tree_content

    skills = brain_mod.list_skills()
    try:
        skill_list = json.loads(skills)
        if isinstance(skill_list, list) and skill_list:
            content += '\n\n## available skills (call brain_get_skill(name) for full docs)\n'
            for skill in skill_list:
                content += f"- **{skill['name']}** — {skill.get('description', '')}\n"
    except Exception:
        content += '\n\n## available skills\n' + skills
    return content


@mcp.tool(annotations=RO)
@traceable(name='get_steering', run_type='tool')
def get_steering() -> str:
    """mandatory first call. returns the steering file and compact skill index."""
    return _read_steering()


@mcp.tool(annotations=RO)
@traceable(name='brain_search', run_type='tool')
def brain_search(query: str, limit: int = 10) -> str:
    """search memories by keyword. searches title and content."""
    return brain_mod.search(query, limit)


@mcp.tool(annotations=RO)
@traceable(name='brain_vector_search', run_type='tool')
def brain_vector_search(query: str, limit: int = 10) -> str:
    """semantic search over memories and chat history using vector embeddings."""
    return brain_mod.vector_search(query, limit)


@mcp.tool(annotations=RO)
@traceable(name='brain_remember', run_type='tool')
def brain_remember(content: str, category: str = 'observation', title: str = '') -> str:
    """save a new memory. categories: observation, decision, pattern, rule, context, skill."""
    return brain_mod.remember(content, category, title=title)


@mcp.tool(annotations=RO)
@traceable(name='brain_get_memory', run_type='tool')
def brain_get_memory(memory_id: str) -> str:
    """retrieve a specific memory by id."""
    return brain_mod.get_memory(memory_id)


@mcp.tool(annotations=RO)
@traceable(name='brain_list_skills', run_type='tool')
def brain_list_skills() -> str:
    """list available skill docs stored in memory."""
    return brain_mod.list_skills()


@mcp.tool(annotations=RO)
@traceable(name='brain_get_skill', run_type='tool')
def brain_get_skill(skill_name: str) -> str:
    """load a skill doc by name."""
    return brain_mod.get_skill(skill_name)


@mcp.tool(annotations=RO)
@traceable(name='sandbox_exec', run_type='tool')
def sandbox_exec(command: str, timeout: int = 120) -> str:
    """run a bash command on the host machine inside the configured workspace."""
    return sandbox_mod.exec(command, timeout)


@mcp.tool(annotations=RO)
@traceable(name='sandbox_read_file', run_type='tool')
def sandbox_read_file(path: str) -> str:
    """read a file from the host filesystem."""
    return sandbox_mod.read_file(path)


@mcp.tool(annotations=RO)
@traceable(name='sandbox_write_file', run_type='tool')
def sandbox_write_file(path: str, content: str) -> str:
    """write content to a file on the host filesystem."""
    return sandbox_mod.write_file(path, content)


@mcp.tool(annotations=RO)
@traceable(name='sandbox_list_files', run_type='tool')
def sandbox_list_files(path: str = '') -> str:
    """list files in a directory on the host. defaults to the configured workspace."""
    return sandbox_mod.list_files(path)


@mcp.tool(annotations=RO)
@traceable(name='github_get_file', run_type='tool')
def github_get_file(path: str, ref: str = 'main') -> str:
    """read a file from the configured github repository."""
    return github_mod.get_file(path, ref)


@mcp.tool(annotations=RO)
@traceable(name='github_get_pr', run_type='tool')
def github_get_pr(pr_number: int) -> str:
    """get a pull request by number."""
    return github_mod.get_pr(pr_number)


@mcp.tool(annotations=RO)
@traceable(name='github_list_prs', run_type='tool')
def github_list_prs(state: str = 'open', limit: int = 10) -> str:
    """list pull requests."""
    return github_mod.list_prs(state, limit)


@mcp.tool(annotations=RO)
@traceable(name='github_push_files', run_type='tool')
def github_push_files(branch: str, files: str, message: str) -> str:
    """push file changes to a branch in the configured github repository."""
    return github_mod.push_files(branch, files, message)


@mcp.tool(annotations=RO)
@traceable(name='invoke_opencode', run_type='tool')
def invoke_opencode(prompt: str, cwd: str = '') -> str:
    """spawn an opencode coding agent in tmux."""
    return agents_mod.invoke_opencode(prompt, cwd)


@mcp.tool(annotations=RO)
@traceable(name='invoke_kiro', run_type='tool')
def invoke_kiro(prompt: str, cwd: str = '') -> str:
    """spawn a kiro coding agent in tmux."""
    return agents_mod.invoke_kiro(prompt, cwd)


@mcp.tool(annotations=RO)
@traceable(name='slack_post', run_type='tool')
def slack_post(message: str) -> str:
    """post a message to a slack webhook."""
    return slack_mod.post(message)


@mcp.tool(annotations=RO)
@traceable(name='handoff_save', run_type='tool')
def handoff_save(context: str, session_id: str = '', tags: str = '') -> str:
    """save conversation context for later continuation."""
    return handoff_mod.save(context, session_id, tags)


@mcp.tool(annotations=RO)
@traceable(name='handoff_load', run_type='tool')
def handoff_load(session_id: str = '', query: str = '') -> str:
    """load previous conversation context by session id or keyword."""
    return handoff_mod.load(session_id, query)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path == '/health':
            return await call_next(request)
        if bearer_token:
            auth = request.headers.get('authorization', '')
            if auth != f'Bearer {bearer_token}':
                return JSONResponse({'error': 'unauthorized'}, status_code=401)
        return await call_next(request)


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
_pending_codes = {}  # code -> redirect_uri (short-lived, in-memory)


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
    return JSONResponse({'status': 'ok', 'tools': 20, 'name': SERVER_NAME})


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
