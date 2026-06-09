"""Legacy Consuelo OS Python transport wrapper.

The product runtime path is Bun/TypeScript. This file remains temporarily as a
compatibility wrapper until the Bun server fully replaces Python transport needs.
"""

import contextvars
import hashlib
import json
import os
import sqlite3
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
_STEERING_GUARD_WINDOW_SECONDS = int(os.environ.get('CONSUELO_OS_STEERING_GUARD_WINDOW_SECONDS', '300'))
_STEERING_FORCE_WINDOW_SECONDS = int(os.environ.get('CONSUELO_OS_STEERING_FORCE_WINDOW_SECONDS', '300'))
_STEERING_REQUEST_CONTEXT = contextvars.ContextVar('os_steering_request_context', default={})

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


def _build_steering() -> str:
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


def _consuelo_home() -> Path:
    return Path(os.path.expanduser(os.environ.get('CONSUELO_HOME', '~/.consuelo/os'))).resolve()


def _open_runtime_db() -> sqlite3.Connection:
    home = _consuelo_home()
    home.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(home / 'consuelo.db')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS skill_executions (
            trace_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            workspace_id TEXT,
            user_id TEXT,
            status TEXT NOT NULL,
            input_json TEXT,
            output_json TEXT,
            error_code TEXT,
            error_message TEXT,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            duration_ms INTEGER
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS execution_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trace_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload_json TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS steering_guard_events (
            id TEXT PRIMARY KEY,
            created_at_epoch REAL NOT NULL,
            created_at TEXT NOT NULL,
            caller_key TEXT NOT NULL,
            tool TEXT NOT NULL,
            decision TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            reason TEXT
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS steering_guard_events_lookup_idx ON steering_guard_events(caller_key, tool, created_at_epoch)')
    return conn


def _steering_guard_now() -> float:
    return time.time()


def _steering_caller_key() -> str:
    context = _STEERING_REQUEST_CONTEXT.get({}) or {}
    candidates = [
        os.environ.get('CONSUELO_OS_STEERING_CALLER_KEY'),
        os.environ.get('CONSUELO_AGENT_RUN_ID'),
        os.environ.get('MCP_SESSION_ID'),
        os.environ.get('CLAUDE_CODE_SESSION_ID'),
        context.get('x-consuelo-agent-run-id'),
        context.get('x-agent-run-id'),
        context.get('mcp-session-id'),
        context.get('x-request-id'),
        context.get('authorization'),
        context.get('user-agent'),
        context.get('client'),
    ]
    raw = '|'.join(value for value in candidates if value)
    if not raw:
        raw = f'process:{os.getpid()}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:32]


def _recent_steering_guard_events(conn: sqlite3.Connection, caller_key: str, tool: str, window_seconds: int, now: float) -> list[str]:
    rows = conn.execute(
        'SELECT decision FROM steering_guard_events WHERE caller_key = ? AND tool = ? AND created_at_epoch >= ? ORDER BY created_at_epoch ASC, id ASC',
        (caller_key, tool, now - window_seconds),
    ).fetchall()
    return [str(row[0]) for row in rows]


def _record_steering_guard_event(conn: sqlite3.Connection, *, caller_key: str, tool: str, decision: str, trace_id: str, reason: str | None, now: float) -> None:
    conn.execute(
        'INSERT INTO steering_guard_events(id, created_at_epoch, created_at, caller_key, tool, decision, trace_id, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (f'{trace_id}:{decision}', now, _now_iso(), caller_key, tool, decision, trace_id, reason),
    )
    conn.commit()


def _get_steering_guard_decision(caller_key: str, trace_id: str) -> tuple[str, int]:
    now = _steering_guard_now()
    conn = _open_runtime_db()
    try:
        events = _recent_steering_guard_events(conn, caller_key, 'get_steering', _STEERING_GUARD_WINDOW_SECONDS, now)
        if not events:
            decision = 'full'
        elif len(events) == 1:
            decision = 'soft_guard'
        elif len(events) == 2:
            decision = 'hard_guard'
        else:
            decision = 'cooldown'
        _record_steering_guard_event(conn, caller_key=caller_key, tool='get_steering', decision=decision, trace_id=trace_id, reason=None, now=now)
        return decision, len(events) + 1
    finally:
        conn.close()


def _refresh_steering_guard_decision(caller_key: str, trace_id: str, reason: str) -> tuple[str, int]:
    now = _steering_guard_now()
    conn = _open_runtime_db()
    try:
        events = _recent_steering_guard_events(conn, caller_key, 'refresh_steering', _STEERING_FORCE_WINDOW_SECONDS, now)
        decision = 'forced_refresh' if not events else 'refresh_rate_limited'
        _record_steering_guard_event(conn, caller_key=caller_key, tool='refresh_steering', decision=decision, trace_id=trace_id, reason=reason, now=now)
        return decision, len(events) + 1
    finally:
        conn.close()


def _steering_guard_message(decision: str, attempt: int) -> str:
    if decision == 'soft_guard':
        return (
            'GET_STEERING_LOOP_GUARD\n\n'
            'You already received full OS steering very recently in this pre-task bootstrap context.\n'
            'Do not call get_steering again unless you are intentionally refreshing bootstrap context.\n\n'
            'Read only the specific file you need:\n'
            '- packages/os/STEERING.md\n'
            '- packages/os/manifests/core.manifest.json\n'
            '- packages/workspace/STEERING.md\n\n'
            'Useful alternatives:\n'
            '- fs.read for exact files\n'
            '- context.search for repo/project context\n'
            '- tools.search for tool discovery\n\n'
            'If you truly need a fresh full steering snapshot, call refresh_steering with a concrete reason.\n'
            f'Attempt in current window: {attempt}\n'
        )
    if decision == 'hard_guard':
        return f'GET_STEERING_RATE_LIMITED\n\nRepeated get_steering calls look like a bootstrap loop. Continue with existing steering context or call refresh_steering with a concrete reason. Attempt in current window: {attempt}\n'
    return f'GET_STEERING_COOLDOWN\n\nFull steering is temporarily blocked because this caller repeatedly called get_steering in a short window. Use targeted file reads or search instead. Attempt in current window: {attempt}\n'


def _refresh_steering_message(decision: str, attempt: int) -> str:
    if decision == 'reason_required':
        return 'REFRESH_STEERING_REASON_REQUIRED\n\nrefresh_steering requires a concrete reason. Do not call it just to retry get_steering.\n'
    return f'REFRESH_STEERING_RATE_LIMITED\n\nrefresh_steering was already used recently for this caller. Attempt in current window: {attempt}\n'


def _record_steering_execution(trace_id: str, started: float, name: str, steering: str, decision: str, code: str = 'OK', reason: str | None = None) -> None:
    duration_ms = int((_steering_guard_now() - started) * 1000)
    now = _now_iso()
    result = {
        'chars': len(steering),
        'estimatedOutputTokens': max(1, len(steering) // 4),
        'content': steering,
        'decision': decision,
    }
    if reason is not None:
        result['reason'] = reason
    output = {
        'ok': True,
        'name': name,
        'permission': 'read',
        'traceId': trace_id,
        'durationMs': duration_ms,
        'result': result,
        'code': code,
    }
    input_json = {'reason': reason} if name == 'refresh_steering' else {}
    conn = _open_runtime_db()
    try:
        conn.execute(
            'INSERT OR REPLACE INTO skill_executions (trace_id, name, workspace_id, user_id, status, input_json, output_json, started_at, finished_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (trace_id, name, os.environ.get('CONSUELO_WORKSPACE_ID'), os.environ.get('CONSUELO_USER_ID'), 'succeeded', _safe_json(input_json), _safe_json(output), now, now, duration_ms),
        )
        conn.execute(
            'INSERT INTO execution_events (trace_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)',
            (trace_id, 'execution.succeeded', _safe_json({'durationMs': duration_ms, 'decision': decision, 'code': code}), now),
        )
        conn.commit()
    finally:
        conn.close()


@mcp.tool(annotations=READ_ONLY)
def get_steering() -> str:
    """Return OS steering, business context, permissions, and raw core tool manifest."""
    started = _steering_guard_now()
    trace_id = _trace_id()
    caller_key = _steering_caller_key()
    decision, attempt = _get_steering_guard_decision(caller_key, trace_id)
    if decision != 'full':
        steering = _steering_guard_message(decision, attempt)
        code = 'STEERING_LOOP_GUARD' if decision == 'soft_guard' else 'STEERING_RATE_LIMITED' if decision == 'hard_guard' else 'STEERING_COOLDOWN'
        _record_steering_execution(trace_id, started, 'get_steering', steering, decision, code)
        return steering
    steering = _build_steering()
    _record_steering_execution(trace_id, started, 'get_steering', steering, 'full')
    return steering


@mcp.tool(annotations=READ_ONLY)
def refresh_steering(reason: str) -> str:
    """Explicitly refresh full OS steering when get_steering guard blocks a real need."""
    started = _steering_guard_now()
    trace_id = _trace_id()
    normalized_reason = reason.strip() if isinstance(reason, str) else ''
    if not normalized_reason:
        steering = _refresh_steering_message('reason_required', 1)
        _record_steering_execution(trace_id, started, 'refresh_steering', steering, 'reason_required', 'REFRESH_REASON_REQUIRED', '')
        return steering
    caller_key = _steering_caller_key()
    decision, attempt = _refresh_steering_guard_decision(caller_key, trace_id, normalized_reason)
    if decision != 'forced_refresh':
        steering = _refresh_steering_message(decision, attempt)
        _record_steering_execution(trace_id, started, 'refresh_steering', steering, decision, 'REFRESH_RATE_LIMITED', normalized_reason)
        return steering
    steering = _build_steering()
    _record_steering_execution(trace_id, started, 'refresh_steering', steering, 'forced_refresh', 'OK', normalized_reason)
    return steering


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
    return JSONResponse({'status': 'ok', 'tools': 3, 'name': SERVER_NAME, 'toolNames': ['get_steering', 'refresh_steering', 'call']})


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        headers = {key.lower(): value for key, value in request.headers.items()}
        if request.client and request.client.host:
            headers['client'] = request.client.host
        context_token = _STEERING_REQUEST_CONTEXT.set(headers)
        try:
            token = os.environ.get('CONSUELO_OS_BEARER_TOKEN') or os.environ.get('MCP_BEARER_TOKEN', '')
            if request.url.path == '/health':
                return await call_next(request)
            if token:
                auth = request.headers.get('authorization', '')
                if auth != f'Bearer {token}':
                    return JSONResponse({'error': 'unauthorized'}, status_code=401)
            return await call_next(request)
        finally:
            _STEERING_REQUEST_CONTEXT.reset(context_token)


if __name__ == '__main__':
    mcp_app = mcp.streamable_http_app()
    app = Starlette(
        routes=[Route('/health', health), Mount('/', app=mcp_app)],
        middleware=[Middleware(AuthMiddleware)] if (os.environ.get('CONSUELO_OS_BEARER_TOKEN') or os.environ.get('MCP_BEARER_TOKEN')) else [],
    )
    import uvicorn

    uvicorn.run(app, host='0.0.0.0', port=PORT)
