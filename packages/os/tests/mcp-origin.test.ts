import { describe, expect, test } from 'bun:test';

import { validateMcpRequestOrigin } from '../scripts/server/security/mcp-origin';

describe('MCP request Origin validation', () => {
  test('should allow native clients when Origin is omitted', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp'), {
      workspaceHost: 'acme.consuelohq.com',
      allowedOrigins: [],
    })).toEqual({ ok: true });
  });

  test('should allow a browser request when Origin matches the workspace', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'https://acme.consuelohq.com' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
      allowedOrigins: [],
    })).toEqual({ ok: true });
  });

  test('should reject a request when Origin is explicitly untrusted', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'https://attacker.example' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
      allowedOrigins: [],
    })).toMatchObject({
      ok: false,
      status: 403,
      code: 'INVALID_MCP_ORIGIN',
    });
  });

  test('should reject a request when Origin is the literal null value', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'null' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
      allowedOrigins: [],
    })).toMatchObject({
      ok: false,
      status: 403,
      code: 'INVALID_MCP_ORIGIN',
    });
  });

  test('should allow a request when Origin is explicitly allowlisted', () => {
    expect(validateMcpRequestOrigin(new Request('https://acme.consuelohq.com/mcp', {
      headers: { origin: 'https://chatgpt.com' },
    }), {
      workspaceHost: 'acme.consuelohq.com',
      allowedOrigins: ['https://chatgpt.com'],
    })).toEqual({ ok: true });
  });
});
