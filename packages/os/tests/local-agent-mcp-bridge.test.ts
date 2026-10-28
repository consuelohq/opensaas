import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createLocalAgentMcpBridge,
  loadLocalAgentCredential,
  validateLocalMcpUrl,
} from '../scripts/lib/local-agent-mcp-bridge';

const homes: string[] = [];

function createCredentialHome(mode = 0o600): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-agent-bridge-'));
  homes.push(home);
  const credentialPath = path.join(
    home,
    'node',
    'security',
    'generated',
    'local-agent-mcp.json',
  );
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
  fs.writeFileSync(credentialPath, JSON.stringify({
    version: 1,
    kind: 'consuelo-local-agent-mcp-credentials',
    localUrl: 'http://127.0.0.1:46321/mcp',
    agents: {
      codex: { tokenId: 'token_codex', bearerToken: 'local-secret' },
    },
  }), { mode });
  fs.chmodSync(credentialPath, mode);
  return home;
}

afterEach(() => {
  for (const home of homes.splice(0)) {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

describe('local agent MCP bridge', () => {
  it('accepts only explicit loopback HTTP MCP URLs', () => {
    expect(validateLocalMcpUrl('http://127.0.0.1:46321/mcp').toString()).toBe(
      'http://127.0.0.1:46321/mcp',
    );
    for (const invalid of [
      'https://127.0.0.1:46321/mcp',
      'http://localhost:46321/mcp',
      'http://127.0.0.1:46321/health',
      'http://user:pass@127.0.0.1:46321/mcp',
      'http://127.0.0.1:46321/mcp?token=secret',
    ]) {
      expect(() => validateLocalMcpUrl(invalid)).toThrow();
    }
  });

  it('rejects credential documents readable by other users', () => {
    const home = createCredentialHome(0o644);
    expect(() => loadLocalAgentCredential({ home, agentId: 'codex' })).toThrow(
      'must have mode 0600',
    );
  });

  it('forwards with the per-agent bearer token and preserves MCP sessions', async () => {
    const home = createCredentialHome();
    const requests: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json(
        { jsonrpc: '2.0', id: requests.length, result: { tools: [] } },
        { headers: { 'mcp-session-id': 'session_123' } },
      );
    };
    const bridge = createLocalAgentMcpBridge({ home, agentId: 'codex', fetchImpl });

    await bridge.forward('{"jsonrpc":"2.0","id":1,"method":"initialize"}');
    await bridge.forward('{"jsonrpc":"2.0","id":2,"method":"tools/list"}');

    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe('http://127.0.0.1:46321/mcp');
    expect(requests[0].headers.get('authorization')).toBe('Bearer local-secret');
    expect(requests[0].headers.get('x-consuelo-agent-id')).toBe('codex');
    expect(requests[0].headers.get('mcp-session-id')).toBeNull();
    expect(requests[1].headers.get('mcp-session-id')).toBe('session_123');
  });

  it('forwards modern MCP metadata as stateless HTTP routing headers', async () => {
    const home = createCredentialHome();
    const requests: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json(
        { jsonrpc: '2.0', id: requests.length, result: { resultType: 'complete', tools: [] } },
        { headers: { 'mcp-session-id': 'legacy-session-must-be-ignored' } },
      );
    };
    const bridge = createLocalAgentMcpBridge({ home, agentId: 'codex', fetchImpl });
    const meta = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'bridge-test', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    };

    await bridge.forward(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { _meta: meta },
    }));
    await bridge.forward(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'call', arguments: { tool: 'status' }, _meta: meta },
    }));

    expect(requests).toHaveLength(2);
    expect(requests[0].headers.get('mcp-protocol-version')).toBe('2026-07-28');
    expect(requests[0].headers.get('mcp-method')).toBe('tools/list');
    expect(requests[0].headers.get('mcp-name')).toBeNull();
    expect(requests[0].headers.get('mcp-session-id')).toBeNull();
    expect(requests[1].headers.get('mcp-protocol-version')).toBe('2026-07-28');
    expect(requests[1].headers.get('mcp-method')).toBe('tools/call');
    expect(requests[1].headers.get('mcp-name')).toBe('call');
    expect(requests[1].headers.get('mcp-session-id')).toBeNull();
  });

  it('returns a retryable JSON-RPC error without exposing credentials', async () => {
    const home = createCredentialHome();
    const bridge = createLocalAgentMcpBridge({
      home,
      agentId: 'codex',
      fetchImpl: async () => {
        throw new Error('connection refused');
      },
    });

    const responses = await bridge.forward(
      '{"jsonrpc":"2.0","id":41,"method":"tools/list"}',
    );
    expect(responses).toEqual([{
      jsonrpc: '2.0',
      id: 41,
      error: {
        code: -32001,
        message: 'Consuelo node is temporarily unavailable.',
        data: {
          code: 'CONSUELO_NODE_UNAVAILABLE',
          retryable: true,
          retryAfterSeconds: 2,
        },
      },
    }]);
    expect(JSON.stringify(responses)).not.toContain('local-secret');
  });

  it('should suppress successful and failed responses to MCP notifications', async () => {
    const notification = JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    });
    const home = createCredentialHome();
    const successful = createLocalAgentMcpBridge({
      home,
      agentId: 'codex',
      fetchImpl: async () =>
        Response.json({ jsonrpc: '2.0', id: null, result: {} }),
    });
    const rejected = createLocalAgentMcpBridge({
      home,
      agentId: 'codex',
      fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    const unreachable = createLocalAgentMcpBridge({
      home,
      agentId: 'codex',
      fetchImpl: async () => {
        throw new Error('connection refused');
      },
    });

    await expect(successful.forward(notification)).resolves.toEqual([]);
    await expect(rejected.forward(notification)).resolves.toEqual([]);
    await expect(unreachable.forward(notification)).resolves.toEqual([]);
  });
});