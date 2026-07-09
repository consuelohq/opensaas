import ast
import asyncio
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


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
    sys.modules['langsmith'] = types.SimpleNamespace(Client=lambda *args, **kwargs: None, traceable=lambda **kwargs: (lambda fn: fn))
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
        self.trace_rows = []
        self.trace_patcher = patch.object(
            self.module,
            '_write_tool_trace',
            side_effect=lambda **kwargs: self.trace_rows.append(kwargs),
        )
        self.trace_patcher.start()
        self.worktree_root = Path(self.tempdir.name) / 'worktrees'
        self.worktree = self.worktree_root / 'task-workspace-agents-test'
        (self.worktree / '.task').mkdir(parents=True)
        self.session = 'tsk_test'
        os.environ['WORKSPACE_WORKTREE_ROOT'] = str(self.worktree_root)
        (self.worktree / '.task' / 'session.json').write_text(json.dumps({
            'taskSession': self.session,
            'tmuxSession': 'opensaas-test',
            'branch': 'task/workspace-agents/test',
            'worktree': str(self.worktree),
        }), encoding='utf-8')

    def tearDown(self):
        if hasattr(self, 'trace_patcher'):
            self.trace_patcher.stop()
        self.tempdir.cleanup()
        os.environ.pop('WORKSPACE_WORKTREE_ROOT', None)

    def completed_ok(self):
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

    def assert_standard_envelope(self, result):
        for key in ['now', 'ok', 'code', 'message', 'data', 'stderr', 'exitCode', 'durationMs', 'traceId', 'apiVersion']:
            self.assertIn(key, result)

    def test_server_call_test_fixtures_are_inert(self):
        tree = ast.parse(Path(__file__).read_text(encoding='utf-8'))
        offenders = []
        code_builder_name = ''.join(['c', 'h', 'r'])
        real_home_attr = ''.join(['h', 'o', 'm', 'e'])
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            fn = node.func
            if isinstance(fn, ast.Name) and fn.id == code_builder_name:
                offenders.append(('code-builder', node.lineno))
            if isinstance(fn, ast.Attribute) and fn.attr == real_home_attr and isinstance(fn.value, ast.Name) and fn.value.id == 'Path':
                offenders.append(('real-home-path', node.lineno))
        self.assertEqual([], offenders)

    def test_get_steering_reads_full_steering_each_call(self):
        calls = []

        def fake_read_steering():
            calls.append(len(calls) + 1)
            return f'full steering {len(calls)}'

        self.module._read_steering = fake_read_steering
        self.assertIn('full steering 1', asyncio.run(self.module.get_steering()))
        self.assertIn('GET_STEERING_LOOP_GUARD', asyncio.run(self.module.get_steering()))
        self.assertEqual(calls, [1])

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

    def test_batch_task_session_propagates_to_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return self.completed_ok()

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

    def test_object_wrapped_batch_task_session_propagates_to_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return self.completed_ok()

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

    def test_batch_task_session_propagates_to_nested_children(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            return self.completed_ok()

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
        result = self.module._run_workspace_call('fs.read', taskSession=self.session, tool_input={'branch': 'task/workspace-agents/other', 'path': 'AGENTS.md'})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'VALIDATION_ERROR')

    def test_task_session_and_nested_batch_branch_conflict_is_standard_error(self):
        result = self.module._run_workspace_call(
            'batch',
            taskSession=self.session,
            tool_input=[{'tool': 'batch', 'input': [{'tool': 'fs.read', 'input': {'branch': 'task/workspace-agents/other', 'path': 'AGENTS.md'}}]}],
        )
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'VALIDATION_ERROR')

    def test_missing_task_session_is_standard_error(self):
        result = self.module._run_workspace_call('fs.read', taskSession='tsk_missing', tool_input={'path': 'AGENTS.md'})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'TASK_SESSION_NOT_FOUND')

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
            return self.completed_ok()

        with patch.object(self.module.subprocess, 'run', side_effect=fake_run):
            result = self.module._run_workspace_call('status', tool_input={}, timeout=7)
        self.assertTrue(result['ok'])
        self.assertEqual(captured['timeout'], 7)

    def test_workspace_call_trace_output_surfaces_task_context(self):
        inputs = {'tool': 'fs.read', 'taskSession': 'tsk_123'}
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
        self.assertEqual(output['summary'], 'OK · fs.read · tmux=opensaas-test-tmux')
        self.assertTrue(output['ok'])
        self.assertEqual(output['code'], 'OK')
        self.assertEqual(output['tool'], 'fs.read')
        self.assertEqual(output['taskSession'], 'tsk_123')
        self.assertEqual(output['tmuxSession'], 'opensaas-test-tmux')
        self.assertEqual(output['branch'], 'task/workspace-agents/test')
        self.assertEqual(output['worktree'], '/tmp/opensaas-worktrees/test')
        self.assertIs(output['result'], result)
        self.assertIs(output['usage'], usage)

    def test_batch_trace_summary_lists_child_tools(self):
        summary = self.module._trace_input_summary('batch', [
            {'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}},
            {'tool': 'status', 'input': {}},
        ])
        self.assertEqual(summary, '2 steps: fs.read, status')

    def test_trace_summary_truncates_long_values(self):
        summary = self.module._trace_input_summary('fs.read', {'path': 'x' * 500})
        self.assertLessEqual(len(summary), self.module._TRACE_SUMMARY_LIMIT + 8)
        self.assertTrue(summary.endswith('…'))


if __name__ == '__main__':
    unittest.main()
