import importlib.util
import json
import os
import sqlite3
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
    spec = importlib.util.spec_from_file_location('os_server_for_test', 'packages/os/server.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class OsSteeringServerTest(unittest.TestCase):
    def setUp(self):
        self.module = load_server_module()
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ['CONSUELO_HOME'] = str(Path(self.tempdir.name) / 'consuelo-home')

    def tearDown(self):
        self.tempdir.cleanup()
        os.environ.pop('CONSUELO_HOME', None)

    def test_get_steering_records_compact_execution_row(self):
        steering_text = 'os steering payload ' * 40

        def fake_build_steering():
            return steering_text

        self.module._build_steering = fake_build_steering
        result = self.module.get_steering()
        self.assertEqual(result, steering_text)

        db_path = Path(os.environ['CONSUELO_HOME']) / 'consuelo.db'
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute('SELECT name, status, input_json, output_json, duration_ms FROM skill_executions').fetchone()
        finally:
            conn.close()

        self.assertIsNotNone(row)
        self.assertEqual(row[0], 'get_steering')
        self.assertEqual(row[1], 'succeeded')
        self.assertEqual(json.loads(row[2]), {})
        output = json.loads(row[3])
        self.assertEqual(output['result']['chars'], len(steering_text))
        self.assertNotIn(steering_text, row[3])
        self.assertGreaterEqual(row[4], 0)


if __name__ == '__main__':
    unittest.main()
