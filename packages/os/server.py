"""Legacy Consuelo OS Python transport wrapper.

The product runtime path is Bun/TypeScript. This file remains temporarily as a
compatibility wrapper until the Bun server fully replaces Python transport needs.
"""

import json
import os
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route

APP_DIR = Path(__file__).parent
PORT = int(os.environ.get('CONSUELO_OS_PORT') or os.environ.get('PORT', 8850))
SERVER_NAME = os.environ.get('CONSUELO_OS_SERVER_NAME') or os.environ.get('MCP_SERVER_NAME', 'consuelo-os')
BUN_BIN = os.environ.get('BUN_BIN', 'bun')

STEERING_FILES = [
    APP_DIR / 'STEERING.md',
    APP_DIR / 'business-context.md',
    APP_DIR / 'data-model.md',
    APP_DIR / 'permissions.md',
    APP_DIR / 'integrations.md',
    APP_DIR / 'skills.md',
]
MANIFEST_FILE = APP_DIR / 'manifests' / 'core.manifest.json'
DEV_STEERING_FILE = APP_DIR / 'dev-steering.md'
DEV_DECISION_FILE = APP_DIR / 'decision.md'
DEV_MANIFEST_FILE = APP_DIR / 'manifests' / 'tool.manifest.json'

mcp = FastMCP(SERVER_NAME, host='0.0.0.0', port=PORT, stateless_http=True, json_response=True)
READ_ONLY = {'readOnlyHint': True, 'openWorldHint': False}
CALL_TOOL = {'readOnlyHint': False, 'openWorldHint': False, 'destructiveHint': False}


def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def _trace_id() -> str:
    return f"trc_{uuid.uuid4().hex[:12]}"


def _read_file(path: Path) -> str:
    if not path.exists():
        return ''
    return path.read_text(encoding='utf-8')


def _safe_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _env_presence() -> dict[str, Any]:
    url = os.environ.get('CONSUELO_GRAPHQL_URL', '')
    host = ''
    if url:
        try:
            from urllib.parse import urlparse

            host = urlparse(url).netloc
        except Exception:
            host = 'invalid-url'
    return {
        'workspaceId': os.environ.get('CONSUELO_WORKSPACE_ID', ''),
        'userId': os.environ.get('CONSUELO_USER_ID', ''),
        'graphqlUrlHost': host,
        'hasGraphqlApiKey': bool(os.environ.get('CONSUELO_INTERNAL_GRAPHQL_API_KEY')),
    }


@mcp.tool(annotations=READ_ONLY)
def get_steering() -> str:
    """Return OS steering, business context, permissions, and raw core tool manifest."""
    sections = [
        '# Consuelo OS runtime context',
        '',
        '## Runtime identity',
        '',
        '```json',
        _safe_json(_env_presence()),
        '```',
    ]

    for file_path in STEERING_FILES:
        content = _read_file(file_path)
        if content:
            sections.extend(['', f'# {file_path.name}', '', content])

    manifest = _read_file(MANIFEST_FILE)
    if manifest:
        sections.extend([
            '',
            '# tool discovery routing',
            '',
            'Use core tools directly when present. Use tools.search when a tool, provider, deployment surface, product area, or workflow is mentioned but is not in core steering.',
            '',
            '# raw core tool manifest',
            '',
            '```json',
            manifest,
            '```',
        ])

    return '\n'.join(sections)


@mcp.tool(annotations=READ_ONLY)
def get_dev_steering() -> str:
    """Return original workspace steering with a short Consuelo OS dev/operator preface."""
    sections = [
        '# Consuelo OS dev/operator steering',
        '',
        'This surface is for build, design, deployment, debugging, and internal operator agents.',
        'It intentionally preserves the proven workspace steering pattern so OS capabilities can be repurposed instead of rebuilt.',
        'Use this context for landing pages, Consuelo Design, GitHub, Supabase/auth, deployment, file workflows, and operator/debug tasks.',
        '',
    ]
    dev_steering = _read_file(DEV_STEERING_FILE)
    if dev_steering:
        sections.extend(['# original workspace STEERING.md', '', dev_steering])
    decision = _read_file(DEV_DECISION_FILE)
    if decision:
        sections.extend(['', '# original workspace decision.md', '', decision])
    manifest = _read_file(DEV_MANIFEST_FILE)
    if manifest:
        sections.extend(['', '# canonical full tool manifest', '', '```json', manifest, '```'])
    return '\n'.join(sections)


@mcp.tool(annotations=CALL_TOOL)
def call(
    name: str,
    input: Any | None = None,
    workspaceId: str | None = None,
    userId: str | None = None,
) -> dict[str, Any]:
    """Execute a named OS skill through the Bun runtime."""
    started = time.time()
    trace_id = _trace_id()
    payload = {
        'name': name,
        'input': input or {},
        'workspaceId': workspaceId,
        'userId': userId,
    }
    command = [BUN_BIN, str(APP_DIR / 'scripts' / 'os.ts'), 'call', json.dumps(payload)]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            cwd=str(APP_DIR),
            text=True,
            timeout=60,
            check=False,
            env={
                **os.environ,
                'PATH': f"/opt/homebrew/bin:/usr/local/bin:{os.environ.get('PATH', '')}",
            },
        )
    except subprocess.TimeoutExpired:
        return {
            'ok': False,
            'name': name,
            'permission': 'read',
            'error': {'code': 'TIMEOUT', 'message': 'skill timed out'},
            'traceId': trace_id,
            'durationMs': int((time.time() - started) * 1000),
        }

    try:
        parsed = json.loads(result.stdout or '{}')
    except json.JSONDecodeError:
        return {
            'ok': False,
            'name': name,
            'permission': 'read',
            'error': {'code': 'PARSE_ERROR', 'message': 'skill returned non-JSON output'},
            'traceId': trace_id,
            'durationMs': int((time.time() - started) * 1000),
        }

    if isinstance(parsed, dict):
        parsed.setdefault('traceId', trace_id)
        parsed.setdefault('durationMs', int((time.time() - started) * 1000))
        return parsed

    return {
        'ok': False,
        'name': name,
        'permission': 'read',
        'error': {'code': 'PARSE_ERROR', 'message': 'skill output was not an object'},
        'traceId': trace_id,
        'durationMs': int((time.time() - started) * 1000),
    }


async def health(request):
    return JSONResponse({'status': 'ok', 'tools': 3, 'name': SERVER_NAME, 'toolNames': ['get_steering', 'get_dev_steering', 'call']})


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        token = os.environ.get('CONSUELO_OS_BEARER_TOKEN') or os.environ.get('MCP_BEARER_TOKEN', '')
        if request.url.path == '/health':
            return await call_next(request)
        if token:
            auth = request.headers.get('authorization', '')
            if auth != f'Bearer {token}':
                return JSONResponse({'error': 'unauthorized'}, status_code=401)
        return await call_next(request)


if __name__ == '__main__':
    mcp_app = mcp.streamable_http_app()
    app = Starlette(
        routes=[Route('/health', health), Mount('/', app=mcp_app)],
        middleware=[Middleware(AuthMiddleware)] if (os.environ.get('CONSUELO_OS_BEARER_TOKEN') or os.environ.get('MCP_BEARER_TOKEN')) else [],
    )
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=PORT)
