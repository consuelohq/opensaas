import { describe, expect, test } from 'bun:test';

import { createAuthenticatedMcpPrincipal } from '../scripts/server/security/authenticated-principal';

describe('authenticated MCP principal', () => {
  test('keeps the principal key stable when only granted scopes change', () => {
    const base = {
      authMode: 'oauth' as const,
      workspaceId: 'workspace_acme',
      workspaceHost: 'acme.consuelohq.com',
      subjectId: 'google:user-123',
      clientId: 'https://chatgpt.com/oauth/consuelo-os/client.json',
    };
    const readPrincipal = createAuthenticatedMcpPrincipal({
      ...base,
      scopes: ['mcp:read'],
    });
    const callPrincipal = createAuthenticatedMcpPrincipal({
      ...base,
      scopes: ['mcp:read', 'mcp:call'],
    });

    expect(readPrincipal.principalKey).toBe(callPrincipal.principalKey);
    expect(readPrincipal.principalKey).toMatch(/^prn_[a-f0-9]{32}$/);
  });

  test('separates principals by OAuth client identity', () => {
    const common = {
      authMode: 'oauth' as const,
      workspaceId: 'workspace_acme',
      workspaceHost: 'acme.consuelohq.com',
      subjectId: 'google:user-123',
      scopes: ['mcp:read'],
    };
    const chatGpt = createAuthenticatedMcpPrincipal({
      ...common,
      clientId: 'https://chatgpt.com/oauth/consuelo-os/client.json',
    });
    const operator = createAuthenticatedMcpPrincipal({
      ...common,
      clientId: 'consuelo-operator',
    });

    expect(chatGpt.principalKey).not.toBe(operator.principalKey);
  });
});
