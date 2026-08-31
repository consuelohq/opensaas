import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';
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
  });
});
