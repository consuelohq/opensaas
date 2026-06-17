import asyncio
import importlib.util
import json
import os
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch
from pathlib import Path


class FakeFastMCP:
    def __init__(self, *args, **kwargs):
        self.session_manager = types.SimpleNamespace(run=lambda: None)

    def tool(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def streamable_http_app(self):
        return None


def install_server_stubs():
    sys.modules['langsmith'] = types.SimpleNamespace(Client=lambda *args, **kwargs: None)
    sys.modules['langsmith.run_helpers'] = types.SimpleNamespace(trace=None)
    sys.modules['uvicorn'] = types.SimpleNamespace(run=lambda *args, **kwargs: None)
    sys.modules['mcp'] = types.ModuleType('mcp')
    sys.modules['mcp.server'] = types.ModuleType('mcp.server')
    sys.modules['mcp.server.fastmcp'] = types.SimpleNamespace(FastMCP=FakeFastMCP)
    sys.modules['starlette'] = types.ModuleType('starlette')
    sys.modules['starlette.applications'] = types.SimpleNamespace(Starlette=lambda *args, **kwargs: None)
    sys.modules['starlette.middleware'] = types.SimpleNamespace(Middleware=lambda *args, **kwargs: None)
    sys.modules['starlette.middleware.base'] = types.SimpleNamespace(BaseHTTPMiddleware=object)
    sys.modules['starlette.responses'] = types.SimpleNamespace(JSONResponse=dict, Response=lambda *args, **kwargs: None)
    sys.modules['starlette.routing'] = types.SimpleNamespace(Mount=lambda *args, **kwargs: None, Route=lambda *args, **kwargs: None)


def load_server_module():
    install_server_stubs()
    spec = importlib.util.spec_from_file_location('workspace_server_for_test', 'packages/workspace/server.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class Completed:
    def __init__(self, stdout, stderr='', returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


class WorkspaceCallServerTest(unittest.TestCase):
    def setUp(self):
        self.module = load_server_module()
        self.tempdir = tempfile.TemporaryDirectory()
        self.module._SAFETY_AUDIT_FILE = str(Path(self.tempdir.name) / 'audit.jsonl')
        self.module._TRACE_DB_MAX_BYTES = 500 * 1024 * 1024
        os.environ['OPENWORKSPACE_TRACE_DB'] = str(Path(self.tempdir.name) / 'traces.db')
        os.environ.pop('WORKSPACE_OBSERVABILITY_PROVIDER', None)
        os.environ.pop('LANGFUSE_PUBLIC_KEY', None)
        os.environ.pop('LANGFUSE_SECRET_KEY', None)
        self.worktree_root = Path(self.tempdir.name) / 'worktrees'
        self.worktree = self.worktree_root / 'task-workspace-agents-test'
        (self.worktree / '.task').mkdir(parents=True)
        self.session = 'tsk_test'
        os.environ['WORKSPACE_WORKTREE_ROOT'] = str(self.worktree_root)
        self._write_legacy_session()

    def _session_payload(self, session=None, branch='task/workspace-agents/test', worktree=None):
        return {
            'taskSession': session or self.session,
            'tmuxSession': 'opensaas-test',
            'branch': branch,
            'taskBranch': branch,
            'worktree': str(worktree or self.worktree),
            'worktreePath': str(worktree or self.worktree),
        }

    def _write_legacy_session(self, session=None):
        (self.worktree / '.task' / 'session.json').write_text(json.dumps(
            self._session_payload(session=session),
        ), encoding='utf-8')

    def _write_scoped_session(self, session=None, branch='task/workspace-agents/test'):
        scoped = self.worktree / '.task' / 'workspace-agents' / 'test'
        scoped.mkdir(parents=True, exist_ok=True)
        (scoped / 'session.json').write_text(json.dumps(
            self._session_payload(session=session, branch=branch),
        ), encoding='utf-8')

    def _remove_legacy_session(self):
        legacy = self.worktree / '.task' / 'session.json'
        if legacy.exists():
            legacy.unlink()

    def tearDown(self):
        self.tempdir.cleanup()
        os.environ.pop('WORKSPACE_WORKTREE_ROOT', None)
        os.environ.pop('OPENWORKSPACE_TRACE_DB', None)
        os.environ.pop('WORKSPACE_OBSERVABILITY_PROVIDER', None)
        os.environ.pop('LANGFUSE_PUBLIC_KEY', None)
        os.environ.pop('LANGFUSE_SECRET_KEY', None)

    def assert_standard_envelope(self, result):
        for key in ['now', 'ok', 'code', 'message', 'data', 'stderr', 'exitCode', 'durationMs', 'traceId', 'apiVersion']:
            self.assertIn(key, result)

    def test_traced_call_uses_langfuse_when_configured(self):
        observations = []
        propagated = []

        class FakeObservation:
            def __init__(self, **kwargs):
                self.kwargs = kwargs
                self.updates = []

            def __enter__(self):
                observations.append(self)
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def update(self, **kwargs):
                self.updates.append(kwargs)

        class FakeClient:
            def start_as_current_observation(self, **kwargs):
                return FakeObservation(**kwargs)

        class FakePropagate:
            def __init__(self, **kwargs):
                self.kwargs = kwargs

            def __enter__(self):
                propagated.append(self.kwargs)
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        sys.modules['langfuse'] = types.SimpleNamespace(
            get_client=lambda: FakeClient(),
            propagate_attributes=lambda **kwargs: FakePropagate(**kwargs),
        )
        os.environ['WORKSPACE_OBSERVABILITY_PROVIDER'] = 'langfuse'
        os.environ['LANGFUSE_PUBLIC_KEY'] = 'pk-lf-test'
        os.environ['LANGFUSE_SECRET_KEY'] = 'sk-lf-test'
        self.module._langfuse_client = None
        self.module._langfuse_propagate_attributes = None

        result = self.module._traced_call('workspace.call', 'tool', lambda **kwargs: {'ok': True, 'code': 'OK'}, tool='status', tool_input={}, taskSession=None, timeout=7)

        self.assertEqual(result, {'ok': True, 'code': 'OK'})
        self.assertEqual(observations[0].kwargs['as_type'], 'generation')
        self.assertEqual(observations[0].kwargs['model'], 'workspace-tool-estimate')
        self.assertEqual(observations[0].kwargs['name'], 'status')
        self.assertEqual(observations[0].updates[0]['input']['tool'], 'status')
        self.assertEqual(propagated[0]['session_id'], self.module._session_id)
        self.assertEqual(propagated[0]['trace_name'], 'status')
        self.assertEqual(observations[0].updates[0]['output']['code'], 'OK')
        self.assertEqual(observations[0].updates[0]['model'], 'workspace-tool-estimate')
        self.assertIn('usage_details', observations[0].updates[0])
        self.assertIn('workspaceUsageEstimate', observations[0].updates[0]['metadata'])

    def test_langfuse_tracing_does_not_retry_failing_call(self):
        calls = []

        class FakeObservation:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def update(self, **kwargs):
                pass

        class FakeClient:
            def start_as_current_observation(self, **kwargs):
                return FakeObservation()

        class FakePropagate:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        sys.modules['langfuse'] = types.SimpleNamespace(
            get_client=lambda: FakeClient(),
            propagate_attributes=lambda **kwargs: FakePropagate(),
        )
        os.environ['WORKSPACE_OBSERVABILITY_PROVIDER'] = 'langfuse'
        os.environ['LANGFUSE_PUBLIC_KEY'] = 'pk-lf-test'
        os.environ['LANGFUSE_SECRET_KEY'] = 'sk-lf-test'
        self.module._langfuse_client = None
        self.module._langfuse_propagate_attributes = None

        def failing_call(**kwargs):
            calls.append(kwargs)
            raise RuntimeError('boom')

        with self.assertRaises(RuntimeError):
            self.module._traced_call('workspace.call', 'tool', failing_call, tool='status', tool_input={}, taskSession=None, timeout=7)
        self.assertEqual(len(calls), 1)

    def test_get_steering_guards_repeat_bootstrap_calls_without_task_session(self):
        now = [1000.0]
        calls = []
        steering_text = 'full steering payload'

        def fake_read_steering():
            calls.append(len(calls) + 1)
            return steering_text

        self.module._steering_guard_now = lambda: now[0]
        self.module._read_steering = fake_read_steering

        first = asyncio.run(self.module.get_steering())
        second = asyncio.run(self.module.get_steering())
        third = asyncio.run(self.module.get_steering())
        fourth = asyncio.run(self.module.get_steering())

        self.assertEqual(first, steering_text)
        self.assertIn('GET_STEERING_LOOP_GUARD', second)
        self.assertIn('packages/workspace/STEERING.md', second)
        self.assertIn('fs.read', second)
        self.assertIn('GET_STEERING_RATE_LIMITED', third)
        self.assertIn('GET_STEERING_COOLDOWN', fourth)
        self.assertEqual(calls, [1])

        conn = self.module.sqlite3.connect(os.environ['OPENWORKSPACE_TRACE_DB'])
        try:
            rows = conn.execute('SELECT code, result_json FROM tool_traces WHERE tool = ? ORDER BY ts', ('get_steering',)).fetchall()
        finally:
            conn.close()

        self.assertEqual([row[0] for row in rows], ['OK', 'STEERING_LOOP_GUARD', 'STEERING_RATE_LIMITED', 'STEERING_COOLDOWN'])
        decisions = [json.loads(row[1])['data']['decision'] for row in rows]
        self.assertEqual(decisions, ['full', 'soft_guard', 'hard_guard', 'cooldown'])
        self.assertEqual(json.loads(rows[0][1])['data']['content'], steering_text)


    def test_get_steering_writes_compact_local_trace_row(self):
        steering_text = 'full steering payload ' * 40

        def fake_read_steering():
            return steering_text

        self.module._read_steering = fake_read_steering
        result = asyncio.run(self.module.get_steering())
        self.assertEqual(result, steering_text)

        conn = self.module.sqlite3.connect(os.environ['OPENWORKSPACE_TRACE_DB'])
        try:
            row = conn.execute('SELECT tool, status, ok, code, input_json, result_json, input_tokens, output_tokens, total_tokens FROM tool_traces').fetchone()
        finally:
            conn.close()

        self.assertIsNotNone(row)
        self.assertEqual(row[0], 'get_steering')
        self.assertEqual(row[1], 'ok')
        self.assertEqual(row[2], 1)
        self.assertEqual(row[3], 'OK')
        self.assertEqual(json.loads(row[4]), {})
        compact_result = json.loads(row[5])
        self.assertEqual(compact_result['data']['chars'], len(steering_text))
        self.assertEqual(compact_result['data']['content'], steering_text)
        self.assertGreaterEqual(row[7], len(steering_text) // 4)
        self.assertEqual(row[8], row[6] + row[7])

    def test_get_steering_allows_full_body_again_after_guard_window(self):
        now = [2000.0]
        calls = []

        def fake_read_steering():
            calls.append(len(calls) + 1)
            return f'full steering {len(calls)}'

        self.module._steering_guard_now = lambda: now[0]
        self.module._read_steering = fake_read_steering

        first = asyncio.run(self.module.get_steering())
        now[0] += self.module._STEERING_GUARD_WINDOW_SECONDS + 1
        second = asyncio.run(self.module.get_steering())

        self.assertEqual(first, 'full steering 1')
        self.assertEqual(second, 'full steering 2')
        self.assertEqual(calls, [1, 2])

    def test_refresh_steering_requires_reason_and_rate_limits_break_glass(self):
        now = [3000.0]
        calls = []

        def fake_read_steering():
            calls.append(len(calls) + 1)
            return f'forced steering {len(calls)}'

        self.module._steering_guard_now = lambda: now[0]
        self.module._read_steering = fake_read_steering

        no_reason = asyncio.run(self.module.refresh_steering(reason='  '))
        first = asyncio.run(self.module.refresh_steering(reason='need a fresh bootstrap after model context reset'))
        second = asyncio.run(self.module.refresh_steering(reason='still retrying'))
        now[0] += self.module._STEERING_FORCE_WINDOW_SECONDS + 1
        third = asyncio.run(self.module.refresh_steering(reason='new run after force window'))

        self.assertIn('REFRESH_STEERING_REASON_REQUIRED', no_reason)
        self.assertEqual(first, 'forced steering 1')
        self.assertIn('REFRESH_STEERING_RATE_LIMITED', second)
        self.assertEqual(third, 'forced steering 2')
        self.assertEqual(calls, [1, 2])

        conn = self.module.sqlite3.connect(os.environ['OPENWORKSPACE_TRACE_DB'])
        try:
            rows = conn.execute('SELECT code, result_json FROM tool_traces WHERE tool = ? ORDER BY ts', ('refresh_steering',)).fetchall()
        finally:
            conn.close()

        self.assertEqual([row[0] for row in rows], ['REFRESH_REASON_REQUIRED', 'OK', 'REFRESH_RATE_LIMITED', 'OK'])
        self.assertEqual(json.loads(rows[1][1])['data']['decision'], 'forced_refresh')
        self.assertEqual(json.loads(rows[1][1])['data']['reason'], 'need a fresh bootstrap after model context reset')

    def test_call_runs_workspace_execution_off_event_loop(self):
        events = []

        def fake_traced_call(*args, **kwargs):
            time.sleep(0.05)
            events.append('call-done')
            return {'ok': True, 'code': 'OK'}

        self.module._traced_call = fake_traced_call

        async def run_call_with_timer():
            task = asyncio.create_task(self.module.call(tool='status', input={}, timeout=7))
            await asyncio.sleep(0.005)
            events.append('event-loop-free')
            return await task

        result = asyncio.run(run_call_with_timer())
        self.assertEqual(result, {'ok': True, 'code': 'OK'})
        self.assertEqual(events, ['event-loop-free', 'call-done'])

    def test_task_scoped_tools_require_task_session(self):
        manifest = json.loads(Path('packages/workspace/tooling/tool-manifest.json').read_text(encoding='utf-8'))
        required_tools = [entry['name'] for entry in manifest if entry.get('sessionRequired')]
        self.assertGreater(len(required_tools), 0)
        for tool in required_tools:
            with self.subTest(tool=tool):
                result = self.module._run_workspace_call(tool, tool_input={})
                self.assert_standard_envelope(result)
                self.assertFalse(result['ok'])
                self.assertEqual(result['code'], 'TASK_SESSION_REQUIRED')

    def test_read_only_fs_tools_do_not_require_task_session(self):
        manifest = json.loads(Path('packages/workspace/tooling/tool-manifest.json').read_text(encoding='utf-8'))
        by_name = {entry['name']: entry for entry in manifest}
        for tool in ['fs.read', 'fs.search']:
            with self.subTest(tool=tool):
                self.assertIn(tool, by_name)
                self.assertFalse(by_name[tool].get('sessionRequired'), tool)
                self.assertEqual(by_name[tool].get('command', {}).get('branchMode'), 'optional')

        captured = []

        def fake_run(args, **kwargs):
            captured.append(args)
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            read_result = self.module._run_workspace_call('fs.read', tool_input={'path': 'AGENTS.md'})
            search_result = self.module._run_workspace_call('fs.search', tool_input={'pattern': 'workspace', 'paths': ['AGENTS.md']})

        self.assert_standard_envelope(read_result)
        self.assert_standard_envelope(search_result)
        self.assertTrue(read_result['ok'])
        self.assertTrue(search_result['ok'])
        self.assertEqual(len(captured), 2)
        for args in captured:
            resolved_input = json.loads(args[3])
            self.assertNotIn('taskSession', resolved_input)
            self.assertNotIn('branch', resolved_input)

    def test_session_optional_tools_with_optional_branch_mode_do_not_require_task_session(self):
        captured = {}
        manifest_entry = {
            'name': 'code.run',
            'sessionRequired': False,
            'command': {'branchMode': 'optional'},
        }

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module, '_load_manifest_entries', return_value=[manifest_entry]), \
                patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('code.run', tool_input={'code': 'return 1'})

        self.assert_standard_envelope(result)
        self.assertTrue(result['ok'])
        resolved_input = json.loads(captured['args'][3])
        self.assertEqual(resolved_input['code'], 'return 1')
        self.assertNotIn('taskSession', resolved_input)

    def test_branch_required_tools_still_require_task_session(self):
        manifest_entry = {
            'name': 'example.required',
            'sessionRequired': False,
            'command': {'branchMode': 'required'},
        }

        with patch.object(self.module, '_load_manifest_entries', return_value=[manifest_entry]):
            result = self.module._run_workspace_call('example.required', tool_input={})

        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'TASK_SESSION_REQUIRED')

    def test_object_wrapped_batch_task_session_propagates_to_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call(
                'batch',
                taskSession=self.session,
                tool_input={'steps': [{'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}}]},
            )
        self.assertTrue(result['ok'])
        batch_input = json.loads(captured['args'][3])
        self.assertIsInstance(batch_input, list)
        self.assertEqual(batch_input[0]['input']['taskSession'], self.session)
        self.assertNotIn('branch', batch_input[0]['input'])

    def test_batch_task_session_propagates_to_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call(
                'batch',
                taskSession=self.session,
                tool_input=[{'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}}],
            )
        self.assertTrue(result['ok'])
        batch_input = json.loads(captured['args'][3])
        self.assertEqual(batch_input[0]['input']['taskSession'], self.session)
        self.assertNotIn('branch', batch_input[0]['input'])

    def test_batch_task_session_propagates_to_nested_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call(
                'batch',
                taskSession=self.session,
                tool_input=[{'tool': 'batch', 'input': [
                    {'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}},
                ]}],
            )
        self.assertTrue(result['ok'])
        batch_input = json.loads(captured['args'][3])
        nested_input = batch_input[0]['input'][0]['input']
        self.assertEqual(nested_input['taskSession'], self.session)
        self.assertNotIn('branch', nested_input)

    def test_task_session_and_branch_conflict_is_standard_error(self):
        result = self.module._run_workspace_call(
            'fs.read',
            taskSession=self.session,
            tool_input={'branch': 'task/workspace-agents/other', 'path': 'AGENTS.md'},
        )
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'VALIDATION_ERROR')

    def test_task_session_allows_matching_input_branch_for_code_call(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {'stdout': 'ok'},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call(
                'code.call',
                taskSession=self.session,
                tool_input={
                    'branch': 'task/workspace-agents/test',
                    'language': 'python',
                    'mode': 'read',
                    'code': 'print("ok")',
                },
            )

        self.assert_standard_envelope(result)
        self.assertTrue(result['ok'])
        resolved_input = json.loads(captured['args'][3])
        self.assertEqual(resolved_input['taskSession'], self.session)
        self.assertEqual(resolved_input['branch'], 'task/workspace-agents/test')
        self.assertEqual(result['taskContext']['taskSession'], self.session)
        self.assertEqual(result['taskContext']['branch'], 'task/workspace-agents/test')

    def test_task_session_and_nested_batch_branch_conflict_is_standard_error(self):
        result = self.module._run_workspace_call(
            'batch',
            taskSession=self.session,
            tool_input=[{'tool': 'batch', 'input': [
                {'tool': 'fs.read', 'input': {
                    'branch': 'task/workspace-agents/other',
                    'path': 'AGENTS.md',
                }},
            ]}],
        )
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'VALIDATION_ERROR')

    def test_missing_task_session_is_standard_error(self):
        result = self.module._run_workspace_call('fs.read', taskSession='tsk_missing', tool_input={'path': 'AGENTS.md'})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'TASK_SESSION_NOT_FOUND')

    def test_missing_task_session_with_input_branch_is_not_branch_conflict(self):
        result = self.module._run_workspace_call(
            'fs.read',
            taskSession='tsk_missing',
            tool_input={'path': 'AGENTS.md', 'branch': 'task/workspace-agents/test'},
        )
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'TASK_SESSION_NOT_FOUND')

    def test_top_level_task_session_resolves_from_scoped_metadata_without_root_session(self):
        self._remove_legacy_session()
        self._write_scoped_session()
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('fs.read', taskSession=self.session, tool_input={'path': 'AGENTS.md'})

        self.assert_standard_envelope(result)
        self.assertTrue(result['ok'])
        resolved_input = json.loads(captured['args'][3])
        self.assertEqual(resolved_input['taskSession'], self.session)
        self.assertEqual(result['taskContext']['taskSession'], self.session)
        self.assertEqual(result['taskContext']['branch'], 'task/workspace-agents/test')

    def test_input_level_task_session_is_promoted_for_session_required_tools(self):
        self._remove_legacy_session()
        self._write_scoped_session()
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('fs.read', tool_input={'path': 'AGENTS.md', 'taskSession': self.session})

        self.assert_standard_envelope(result)
        self.assertTrue(result['ok'])
        resolved_input = json.loads(captured['args'][3])
        self.assertEqual(resolved_input['taskSession'], self.session)
        self.assertEqual(result['taskContext']['taskSession'], self.session)

    def test_conflicting_top_level_and_input_task_session_is_standard_error(self):
        result = self.module._run_workspace_call(
            'fs.read',
            taskSession='tsk_outer',
            tool_input={'path': 'AGENTS.md', 'taskSession': 'tsk_inner'},
        )
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'VALIDATION_ERROR')

    def test_bun_file_not_found_is_standard_error(self):
        def fake_run(args, **kwargs):
            raise FileNotFoundError('bun')

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('status', tool_input={})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'COMMAND_FAILED')

    def test_workspace_call_passes_timeout_to_subprocess(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['timeout'] = kwargs.get('timeout')
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('status', tool_input={}, timeout=7)
        self.assertTrue(result['ok'])
        self.assertEqual(captured['timeout'], 7)

    def test_workspace_call_uses_long_timeout_for_review_and_verify(self):
        captured = []

        def fake_run(args, **kwargs):
            captured.append((args[2], kwargs.get('timeout')))
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 1,
                'traceId': 'trc_child',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            review = self.module._run_workspace_call('review.run', taskSession=self.session, tool_input={})
            verify = self.module._run_workspace_call('verify', taskSession=self.session, tool_input={})
            status = self.module._run_workspace_call('status', tool_input={})

        self.assertTrue(review['ok'])
        self.assertTrue(verify['ok'])
        self.assertTrue(status['ok'])
        self.assertEqual(captured, [
            ('review.run', 1200),
            ('verify', 1200),
            ('status', 120),
        ])

    def test_workspace_call_writes_raw_sqlite_trace_row(self):
        def fake_run(args, **kwargs):
            return Completed(json.dumps({
                'ok': True,
                'code': 'OK',
                'message': 'ok',
                'data': {'answer': 1},
                'stderr': '',
                'exitCode': 0,
                'durationMs': 3,
                'traceId': 'trc_child_visible',
                'now': '1970-01-01T00:00:01.000Z',
                'apiVersion': '1.0.0',
            }))

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('status', tool_input={'path': 'AGENTS.md'}, timeout=7)

        self.assertTrue(result['ok'])
        conn = self.module.sqlite3.connect(os.environ['OPENWORKSPACE_TRACE_DB'])
        try:
            row = conn.execute('SELECT trace_id, tool, status, ok, code, input_json, result_json FROM tool_traces').fetchone()
        finally:
            conn.close()
        self.assertEqual(row[0], 'trc_child_visible')
        self.assertEqual(row[1], 'status')
        self.assertEqual(row[2], 'ok')
        self.assertEqual(row[3], 1)
        self.assertEqual(row[4], 'OK')
        self.assertEqual(json.loads(row[5]), {'path': 'AGENTS.md'})
        self.assertEqual(json.loads(row[6])['data'], {'answer': 1})

    def test_safety_block_writes_blocked_sqlite_trace_row(self):
        command = ''.join(chr(value) for value in [114, 109, 32, 45, 114, 102, 32, 47])
        result = self.module._run_workspace_call('mac.exec', tool_input={'command': command})
        self.assertFalse(result['ok'])
        conn = self.module.sqlite3.connect(os.environ['OPENWORKSPACE_TRACE_DB'])
        try:
            row = conn.execute('SELECT trace_id, tool, status, code FROM tool_traces').fetchone()
        finally:
            conn.close()
        self.assertEqual(row[0], result['traceId'])
        self.assertEqual(row[1], 'mac.exec')
        self.assertEqual(row[2], 'blocked')
        self.assertEqual(row[3], 'SAFETY_BLOCKED')

    def test_trace_db_cap_deletes_old_rows(self):
        self.module._TRACE_DB_MAX_BYTES = 1
        db_path = Path(os.environ['OPENWORKSPACE_TRACE_DB'])
        conn, path_value = self.module._open_trace_db()
        try:
            for index in range(3):
                conn.execute('''
                    INSERT INTO tool_traces(id, ts, trace_id, source, tool, status, ok)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (f'id-{index}', f'2026-01-01T00:00:0{index}+00:00', f'trc_{index}', 'test', 'status', 'ok', 1))
            conn.commit()
            self.module._enforce_trace_db_cap(conn, path_value)
            count = conn.execute('SELECT count(*) FROM tool_traces').fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(db_path, path_value)
        self.assertEqual(count, 0)

    def test_safety_blocks_task_exec_destructive_command_and_writes_audit_log(self):
        self.module._SAFETY_AUDIT_FILE = str(Path(self.tempdir.name) / 'audit.jsonl')
        command = ''.join(chr(value) for value in [114, 109, 32, 45, 114, 102, 32, 47])
        result = self.module._run_workspace_call('task.exec', tool_input={'command': ['bash', '-lc', command]})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')
        audit = Path(self.module._SAFETY_AUDIT_FILE).read_text(encoding='utf-8')
        self.assertIn('"blocked": true', audit)
        self.assertIn('task.exec', audit)

    def test_safety_blocks_mac_exec_destructive_command_before_execution(self):
        command = ''.join(chr(value) for value in [114, 109, 32, 45, 114, 102, 32, 47])
        result = self.module._run_workspace_call('mac.exec', tool_input={'command': command})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')

    def test_safety_blocks_mac_process_killing_protected_tunnel(self):
        result = self.module._run_workspace_call('mac.process', tool_input={
            'action': 'kill',
            'name': 'cloudflared',
        })
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')
        self.assertIn('cloudflared', result['message'])

    def test_safety_blocks_object_wrapped_batch_child_before_execution(self):
        command = ''.join(chr(value) for value in [110, 112, 109, 32, 112, 117, 98, 108, 105, 115, 104])
        result = self.module._run_workspace_call('batch', tool_input={
            'steps': [
                {'tool': 'status', 'input': {}},
                {'tool': 'task.exec', 'input': {'command': command}},
            ],
        })
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')
        self.assertIn('batch[1]', result['message'])

    def test_safety_blocks_nested_batch_child_before_execution(self):
        command = ''.join(chr(value) for value in [110, 112, 109, 32, 112, 117, 98, 108, 105, 115, 104])
        result = self.module._run_workspace_call('batch', tool_input=[
            {'tool': 'status', 'input': {}},
            {'tool': 'batch', 'input': [
                {'tool': 'task.exec', 'input': {'command': command}},
            ]},
        ])
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')
        self.assertIn('batch[1]', result['message'])
        self.assertIn('batch[0]', result['message'])

    def test_safety_blocks_mac_write_to_ssh_config_before_execution(self):
        result = self.module._run_workspace_call('mac.write', tool_input={
            'path': '~/.ssh/config',
            'content': 'x',
        })
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')

    def test_safety_blocks_structured_protected_path_mutations(self):
        protected_root = str(Path(self.tempdir.name) / 'protected') + '/'
        protected_file = protected_root + 'config'
        tool_inputs = {
            'fs.write': {'path': protected_file, 'content': 'x'},
            'fs.trash': {'path': protected_file},
            'mac.write': {'path': protected_file, 'content': 'x'},
        }
        with patch.object(self.module.sandbox_mod, '_protected_paths', return_value=[protected_root]):
            for tool, tool_input in tool_inputs.items():
                with self.subTest(tool=tool):
                    result = self.module._run_workspace_call(
                        tool,
                        taskSession=self.session,
                        tool_input=tool_input,
                    )
                    self.assert_standard_envelope(result)
                    self.assertFalse(result['ok'])
                    self.assertEqual(result['code'], 'SAFETY_BLOCKED')

    def test_safety_blocks_fs_write_to_real_protected_path_before_execution(self):
        result = self.module._run_workspace_call('fs.write', taskSession=self.session, tool_input={
            'path': str(Path.home() / '.ssh' / 'config'),
            'content': 'x',
        })
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')

    def test_safety_blocks_supplemental_system_commands(self):
        command = ''.join(chr(value) for value in [100, 105, 115, 107, 117, 116, 105, 108, 32, 101, 114, 97, 115, 101, 32, 100, 105, 115, 107])
        result = self.module._run_workspace_call('task.exec', tool_input={'command': command})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')


    def test_workspace_call_trace_inputs_are_scan_friendly(self):
        inputs = self.module._trace_inputs('workspace.call', (), {
            'tool': 'task.exec',
            'tool_input': {'command': ['bash', '-lc', 'echo hello']},
            'taskSession': 'tsk_123',
            'timeout': 120,
        })
        self.assertEqual(inputs['action'], 'task.exec')
        self.assertEqual(inputs['tool'], 'task.exec')
        self.assertEqual(inputs['taskSession'], 'tsk_123')
        self.assertEqual(inputs['timeout'], 120)
        self.assertIn('bash -lc echo hello', inputs['inputSummary'])
        self.assertEqual(self.module._trace_run_name('workspace.call', inputs), 'task.exec')

    def test_workspace_call_trace_output_surfaces_task_context(self):
        inputs = {'tool': 'task.exec', 'taskSession': 'tsk_123'}
        result = {
            'ok': True,
            'code': 'OK',
            'taskContext': {
                'taskSession': 'tsk_123',
                'tmuxSession': 'opensaas-test-tmux',
                'branch': 'task/workspace-agents/test',
                'worktree': '/tmp/opensaas-worktrees/test',
            },
        }
        usage = {'prompt_tokens': 1, 'completion_tokens': 2, 'total_tokens': 3}
        output = self.module._trace_outputs('workspace.call', inputs, result, usage)
        self.assertEqual(output['summary'], 'OK · task.exec · tmux=opensaas-test-tmux')
        self.assertTrue(output['ok'])
        self.assertEqual(output['code'], 'OK')
        self.assertEqual(output['tool'], 'task.exec')
        self.assertEqual(output['taskSession'], 'tsk_123')
        self.assertEqual(output['tmuxSession'], 'opensaas-test-tmux')
        self.assertEqual(output['branch'], 'task/workspace-agents/test')
        self.assertEqual(output['worktree'], '/tmp/opensaas-worktrees/test')
        self.assertIs(output['result'], result)
        self.assertIs(output['usage'], usage)

    def test_batch_trace_summary_lists_child_tools(self):
        summary = self.module._trace_input_summary('batch', [
            {'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}},
            {'tool': 'task.exec', 'input': {'command': ['git', 'status']}},
        ])
        self.assertEqual(summary, '2 steps: fs.read, task.exec')

    def test_trace_command_summary_truncates_long_values(self):
        summary = self.module._trace_input_summary('task.exec', {
            'command': ['python3', '-c', 'x' * 500],
        })
        self.assertLessEqual(len(summary), self.module._TRACE_SUMMARY_LIMIT)
        self.assertTrue(summary.endswith('…'))



if __name__ == '__main__':
    unittest.main()