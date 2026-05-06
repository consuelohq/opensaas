import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
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
        self.tempdir.cleanup()
        os.environ.pop('WORKSPACE_WORKTREE_ROOT', None)

    def assert_standard_envelope(self, result):
        for key in ['now', 'ok', 'code', 'message', 'data', 'stderr', 'exitCode', 'durationMs', 'traceId', 'apiVersion']:
            self.assertIn(key, result)

    def test_get_steering_returns_cached_full_steering(self):
        first = self.module.get_steering()
        second = self.module.get_steering()
        self.assertIsInstance(first, str)
        self.assertEqual(first, second)
        self.assertNotEqual(second, {'code': 'ALREADY_LOADED'})

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

        self.module.subprocess.run = fake_run
        result = self.module._run_workspace_call(
            'batch',
            taskSession=self.session,
            tool_input=[{'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}}],
        )
        self.assertTrue(result['ok'])
        batch_input = json.loads(captured['args'][3])
        self.assertEqual(batch_input[0]['input']['taskSession'], self.session)
        self.assertNotIn('branch', batch_input[0]['input'])

    def test_task_session_and_branch_conflict_is_standard_error(self):
        result = self.module._run_workspace_call(
            'fs.read',
            taskSession=self.session,
            tool_input={'branch': 'task/workspace-agents/other', 'path': 'AGENTS.md'},
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

        self.module.subprocess.run = fake_run
        result = self.module._run_workspace_call('status', tool_input={})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'COMMAND_FAILED')



if __name__ == '__main__':
    unittest.main()
