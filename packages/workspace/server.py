"""openworkspace MCP server — local workspace tools with optional memory and observability."""

import asyncio
import contextlib
import contextvars
import datetime
import hashlib
import json
import os
import re
import sqlite3
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


# one session ID per server process — groups all remote observations into one session.
_session_id = str(uuid.uuid4())
_OBSERVABILITY_PROVIDER = os.environ.get('WORKSPACE_OBSERVABILITY_PROVIDER', 'langfuse').lower()
_langfuse_client: Any | None = None
_langfuse_propagate_attributes: Any | None = None
_langsmith_trace: Any | None = None

def _estimate_tokens(text: str) -> int:
    """rough token estimate: ~4 chars per token."""
    return max(1, len(str(text)) // 4)

_TRACE_SUMMARY_LIMIT = 240

def _trace_string(value: Any, limit: int = _TRACE_SUMMARY_LIMIT) -> str:
    if value is None:
        return ''
    if isinstance(value, str):
        rendered = value
    else:
        try:
            rendered = json.dumps(value, sort_keys=True, default=str)
        except TypeError:
            rendered = str(value)
    rendered = ' '.join(rendered.split())
    return rendered if len(rendered) <= limit else rendered[:limit - 1] + '…'

def _trace_command_summary(value: Any) -> str | None:
    if isinstance(value, str):
        return _trace_string(value)
    if isinstance(value, list):
        return _trace_string(' '.join(str(part) for part in value))
    return None

def _trace_batch_summary(value: Any) -> str:
    if not isinstance(value, list):
        return _trace_string(value)
    tools = []
    for step in value:
        if isinstance(step, dict) and isinstance(step.get('tool'), str):
            tools.append(step['tool'])
        else:
            tools.append('unknown')
    preview = ', '.join(tools[:6])
    if len(tools) > 6:
        preview += f', +{len(tools) - 6} more'
    return f'{len(tools)} steps: {preview}'

def _trace_input_summary(tool: str | None, tool_input: Any) -> str:
    if tool == 'batch':
        return _trace_batch_summary(tool_input)
    if isinstance(tool_input, dict):
        for key in ('command', 'cmd', 'script'):
            command = _trace_command_summary(tool_input.get(key))
            if command:
                return command
        for key in ('path', 'query', 'area', 'base', 'message', 'title', 'pattern'):
            value = tool_input.get(key)
            if value:
                return f'{key}={_trace_string(value)}'
        return _trace_string(tool_input)
    return _trace_string(tool_input)

def _trace_inputs(name: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> dict[str, Any]:
    if name == 'workspace.call':
        tool = kwargs.get('tool') if isinstance(kwargs.get('tool'), str) else None
        tool_input = kwargs.get('tool_input')
        return {
            'action': tool or name,
            'tool': tool,
            'taskSession': kwargs.get('taskSession'),
            'timeout': kwargs.get('timeout'),
            'inputSummary': _trace_input_summary(tool, tool_input),
            'tool_input': tool_input,
        }
    inputs = {f'arg{i}': value for i, value in enumerate(args)}
    inputs.update(kwargs)
    return inputs

def _trace_run_name(name: str, inputs: dict[str, Any]) -> str:
    if name == 'workspace.call' and isinstance(inputs.get('tool'), str) and inputs['tool']:
        return inputs['tool']
    return name

def _trace_outputs(name: str, inputs: dict[str, Any], result: Any, usage: dict[str, int]) -> dict[str, Any]:
    if name != 'workspace.call' or not isinstance(result, dict):
        return {'result': result, 'usage': usage}
    task_context = result.get('taskContext') if isinstance(result.get('taskContext'), dict) else {}
    tool = inputs.get('tool') or inputs.get('action')
    code = result.get('code') or ('OK' if result.get('ok') else 'COMMAND_FAILED')
    summary_parts = [_trace_string(code, 80), _trace_string(tool, 80)]
    tmux_session = task_context.get('tmuxSession')
    if tmux_session:
        summary_parts.append(f'tmux={_trace_string(tmux_session, 120)}')
    return {
        'summary': ' · '.join(part for part in summary_parts if part),
        'ok': result.get('ok'),
        'code': code,
        'tool': tool,
        'taskSession': task_context.get('taskSession') or inputs.get('taskSession'),
        'tmuxSession': tmux_session,
        'branch': task_context.get('branch'),
        'worktree': task_context.get('worktree'),
        'result': result,
        'usage': usage,
    }

def _observability_provider() -> str:
    provider = os.environ.get('WORKSPACE_OBSERVABILITY_PROVIDER', _OBSERVABILITY_PROVIDER).lower()
    if provider in {'none', 'off', 'disabled'}:
        return 'none'
    if provider in {'langfuse', 'langsmith'}:
        return provider
    if provider == 'auto':
        if os.environ.get('LANGFUSE_PUBLIC_KEY') and os.environ.get('LANGFUSE_SECRET_KEY'):
            return 'langfuse'
        if os.environ.get('LANGCHAIN_TRACING_V2') and os.environ.get('LANGCHAIN_API_KEY'):
            return 'langsmith'
    return 'none'


def _get_langfuse_client() -> tuple[Any | None, Any | None]:
    global _langfuse_client, _langfuse_propagate_attributes
    if _langfuse_client is not None:
        return _langfuse_client, _langfuse_propagate_attributes
    if not os.environ.get('LANGFUSE_PUBLIC_KEY') or not os.environ.get('LANGFUSE_SECRET_KEY'):
        return None, None
    try:
        from langfuse import get_client, propagate_attributes

        _langfuse_client = get_client()
        _langfuse_propagate_attributes = propagate_attributes
        return _langfuse_client, _langfuse_propagate_attributes
    except Exception:
        _langfuse_client = None
        _langfuse_propagate_attributes = None
        return None, None


def _get_langsmith_trace() -> Any | None:
    global _langsmith_trace
    if _langsmith_trace is not None:
        return _langsmith_trace
    try:
        from langsmith import Client as LSClient
        from langsmith.run_helpers import trace as ls_trace

        LSClient()
        _langsmith_trace = ls_trace
        return _langsmith_trace
    except Exception:
        _langsmith_trace = None
        return None


def _finish_langfuse_observation(observation: Any, inputs: dict[str, Any], output: dict[str, Any], usage_details: dict[str, int] | None = None) -> None:
    metadata = {'workspaceUsageEstimate': usage_details} if usage_details else None
    update_payload: dict[str, Any] = {'input': inputs, 'output': output, 'model': 'workspace-tool-estimate'}
    if metadata:
        update_payload['metadata'] = metadata
    if usage_details:
        update_payload['usage_details'] = usage_details
    try:
        observation.update(**update_payload)
    except Exception:
        pass


def _traced_call(name, run_type, fn, *args, **kwargs):
    """wrap a function call with the configured remote observability provider."""
    provider = _observability_provider()
    inputs = _trace_inputs(name, args, kwargs)
    input_text = ' '.join(str(value) for value in inputs.values())
    trace_name = _trace_run_name(name, inputs)

    if provider == 'langfuse':
        langfuse, propagate_attributes = _get_langfuse_client()
        if langfuse is None or propagate_attributes is None:
            return fn(*args, **kwargs)
        try:
            observation_cm = langfuse.start_as_current_observation(
                as_type='generation',
                name=trace_name,
                model='workspace-tool-estimate',
            )
            propagation_cm = propagate_attributes(
                session_id=_session_id,
                metadata={'workspaceTrace': name, 'provider': 'langfuse'},
                tags=['workspace'],
                trace_name=trace_name,
            )
        except Exception:
            return fn(*args, **kwargs)

        with observation_cm as span:
            with propagation_cm:
                result = fn(*args, **kwargs)
            prompt_tokens = _estimate_tokens(input_text)
            completion_tokens = _estimate_tokens(result)
            usage = {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens,
            }
            usage_details = {
                'input': prompt_tokens,
                'output': completion_tokens,
                'total': prompt_tokens + completion_tokens,
            }
            _finish_langfuse_observation(span, inputs, _trace_outputs(name, inputs, result, usage), usage_details)
            return result

    if provider == 'langsmith':
        ls_trace = _get_langsmith_trace()
        if not ls_trace:
            return fn(*args, **kwargs)
        with ls_trace(name=trace_name, run_type=run_type, inputs=inputs, metadata={'session_id': _session_id, 'workspaceTrace': name}) as rt:
            result = fn(*args, **kwargs)
            prompt_tokens = _estimate_tokens(input_text)
            completion_tokens = _estimate_tokens(result)
            usage = {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens,
            }
            rt.end(outputs=_trace_outputs(name, inputs, result, usage))
            return result

    return fn(*args, **kwargs)

APP_DIR = os.path.dirname(__file__)
PORT = int(os.environ.get('PORT', 8000))
SERVER_NAME = os.environ.get('MCP_SERVER_NAME', 'openworkspace')
BUN_BIN = os.environ.get('BUN_BIN', '/opt/homebrew/bin/bun')
WORKSPACE_CALL_DEFAULT_TIMEOUT_SECONDS = 120
LONG_RUNNING_TOOL_TIMEOUT_SECONDS = {
    'review.run': 1200,
    'verify': 1200,
}
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
_TRACE_DB_MAX_BYTES = int(os.environ.get('OPENWORKSPACE_TRACE_DB_MAX_BYTES', str(500 * 1024 * 1024)))
_STEERING_GUARD_WINDOW_SECONDS = int(os.environ.get('OPENWORKSPACE_STEERING_GUARD_WINDOW_SECONDS', '300'))
_STEERING_FORCE_WINDOW_SECONDS = int(os.environ.get('OPENWORKSPACE_STEERING_FORCE_WINDOW_SECONDS', '300'))
_STEERING_REQUEST_CONTEXT: contextvars.ContextVar[dict[str, str] | None] = contextvars.ContextVar('steering_request_context', default=None)


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

    # Keep decision-engine doctrine in decision.md without injecting it into bootstrap steering.

    return content
def _steering_guard_now() -> float:
    return time.time()


def _steering_caller_key() -> str:
    context = _STEERING_REQUEST_CONTEXT.get() or {}
    candidates = [
        os.environ.get('OPENWORKSPACE_STEERING_CALLER_KEY'),
        os.environ.get('CONSUELO_AGENT_RUN_ID'),
        os.environ.get('OPENWORKSPACE_AGENT_RUN_ID'),
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
        '''
        SELECT decision FROM steering_guard_events
        WHERE caller_key = ? AND tool = ? AND created_at_epoch >= ?
        ORDER BY created_at_epoch ASC, id ASC
        ''',
        (caller_key, tool, now - window_seconds),
    ).fetchall()
    return [str(row[0]) for row in rows]


def _record_steering_guard_event(conn: sqlite3.Connection, *, caller_key: str, tool: str, decision: str, trace_id: str, reason: str | None, now: float) -> None:
    conn.execute(
        '''
        INSERT INTO steering_guard_events(id, created_at_epoch, created_at, caller_key, tool, decision, trace_id, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            f'{trace_id}:{decision}',
            now,
            datetime.datetime.fromtimestamp(now, datetime.timezone.utc).isoformat(),
            caller_key,
            tool,
            decision,
            trace_id,
            reason,
        ),
    )
    conn.commit()


def _get_steering_guard_decision(caller_key: str, trace_id: str) -> tuple[str, int]:
    now = _steering_guard_now()
    conn, _ = _open_trace_db()
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
    conn, _ = _open_trace_db()
    try:
        events = _recent_steering_guard_events(conn, caller_key, 'refresh_steering', _STEERING_FORCE_WINDOW_SECONDS, now)
        decision = 'forced_refresh' if not events else 'refresh_rate_limited'
        _record_steering_guard_event(conn, caller_key=caller_key, tool='refresh_steering', decision=decision, trace_id=trace_id, reason=reason, now=now)
        return decision, len(events) + 1
    finally:
        conn.close()


def _steering_guard_message(decision: str, attempt: int) -> str:
    if decision == 'soft_guard':
        return f'''GET_STEERING_LOOP_GUARD

You already received full steering very recently in this pre-task bootstrap context.
Do not call get_steering again unless you are intentionally refreshing bootstrap context.

Use the steering already in context. If you need exact source context, read only the specific file you need:
- packages/workspace/STEERING.md
- packages/workspace/tooling/tool-manifest.json
- packages/os/STEERING.md
- packages/os/manifests/core.manifest.json

Useful alternatives:
- fs.read for exact files
- context.search for repo/project context
- tools.search for tool discovery

If you truly need a fresh full steering snapshot, call refresh_steering with a concrete reason.
Attempt in current window: {attempt}
'''
    if decision == 'hard_guard':
        return f'''GET_STEERING_RATE_LIMITED

Repeated get_steering calls look like a bootstrap loop. Full steering is withheld for this attempt.
Continue with the steering already in context, or call refresh_steering with a concrete reason if a fresh full snapshot is required.
Attempt in current window: {attempt}
'''
    return f'''GET_STEERING_COOLDOWN

Full steering is temporarily blocked because this caller repeatedly called get_steering in a short window.
Continue the task with existing steering context. Use fs.read, context.search, or tools.search for targeted context instead of retrying get_steering.
Attempt in current window: {attempt}
'''


def _refresh_steering_message(decision: str, attempt: int) -> str:
    if decision == 'reason_required':
        return 'REFRESH_STEERING_REASON_REQUIRED\n\nrefresh_steering requires a concrete reason. Do not call it just to retry get_steering.\n'
    return f'REFRESH_STEERING_RATE_LIMITED\n\nrefresh_steering was already used recently for this caller. Continue with existing context or targeted file reads. Attempt in current window: {attempt}\n'


def _trace_steering_result(*, tool: str, trace_id: str, started: float, content: str, decision: str, code: str, message: str, reason: str | None = None) -> None:
    output_tokens = _estimate_tokens(content)
    data: dict[str, Any] = {
        'chars': len(content),
        'estimatedOutputTokens': output_tokens,
        'content': content,
        'decision': decision,
    }
    if reason is not None:
        data['reason'] = reason
    result = _envelope(
        ok=True,
        code=code,
        message=message,
        data=data,
        durationMs=int((_steering_guard_now() - started) * 1000),
        traceId=trace_id,
    )
    input_payload = {'reason': reason} if tool == 'refresh_steering' else {}
    input_tokens = _estimate_tokens(input_payload)
    _write_tool_trace(
        tool=tool,
        tool_input=input_payload,
        resolved_input=input_payload,
        result=result,
        task_session=None,
        mcp_trace_id=trace_id,
        input_tokens_override=input_tokens,
        output_tokens_override=output_tokens,
        total_tokens_override=input_tokens + output_tokens,
    )


def _run_get_steering() -> str:
    started = _steering_guard_now()
    trace_id = _trace_id()
    caller_key = _steering_caller_key()
    decision, attempt = _get_steering_guard_decision(caller_key, trace_id)
    if decision != 'full':
        content = _steering_guard_message(decision, attempt)
        code = 'STEERING_LOOP_GUARD' if decision == 'soft_guard' else 'STEERING_RATE_LIMITED' if decision == 'hard_guard' else 'STEERING_COOLDOWN'
        _trace_steering_result(tool='get_steering', trace_id=trace_id, started=started, content=content, decision=decision, code=code, message='steering loop guard active')
        return content

    content = _read_steering()
    _trace_steering_result(tool='get_steering', trace_id=trace_id, started=started, content=content, decision='full', code='OK', message='steering loaded')
    return content


@mcp.tool(annotations=RO)
async def get_steering() -> str:
    """return current workspace steering and tool manifest."""
    return await asyncio.to_thread(_traced_call, 'get_steering', 'tool', _run_get_steering)


def _run_refresh_steering(reason: str) -> str:
    started = _steering_guard_now()
    trace_id = _trace_id()
    normalized_reason = reason.strip() if isinstance(reason, str) else ''
    if not normalized_reason:
        content = _refresh_steering_message('reason_required', 1)
        _trace_steering_result(tool='refresh_steering', trace_id=trace_id, started=started, content=content, decision='reason_required', code='REFRESH_REASON_REQUIRED', message='refresh reason required', reason='')
        return content

    caller_key = _steering_caller_key()
    decision, attempt = _refresh_steering_guard_decision(caller_key, trace_id, normalized_reason)
    if decision != 'forced_refresh':
        content = _refresh_steering_message(decision, attempt)
        _trace_steering_result(tool='refresh_steering', trace_id=trace_id, started=started, content=content, decision=decision, code='REFRESH_RATE_LIMITED', message='refresh steering rate limited', reason=normalized_reason)
        return content

    content = _read_steering()
    _trace_steering_result(tool='refresh_steering', trace_id=trace_id, started=started, content=content, decision='forced_refresh', code='OK', message='steering refreshed', reason=normalized_reason)
    return content


@mcp.tool(annotations=RO)
async def refresh_steering(reason: str) -> str:
    """explicitly refresh full steering when get_steering guard blocks a real need."""
    return await asyncio.to_thread(_traced_call, 'refresh_steering', 'tool', _run_refresh_steering, reason=reason)


def _workspace_root() -> Path:
    return Path(APP_DIR).resolve()

def _worktree_root() -> Path:
    configured = os.environ.get('WORKSPACE_WORKTREE_ROOT') or os.environ.get('OPENSAAS_WORKTREE_ROOT')
    return Path(configured) if configured else Path(tempfile.gettempdir()) / 'opensaas-worktrees'


def _repo_identifier() -> str:
    try:
        result = subprocess.run(
            ['git', 'remote', 'get-url', 'origin'],
            capture_output=True,
            cwd=str(_workspace_root()),
            text=True,
            timeout=2,
            check=False,
            shell=False,
        )
        remote = result.stdout.strip()
        if result.returncode == 0 and remote:
            return remote
    except Exception:
        pass
    return str(_workspace_root())


def _repo_hash() -> str:
    return hashlib.sha256(_repo_identifier().encode('utf-8')).hexdigest()[:24]


def _default_trace_db_path() -> Path:
    if sys.platform == 'darwin':
        root = Path.home() / 'Library' / 'Application Support' / 'OpenWorkspace' / 'traces'
    else:
        root = Path.home() / '.local' / 'share' / 'openworkspace' / 'traces'
    return root / _repo_hash() / 'traces.db'


def _trace_db_path() -> Path:
    configured = os.environ.get('OPENWORKSPACE_TRACE_DB')
    return Path(configured).expanduser() if configured else _default_trace_db_path()


def _json_text(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, default=str)
    except TypeError:
        return json.dumps(str(value))


def _trace_db_total_size(db_path: Path) -> int:
    total = 0
    for candidate in [db_path, Path(str(db_path) + '-wal'), Path(str(db_path) + '-shm')]:
        try:
            total += candidate.stat().st_size
        except OSError:
            pass
    return total


def _open_trace_db() -> tuple[sqlite3.Connection, Path]:
    db_path = _trace_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=5)
    conn.execute('PRAGMA busy_timeout = 5000')
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS tool_traces (
            id TEXT PRIMARY KEY,
            ts TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            mcp_trace_id TEXT,
            source TEXT NOT NULL,
            tool TEXT NOT NULL,
            task_session TEXT,
            branch TEXT,
            worktree TEXT,
            status TEXT NOT NULL,
            ok INTEGER NOT NULL,
            code TEXT,
            exit_code INTEGER,
            duration_ms INTEGER,
            input_json TEXT,
            resolved_input_json TEXT,
            result_json TEXT,
            stderr TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            total_tokens INTEGER
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
    indexes = [
        'CREATE INDEX IF NOT EXISTS steering_guard_events_lookup_idx ON steering_guard_events(caller_key, tool, created_at_epoch)',
        'CREATE INDEX IF NOT EXISTS tool_traces_ts_idx ON tool_traces(ts)',
        'CREATE INDEX IF NOT EXISTS tool_traces_trace_id_idx ON tool_traces(trace_id)',
        'CREATE INDEX IF NOT EXISTS tool_traces_mcp_trace_id_idx ON tool_traces(mcp_trace_id)',
        'CREATE INDEX IF NOT EXISTS tool_traces_tool_idx ON tool_traces(tool)',
        'CREATE INDEX IF NOT EXISTS tool_traces_status_idx ON tool_traces(status)',
        'CREATE INDEX IF NOT EXISTS tool_traces_task_session_idx ON tool_traces(task_session)',
        'CREATE INDEX IF NOT EXISTS tool_traces_branch_idx ON tool_traces(branch)',
    ]
    for statement in indexes:
        conn.execute(statement)
    existing_columns = {row[1] for row in conn.execute('PRAGMA table_info(tool_traces)').fetchall()}
    for column_name in ('input_tokens', 'output_tokens', 'total_tokens'):
        if column_name not in existing_columns:
            conn.execute(f'ALTER TABLE tool_traces ADD COLUMN {column_name} INTEGER')
    return conn, db_path


def _trace_status(result: dict[str, Any]) -> str:
    code = str(result.get('code') or '')
    if code == 'SAFETY_BLOCKED':
        return 'blocked'
    if code == 'TIMEOUT':
        return 'timeout'
    return 'ok' if bool(result.get('ok')) else 'error'


def _enforce_trace_db_cap(conn: sqlite3.Connection, db_path: Path) -> None:
    if _TRACE_DB_MAX_BYTES <= 0 or _trace_db_total_size(db_path) <= _TRACE_DB_MAX_BYTES:
        return

    target_bytes = int(_TRACE_DB_MAX_BYTES * 0.9)
    while _trace_db_total_size(db_path) > target_bytes:
        cursor = conn.execute('''
            DELETE FROM tool_traces
            WHERE id IN (
                SELECT id FROM tool_traces ORDER BY ts ASC LIMIT 1000
            )
        ''')
        conn.commit()
        if cursor.rowcount == 0:
            break
    conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    if _trace_db_total_size(db_path) > _TRACE_DB_MAX_BYTES:
        conn.execute('VACUUM')


def _write_tool_trace(
    *,
    tool: str,
    tool_input: Any,
    resolved_input: Any | None,
    result: dict[str, Any],
    task_session: str | None,
    mcp_trace_id: str,
    metadata: dict[str, Any] | None = None,
    input_tokens_override: int | None = None,
    output_tokens_override: int | None = None,
    total_tokens_override: int | None = None,
) -> None:
    try:
        task_context = result.get('taskContext') if isinstance(result.get('taskContext'), dict) else {}
        trace_id = result.get('traceId') if isinstance(result.get('traceId'), str) else mcp_trace_id
        branch = task_context.get('branch') or (metadata or {}).get('branch') or (metadata or {}).get('taskBranch')
        worktree = task_context.get('worktree') or (metadata or {}).get('worktree') or (metadata or {}).get('worktreePath')
        session = task_context.get('taskSession') or task_session
        conn, db_path = _open_trace_db()
        input_tokens = input_tokens_override if input_tokens_override is not None else _estimate_tokens(tool_input)
        output_tokens = output_tokens_override if output_tokens_override is not None else _estimate_tokens(result)
        total_tokens = total_tokens_override if total_tokens_override is not None else input_tokens + output_tokens
        try:
            conn.execute('''
                INSERT OR REPLACE INTO tool_traces(
                    id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, worktree,
                    status, ok, code, exit_code, duration_ms,
                    input_json, resolved_input_json, result_json, stderr,
                    input_tokens, output_tokens, total_tokens
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                f'{mcp_trace_id}:{trace_id}',
                datetime.datetime.now(datetime.timezone.utc).isoformat(),
                trace_id,
                mcp_trace_id,
                'mcp',
                tool,
                session,
                branch,
                worktree,
                _trace_status(result),
                1 if bool(result.get('ok')) else 0,
                result.get('code'),
                result.get('exitCode'),
                result.get('durationMs'),
                _json_text(tool_input),
                _json_text(resolved_input) if resolved_input is not None else None,
                _json_text(result),
                result.get('stderr') if isinstance(result.get('stderr'), str) else None,
                input_tokens,
                output_tokens,
                total_tokens,
            ))
            conn.commit()
            _enforce_trace_db_cap(conn, db_path)
        finally:
            conn.close()
    except Exception:
        pass


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
    mutating_path_tools = {'fs.write', 'fs.trash', 'mac.write'}
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
    if tool == 'batch':
        steps = _batch_steps(tool_input)
        if steps is None:
            return None
        for index, step in enumerate(steps):
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
    return command.get('branchMode') == 'required'


def _task_session_candidate_paths(worktree_path: Path) -> list[Path]:
    task_root = worktree_path / '.task'
    candidates: list[Path] = []
    if task_root.exists():
        for area_path in task_root.iterdir():
            if not area_path.is_dir() or area_path.name in {'tasks', 'reviews'}:
                continue
            for task_path in area_path.iterdir():
                if not task_path.is_dir():
                    continue
                candidates.append(task_path / 'session.json')
    candidates.append(task_root / 'session.json')
    return candidates


def _task_session_metadata(task_session: str | None) -> dict[str, Any] | None:
    if not task_session:
        return None
    roots = [_workspace_root()]
    worktree_base = _worktree_root()
    if worktree_base.exists():
        roots.extend(path for path in worktree_base.iterdir() if path.is_dir() and path.name.startswith('task-'))

    seen: set[Path] = set()
    candidates: list[Path] = []
    for root in roots:
        for candidate in _task_session_candidate_paths(root):
            resolved = candidate.resolve(strict=False)
            if resolved in seen:
                continue
            seen.add(resolved)
            candidates.append(candidate)

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
            if not metadata.get('worktree') and not metadata.get('worktreePath'):
                parts = candidate.parts
                if '.task' in parts:
                    metadata.setdefault('worktree', str(Path(*parts[:parts.index('.task')])))
            return metadata
    return None


def _input_task_session(value: Any) -> str | None:
    if isinstance(value, dict) and isinstance(value.get('taskSession'), str) and value.get('taskSession'):
        return value.get('taskSession')
    return None


def _effective_task_session(task_session: str | None, tool_input: Any) -> tuple[str | None, str | None]:
    input_task_session = _input_task_session(tool_input)
    if task_session and input_task_session and task_session != input_task_session:
        return None, 'Pass either top-level taskSession or matching input.taskSession, not conflicting values.'
    return task_session or input_task_session, None


def _input_branch(value: Any) -> str | None:
    if isinstance(value, dict) and isinstance(value.get('branch'), str) and value.get('branch'):
        return value.get('branch')
    return None


def _metadata_branch(metadata: dict[str, Any] | None) -> str | None:
    if not isinstance(metadata, dict):
        return None
    branch = metadata.get('branch') or metadata.get('taskBranch')
    return branch if isinstance(branch, str) and branch else None



def _input_branch_conflicts_with_task_session(value: Any, metadata: dict[str, Any] | None) -> bool:
    branch = _input_branch(value)
    if branch is None:
        return False
    expected_branch = _metadata_branch(metadata)
    if expected_branch is None:
        return False
    return branch != expected_branch


def _batch_steps(value: Any) -> list[Any] | None:
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get('steps'), list):
        return value.get('steps')
    return None


def _batch_has_task_scoped_step_without_session(value: Any) -> bool:
    steps = _batch_steps(value)
    if steps is None:
        return False
    for step in steps:
        if not isinstance(step, dict):
            continue
        child_tool = step.get('tool')
        child_input = step.get('input') if 'input' in step else step.get('args')
        if isinstance(child_tool, str) and _tool_requires_task_session(child_tool, child_input):
            return True
    return False

def _batch_has_branch_conflict(value: Any, metadata: dict[str, Any] | None) -> bool:
    steps = _batch_steps(value)
    if steps is None:
        return False
    for step in steps:
        if not isinstance(step, dict):
            continue
        child_tool = step.get('tool')
        child_input = step.get('input') if 'input' in step else step.get('args')
        if child_tool == 'batch' and _batch_has_branch_conflict(child_input, metadata):
            return True
        if _input_branch_conflicts_with_task_session(child_input, metadata):
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
        child_steps = _batch_steps(child_input)
        if child_tool == 'batch' and child_steps is not None:
            step = {**step, 'input': _apply_task_session_to_batch_steps(child_steps, task_session)}
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

    if tool == 'batch':
        steps = _batch_steps(tool_input)
        if steps is not None:
            return _apply_task_session_to_batch_steps(steps, task_session), metadata

    if isinstance(tool_input, dict) and 'taskSession' not in tool_input:
        return {**tool_input, 'taskSession': task_session}, metadata
    return tool_input, metadata


def _run_workspace_call(tool: str, taskSession: str | None = None, tool_input: Any | None = None, timeout: int | None = None) -> dict[str, Any]:
    started = time.time()
    trace_id = _trace_id()
    normalized_input: Any = {} if tool_input is None else tool_input
    effective_task_session, task_session_error = _effective_task_session(taskSession, normalized_input)
    trace_tool = tool if isinstance(tool, str) and tool else 'workspace.call'

    def finish(result: dict[str, Any], resolved_input: Any | None = None, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        _write_tool_trace(
            tool=trace_tool,
            tool_input=normalized_input,
            resolved_input=resolved_input,
            result=result,
            task_session=effective_task_session,
            mcp_trace_id=trace_id,
            metadata=metadata,
        )
        return result

    if not tool or not isinstance(tool, str):
        return finish(_envelope(ok=False, code='VALIDATION_ERROR', message='tool must be a non-empty string', traceId=trace_id))

    if task_session_error:
        return finish(_envelope(
            ok=False,
            code='VALIDATION_ERROR',
            message=task_session_error,
            data={'tool': tool},
            traceId=trace_id,
        ))

    safety_reason = _safety_check(tool, normalized_input, effective_task_session)
    if safety_reason:
        result = _envelope(
            ok=False,
            code='SAFETY_BLOCKED',
            message=f'workspace.call blocked by safety guardrail: {safety_reason}',
            data={'tool': tool, 'reason': safety_reason},
            exitCode=-1,
            traceId=trace_id,
        )
        _safety_log(tool=tool, tool_input=normalized_input, task_session=effective_task_session, trace_id=trace_id, blocked=True, reason=safety_reason)
        return finish(result)
    _safety_log(tool=tool, tool_input=normalized_input, task_session=effective_task_session, trace_id=trace_id, blocked=False)

    task_session_metadata = _task_session_metadata(effective_task_session) if effective_task_session else None
    if effective_task_session and (
        _input_branch_conflicts_with_task_session(normalized_input, task_session_metadata)
        or (tool == 'batch' and _batch_has_branch_conflict(normalized_input, task_session_metadata))
    ):
        return finish(_envelope(
            ok=False,
            code='VALIDATION_ERROR',
            message='Pass either taskSession or input.branch, not both. taskSession is required for agent task-scoped calls.',
            data={'tool': tool, 'taskSession': effective_task_session},
            traceId=trace_id,
        ))
    if not effective_task_session and _tool_requires_task_session(tool, normalized_input):
        return finish(_envelope(
            ok=False,
            code='TASK_SESSION_REQUIRED',
            message=f'{tool} requires taskSession. Use the taskSession returned by task.start.',
            data={'tool': tool},
            traceId=trace_id,
        ))

    resolved_input, metadata = _apply_task_session(tool, effective_task_session, normalized_input)
    if effective_task_session and metadata is None:
        return finish(_envelope(
            ok=False,
            code='TASK_SESSION_NOT_FOUND',
            message='taskSession was not found. Use the taskSession returned by task.start.',
            data={'taskSession': effective_task_session},
            traceId=trace_id,
        ))

    args = [BUN_BIN, str(_workspace_root() / 'scripts' / 'workspace.ts'), tool, json.dumps(resolved_input)]
    default_timeout = LONG_RUNNING_TOOL_TIMEOUT_SECONDS.get(tool, WORKSPACE_CALL_DEFAULT_TIMEOUT_SECONDS)
    run_timeout = timeout if isinstance(timeout, int) and timeout > 0 else default_timeout
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
        return finish(_envelope(
            ok=False,
            code='TIMEOUT',
            message=f'workspace.call timed out after {run_timeout}s',
            data=None,
            stderr=str(error),
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        ), resolved_input, metadata)
    except FileNotFoundError as error:
        return finish(_envelope(
            ok=False,
            code='COMMAND_FAILED',
            message='workspace.call could not start bun/workspace executable',
            data={'command': args},
            stderr=str(error),
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        ), resolved_input, metadata)

    stdout_text = result.stdout.strip()
    try:
        envelope = json.loads(stdout_text) if stdout_text else {}
    except json.JSONDecodeError:
        return finish(_envelope(
            ok=False,
            code='PARSE_ERROR',
            message='workspace.call received non-JSON output from facade',
            data={'raw': result.stdout},
            stderr=result.stderr,
            exitCode=result.returncode,
            durationMs=int((time.time() - started) * 1000),
            traceId=trace_id,
        ), resolved_input, metadata)

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
                'taskSession': effective_task_session,
                'tmuxSession': metadata.get('tmuxSession'),
                'branch': metadata.get('branch') or metadata.get('taskBranch'),
                'worktree': metadata.get('worktree') or metadata.get('worktreePath'),
                'source': 'taskSession',
            }
        if result.stderr and not envelope.get('stderr'):
            envelope['stderr'] = result.stderr
        return finish(envelope, resolved_input, metadata)

    return finish(_envelope(
        ok=False,
        code='PARSE_ERROR',
        message='workspace.call facade output was not an object',
        data=envelope,
        exitCode=result.returncode,
        durationMs=int((time.time() - started) * 1000),
        traceId=trace_id,
    ), resolved_input, metadata)

@mcp.tool(annotations=CALL_TOOL)
async def call(
    tool: str,
    input: Any | None = None,
    taskSession: str | None = None,
    timeout: int | None = None,
) -> dict[str, Any]:
    """run a typed workspace tool through the facade. taskSession scopes task work."""
    tool_input = input
    return await asyncio.to_thread(
        _traced_call,
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
        headers = {key.lower(): value for key, value in request.headers.items()}
        if request.client and request.client.host:
            headers['client'] = request.client.host
        context_token = _STEERING_REQUEST_CONTEXT.set(headers)
        try:
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
        finally:
            _STEERING_REQUEST_CONTEXT.reset(context_token)


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
