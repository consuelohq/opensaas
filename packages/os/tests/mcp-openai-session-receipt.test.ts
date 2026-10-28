import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGatewaySecurityConfig,
  issueAgentAppToken,
  signMachineRequest,
} from '../scripts/lib/security-gateway';
import { createMcpRoutes } from '../scripts/server/routes/mcp';
import { removeSafeTempDir } from './safe-temp-cleanup';

let tempHome = '';

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-openai-session-receipt-'));
  process.env.CONSUELO_OS_HOME = tempHome;
  process.env.CONSUELO_HOME = tempHome;
  process.env.CONSUELO_OS_AUTH_CONFIG = join(
    tempHome,
    'security',
    'generated',
    'auth.json',
  );
  createGatewaySecurityConfig({
    home: tempHome,
    workspaceId: 'workspace_session_receipt',
    workspaceSlug: 'session-receipt',
    workspaceHost: 'session-receipt.consuelohq.com',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  removeSafeTempDir(tempHome, 'consuelo-openai-session-receipt-');
});

describe('OpenAI MCP session receipt correlation', () => {
  it('hashes the connector session consistently without logging the raw identifier', async () => {
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(),
    });
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const openaiSession = 'openai-session-never-log-this-value';
    const expectedKey = createHash('sha256')
      .update(`openai-session\n${openaiSession}`)
      .digest('hex')
      .slice(0, 16);
    const request = () => app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-openai-session': openaiSession,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/list' }),
    }));

    await request();
    await request();

    const receipts = writes
      .join('')
      .split('\n')
      .filter((line) => line.includes('local_os.mcp_request_received'));
    expect(receipts).toHaveLength(2);
    expect(receipts.every((line) => line.includes(expectedKey))).toBe(true);
    expect(writes.join('')).not.toContain(openaiSession);

    const durableReceipts = readFileSync(
      join(tempHome, 'node', 'logs', 'mcp-requests.jsonl'),
      'utf8',
    ).trim().split('\n').map((line) => JSON.parse(line) as {
      phase: string;
      requestId: string;
      connectorKey?: string;
      method?: string;
      status?: number;
    });
    expect(durableReceipts).toHaveLength(4);
    expect(durableReceipts.filter((receipt) => receipt.phase === 'received')).toHaveLength(2);
    expect(durableReceipts.filter((receipt) => receipt.phase === 'response_ready')).toHaveLength(2);
    expect(durableReceipts.every((receipt) => receipt.connectorKey === expectedKey)).toBe(true);
    expect(durableReceipts.every((receipt) => receipt.method === 'tools/list')).toBe(true);
    expect(JSON.stringify(durableReceipts)).not.toContain(openaiSession);
  });

  it('rejects oversized MCP bodies before receipt metadata processing', async () => {
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(),
    });
    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(4 * 1024 * 1024 + 1),
    }));

    expect(response.status).toBe(413);
    const receiptPath = join(tempHome, 'node', 'logs', 'mcp-requests.jsonl');
    expect(() => readFileSync(receiptPath, 'utf8')).toThrow();
  });

  it('bounds receipt metadata fields before durable logging', async () => {
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(),
    });
    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'x'.repeat(2_000), method: 'm'.repeat(2_000) }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);

    const durableReceipts = readFileSync(
      join(tempHome, 'node', 'logs', 'mcp-requests.jsonl'),
      'utf8',
    ).trim().split('\n').map((line) => JSON.parse(line) as { phase: string; jsonRpcId?: string; method?: string });
    const received = durableReceipts.find((receipt) => receipt.phase === 'received');
    expect(received?.jsonRpcId?.length).toBeLessThanOrEqual(256);
    expect(received?.method?.length).toBeLessThanOrEqual(256);
  });

  it('records HTTP 5xx responses as failed receipts even when Hono returns the response normally', async () => {
    const config = createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace_session_receipt',
      workspaceSlug: 'session-receipt',
      workspaceHost: 'session-receipt.consuelohq.com',
    });
    const token = issueAgentAppToken({
      config,
      callerId: 'caller_receipt_failure',
      appId: 'app_receipt_failure',
      subjectId: 'subject_receipt_failure',
      deviceId: 'device_receipt_failure',
      connectorId: 'connector_receipt_failure',
      connectionId: 'connection_receipt_failure',
      scopes: ['route:/mcp:read', 'tool:explore:read'],
      expiresInSeconds: 300,
    });
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(async () => { throw new Error('synthetic facade failure'); }),
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'receipt-500',
      method: 'tools/call',
      params: { name: 'call', arguments: { tool: 'explore', input: { query: 'status' } } },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-receipt-500',
    });
    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));
    expect(response.status).toBe(500);

    const durableReceipts = readFileSync(
      join(tempHome, 'node', 'logs', 'mcp-requests.jsonl'),
      'utf8',
    ).trim().split('\n').map((line) => JSON.parse(line) as { phase: string; status?: number });
    expect(durableReceipts.at(-1)).toMatchObject({ phase: 'failed', status: 500 });
  });
});
