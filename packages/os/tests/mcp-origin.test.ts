import { describe, expect, test } from 'bun:test';

import { validateMcpRequestOrigin } from '../scripts/server/security/mcp-origin';

describe('MCP request Origin validation', () => {
  test('allows native clients that omit Origin', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp'), {
      workspaceHost: 'acme.consuelohq.com',
    })).toEqual({ ok: true });
  });

  test('allows the workspace same-origin browser request', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'https://acme.consuelohq.com' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
    })).toEqual({ ok: true });
  });

  test('rejects an explicit untrusted Origin', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'https://attacker.example' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
    })).toMatchObject({
      ok: false,
      status: 403,
      code: 'INVALID_MCP_ORIGIN',
    });
  });
});
