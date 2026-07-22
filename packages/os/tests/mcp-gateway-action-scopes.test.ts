import { afterEach, describe, expect, test } from 'bun:test';

import { resolveMcpGatewayRequiredScope } from '../scripts/lib/mcp-gateway';
import type { GatewaySecurityConfig } from '../scripts/lib/security-gateway';
import { authorizeConsueloOAuthMcpRequest } from '../scripts/server/services/oauth-introspection';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('MCP gateway action scopes', () => {
  test.each([
    {
      condition: 'the action lists processes',
      input: { action: 'list' },
      expectedScope: 'tool:mac.process:read',
    },
    {
      condition: 'the action kills a process',
      input: { action: 'kill', pid: 123 },
      expectedScope: 'tool:mac.process:dangerous',
    },
    {
      condition: 'the action is missing',
      input: {},
      expectedScope: 'tool:mac.process:dangerous',
    },
    {
      condition: 'the action is unknown',
      input: { action: 'inspect' },
      expectedScope: 'tool:mac.process:dangerous',
    },
  ])(
    'should classify mac.process scope by action when $condition',
    ({ input, expectedScope }) => {
      const result = resolveMcpGatewayRequiredScope(JSON.stringify({
        jsonrpc: '2.0',
        id: 'call',
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'mac.process',
            input,
          },
        },
      }));

      expect(result).toMatchObject({
        ok: true,
        toolName: 'mac.process',
        requiredScope: expectedScope,
      });
    },
  );

  test.each([
    {
      condition: 'the action lists processes',
      input: { action: 'list' },
      tokenScopes: ['mcp:call'],
      expectedStatus: null,
    },
    {
      condition: 'the action kills a process',
      input: { action: 'kill', pid: 123 },
      tokenScopes: ['mcp:call'],
      expectedStatus: null,
    },
    {
      condition: 'the action kills a process through the explicit OS facade grant',
      input: { action: 'kill', pid: 123 },
      tokenScopes: ['os:tools'],
      expectedStatus: null,
    },
    {
      condition: 'the action kills a process with an explicit dangerous grant',
      input: { action: 'kill', pid: 123 },
      tokenScopes: ['tool:mac.process:dangerous'],
      expectedStatus: null,
    },
  ])(
    'should enforce the resolved mac.process scope when $condition',
    async ({ input, tokenScopes, expectedStatus }) => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        active: true,
        workspace_host: 'scope-test.consuelohq.com',
        scopes: tokenScopes,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const scope = resolveMcpGatewayRequiredScope(JSON.stringify({
        jsonrpc: '2.0',
        id: 'call',
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'mac.process',
            input,
          },
        },
      }));
      if (!scope.ok) throw new Error(scope.error.message);

      const response = await authorizeConsueloOAuthMcpRequest({
        config: {
          workspaceHost: 'scope-test.consuelohq.com',
        } as GatewaySecurityConfig,
        bearerToken: 'test-token',
        requiredScope: scope.requiredScope,
      });

      expect(response?.status ?? null).toBe(expectedStatus);
      if (expectedStatus === 403) {
        await expect(response?.json()).resolves.toMatchObject({
          error: { code: 'MISSING_SCOPE' },
        });
      }
    },
  );

  test.each([
    { tokenScopes: ['mcp:call'], label: 'compatibility MCP call grant' },
    { tokenScopes: ['os:tools'], label: 'canonical OS tool grant' },
  ])('should authorize task.push through the $label', async ({ tokenScopes }) => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      active: true,
      workspace_host: 'scope-test.consuelohq.com',
      scopes: tokenScopes,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const scope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool: 'task.push',
          input: { message: 'fix(os): example', changed: true },
        },
      },
    }));
    expect(scope).toMatchObject({
      ok: true,
      requiredScope: 'tool:task.push:dangerous',
    });
    if (!scope.ok) throw new Error(scope.error.message);

    const response = await authorizeConsueloOAuthMcpRequest({
      config: {
        workspaceHost: 'scope-test.consuelohq.com',
      } as GatewaySecurityConfig,
      bearerToken: 'test-token',
      requiredScope: scope.requiredScope,
    });

    expect(response).toBeNull();
  });
});
