import importlib.util
import json
import os
import sys
import tempfile
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
        self.module._SAFETY_AUDIT_FILE = str(Path(self.tempdir.name) / 'audit.jsonl')
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

    def test_get_steering_reads_full_steering_each_call(self):
        calls = []

        def fake_read_steering():
            calls.append(len(calls) + 1)
            return f'full steering {len(calls)}'

        self.module._read_steering = fake_read_steering
        first = self.module.get_steering()
        second = self.module.get_steering()
        self.assertEqual(first, 'full steering 1')
        self.assertEqual(second, 'full steering 2')
        self.assertEqual(calls, [1, 2])

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

    def test_safety_blocks_task_exec_destructive_command_and_writes_audit_log(self):
        self.module._SAFETY_AUDIT_FILE = str(Path(self.tempdir.name) / 'audit.jsonl')
        command = ''.join(chr(value) for value in [114, 109, 32, 45, 114, 102, 32, 47])
        result = self.module._run_workspace_call('code.call', tool_input={'language': 'bash', 'mode': 'verify', 'code': command})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')
        audit = Path(self.module._SAFETY_AUDIT_FILE).read_text(encoding='utf-8')
        self.assertIn('"blocked": true', audit)
        self.assertIn('code.call', audit)

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
                {'tool': 'code.call', 'input': {'language': 'bash', 'mode': 'verify', 'code': command}},
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
                {'tool': 'code.call', 'input': {'language': 'bash', 'mode': 'verify', 'code': command}},
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
        result = self.module._run_workspace_call('code.call', tool_input={'language': 'bash', 'mode': 'verify', 'code': command})
        self.assert_standard_envelope(result)
        self.assertFalse(result['ok'])
        self.assertEqual(result['code'], 'SAFETY_BLOCKED')


    def test_workspace_call_trace_inputs_are_scan_friendly(self):
        inputs = self.module._trace_inputs('workspace.call', (), {
            'tool': 'code.call',
            'tool_input': {'language': 'bash', 'mode': 'verify', 'code': 'echo hello'},
            'taskSession': 'tsk_123',
            'timeout': 120,
        })
        self.assertEqual(inputs['action'], 'code.call')
        self.assertEqual(inputs['tool'], 'code.call')
        self.assertEqual(inputs['taskSession'], 'tsk_123')
        self.assertEqual(inputs['timeout'], 120)
        self.assertIn('bash -lc echo hello', inputs['inputSummary'])
        self.assertEqual(self.module._trace_run_name('workspace.call', inputs), 'code.call')

    def test_workspace_call_trace_output_surfaces_task_context(self):
        inputs = {'tool': 'code.call', 'taskSession': 'tsk_123'}
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
        self.assertEqual(output['summary'], 'OK · code.call · tmux=opensaas-test-tmux')
        self.assertTrue(output['ok'])
        self.assertEqual(output['code'], 'OK')
        self.assertEqual(output['tool'], 'code.call')
        self.assertEqual(output['taskSession'], 'tsk_123')
        self.assertEqual(output['tmuxSession'], 'opensaas-test-tmux')
        self.assertEqual(output['branch'], 'task/workspace-agents/test')
        self.assertEqual(output['worktree'], '/tmp/opensaas-worktrees/test')
        self.assertIs(output['result'], result)
        self.assertIs(output['usage'], usage)

    def test_batch_trace_summary_lists_child_tools(self):
        summary = self.module._trace_input_summary('batch', [
            {'tool': 'fs.read', 'input': {'path': 'AGENTS.md'}},
            {'tool': 'code.call', 'input': {'language': 'bash', 'mode': 'verify', 'code': 'git status'}},
        ])
        self.assertEqual(summary, '2 steps: fs.read, code.call')

    def test_trace_command_summary_truncates_long_values(self):
        summary = self.module._trace_input_summary('code.call', {
            'language': 'python',
            'mode': 'verify',
            'code': 'x' * 500,
        })
        self.assertLessEqual(len(summary), self.module._TRACE_SUMMARY_LIMIT)
        self.assertTrue(summary.endswith('…'))


if __name__ == '__main__':
    unittest.main()
