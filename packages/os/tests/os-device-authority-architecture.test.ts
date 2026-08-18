import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { DEVICE_AUTHORITY_ROUTE_POLICIES } from '../cloudflare/os-device-authority/src/security/route-policies';
import { redactWorkspaceRouteSetupFailure } from '../cloudflare/os-device-authority/src/security/redaction';
import {
  createMemoryDeviceGrantStore,
  DurableStore,
} from '../cloudflare/os-device-authority/src/stores';

const origin = 'https://os.consuelohq.com';
const workerRoot = resolve(
  import.meta.dirname,
  '../cloudflare/os-device-authority',
);

function source(path: string): string {
  return readFileSync(resolve(workerRoot, path), 'utf8');
}

describe('OS device authority architecture', () => {
  it('should deploy the Hono worker entrypoint when Wrangler builds device authority', () => {
    const wrangler = source('wrangler.toml');
    expect(wrangler).toContain('main = "src/worker.ts"');
    expect(wrangler).toContain('class_name = "OsDeviceGrantDurableObject"');
    expect(wrangler).toContain(
      'new_sqlite_classes = ["OsDeviceGrantDurableObject"]',
    );
    expect(source('src/worker.ts')).toContain(
      'export class OsDeviceGrantDurableObject',
    );
    expect(source('src/worker.ts')).toContain("from './app'");
    expect(source('src/app.ts')).toContain("from 'hono'");
  });

  it('should remove the legacy monolithic index when route modules own HTTP surfaces', () => {
    expect(existsSync(resolve(workerRoot, 'src/index.ts'))).toBe(false);
    for (const route of [
      'health',
      'device',
      'google-oauth',
      'web-auth',
      'mcp-oauth',
      'mcp-proxy',
      'workspace-agents',
    ]) {
      expect(
        existsSync(resolve(workerRoot, 'src/routes/' + route + '.ts')),
      ).toBe(true);
    }
  });

  it('should keep method, path, and trust policy explicit when composing Hono routes', () => {
    expect(DEVICE_AUTHORITY_ROUTE_POLICIES).toEqual([
      { method: 'GET', path: '/', trust: 'public' },
      { method: 'ANY', path: '/health', trust: 'public' },
      {
        method: 'ANY',
        path: '/.well-known/oauth-authorization-server',
        trust: 'public',
      },
      {
        method: 'ANY',
        path: '/.well-known/oauth-protected-resource',
        trust: 'public',
      },
      {
        method: 'ANY',
        path: '/.well-known/oauth-protected-resource/mcp',
        trust: 'public',
      },
      { method: 'GET', path: '/oauth/authorize', trust: 'public' },
      { method: 'GET', path: '/oauth/google/callback', trust: 'public' },
      { method: 'POST', path: '/oauth/token', trust: 'oauth' },
      { method: 'POST', path: '/oauth/revoke', trust: 'oauth' },
      { method: 'POST', path: '/oauth/introspect', trust: 'internal' },
      { method: 'ANY', path: '/mcp', trust: 'oauth' },
      { method: 'ANY', path: '/mcp/*', trust: 'oauth' },
      { method: 'GET', path: '/login/device', trust: 'public' },
      { method: 'GET', path: '/login/google/start', trust: 'public' },
      { method: 'GET', path: '/login/google/callback', trust: 'public' },
      { method: 'GET', path: '/auth/workspaces', trust: 'authority-session' },
      { method: 'POST', path: '/auth/handoff', trust: 'authority-session' },
      { method: 'GET', path: '/auth/consume', trust: 'public' },
      { method: 'POST', path: '/auth/logout', trust: 'workspace-session' },
      { method: 'GET', path: '/auth/synthetic/checkout', trust: 'authority-session' },
      { method: 'POST', path: '/auth/synthetic/checkout/start', trust: 'authority-session' },
      { method: 'GET', path: '/auth/synthetic/checkout/result', trust: 'authority-session' },
      { method: 'POST', path: '/webhooks/stripe', trust: 'webhook-signature' },
      { method: 'POST', path: '/webhooks/stripe-synthetic', trust: 'webhook-signature' },
      {
        method: 'POST',
        path: '/internal/auth/session/handoff',
        trust: 'internal',
      },
      {
        method: 'POST',
        path: '/internal/auth/session/validate',
        trust: 'internal',
      },
      { method: 'POST', path: '/login/device/code', trust: 'device-proof' },
      {
        method: 'POST',
        path: '/login/device/workspace',
        trust: 'device-proof',
      },
      { method: 'POST', path: '/login/device/approve', trust: 'internal' },
      {
        method: 'POST',
        path: '/login/oauth/access_token',
        trust: 'device-proof',
      },
      {
        method: 'POST',
        path: '/internal/managed-cloud/provisioning/claim',
        trust: 'internal',
      },
      {
        method: 'POST',
        path: '/internal/managed-cloud/provisioning/state',
        trust: 'internal',
      },
      {
        method: 'POST',
        path: '/managed-cloud/provisioning/enroll',
        trust: 'node-bootstrap',
      },
      { method: 'GET', path: '/workspace/agents', trust: 'public' },
      {
        method: 'POST',
        path: '/workspace/agents',
        trust: 'node-bootstrap',
      },
    ]);
  });

  it.each([
    { name: 'universal login root', method: 'GET', path: '/', status: 200 },
    { name: 'health GET', method: 'GET', path: '/health', status: 200 },
    { name: 'health POST', method: 'POST', path: '/health', status: 200 },
    {
      name: 'authorization metadata',
      method: 'GET',
      path: '/.well-known/oauth-authorization-server',
      status: 200,
    },
    {
      name: 'resource metadata',
      method: 'GET',
      path: '/.well-known/oauth-protected-resource',
      status: 200,
    },
    {
      name: 'authorization method guard',
      method: 'POST',
      path: '/oauth/authorize',
      status: 405,
      allow: 'GET',
      body: 'Method not allowed\n',
    },
    {
      name: 'token method guard',
      method: 'GET',
      path: '/oauth/token',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'introspection method guard',
      method: 'GET',
      path: '/oauth/introspect',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'revocation method guard',
      method: 'GET',
      path: '/oauth/revoke',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    { name: 'device page', method: 'GET', path: '/login/device', status: 200 },
    {
      name: 'device page method fallback',
      method: 'POST',
      path: '/login/device',
      status: 404,
      body: 'Not found\n',
    },
    {
      name: 'Google start method guard',
      method: 'POST',
      path: '/login/google/start',
      status: 405,
      allow: 'GET',
      body: 'Method not allowed\n',
    },
    {
      name: 'Google callback method guard',
      method: 'POST',
      path: '/login/google/callback',
      status: 405,
      allow: 'GET',
      body: 'Method not allowed\n',
    },
    {
      name: 'device code method guard',
      method: 'GET',
      path: '/login/device/code',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'workspace selection method guard',
      method: 'GET',
      path: '/login/device/workspace',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'approval method guard',
      method: 'GET',
      path: '/login/device/approve',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'device token method guard',
      method: 'GET',
      path: '/login/oauth/access_token',
      status: 405,
      allow: 'POST',
      body: 'Method not allowed\n',
    },
    {
      name: 'unknown route',
      method: 'GET',
      path: '/unknown',
      status: 404,
      body: 'Not found\n',
    },
  ])(
    'should preserve $name route behavior after Hono composition',
    async (testCase) => {
      const handler = createOsDeviceAuthorityHandler({
        store: createMemoryDeviceGrantStore(),
        origin,
      });
      const response = await handler(
        new Request(origin + testCase.path, { method: testCase.method }),
      );

      expect(response.status).toBe(testCase.status);
      expect(response.headers.get('allow')).toBe(testCase.allow ?? null);
      if (testCase.body)
        await expect(response.text()).resolves.toBe(testCase.body);
    },
  );

  it.each(['/mcp', '/mcp/tools'])(
    'should preserve OAuth challenge headers for protected MCP path %s',
    async (path) => {
      const handler = createOsDeviceAuthorityHandler({
        store: createMemoryDeviceGrantStore(),
        origin,
      });
      const response = await handler(new Request(origin + path));

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer resource_metadata="' +
          origin +
          '/.well-known/oauth-protected-resource"',
      );
      await expect(response.json()).resolves.toMatchObject({
        error: 'unauthorized',
      });
    },
  );

  it('should preserve Durable Object storage key prefixes when state is extracted', async () => {
    const keys: string[] = [];
    const storage = {
      async get<T>() {
        return undefined as T | undefined;
      },
      async put<T>(key: string, _value: T) {
        keys.push(key);
      },
      async delete() {
        return true;
      },
    };
    const store = new DurableStore(storage);
    await store.put({
      hash: 'grant-hash',
      userCode: 'ABCD-EFGH',
      status: 'pending',
      expiresAt: 1,
      interval: 5,
      devicePublicKeyJwk: '{}',
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: 'dpk-test',
    });
    await store.putOAuthState({
      state: 'state',
      userCode: 'ABCD-EFGH',
      expiresAt: 1,
    });
    await store.putMcpOAuthState({
      state: 'mcp-state',
      clientId: 'client',
      redirectUri: 'https://chatgpt.com/connector/oauth/callback',
      requestedState: '',
      scope: '',
      scopes: [],
      resource: origin + '/mcp',
      workspaceHost: 'workspace.consuelohq.com',
      codeChallenge: 'challenge',
      expiresAt: 1,
    });
    await store.putAccountWorkspace({
      accountId: 'account',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      updatedAt: 1,
    });
    await store.putWorkspaceNode({
      accountId: 'account',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      nodeId: 'node',
      nodeName: 'node',
      role: 'home',
      devicePublicKeyThumbprint: 'dpk-test',
      createdAt: 1,
      updatedAt: 1,
    });

    expect(keys).toEqual([
      'd:grant-hash',
      'u:ABCDEFGH',
      's:state',
      'mos:mcp-state',
      'aw:account',
      'wn:account:node',
      'wni:node',
      'wnl:account',
      'wnh:workspace.consuelohq.com',
    ]);
  });

  it('should redact bearer and query credentials when provisioning fails', () => {
    const message = redactWorkspaceRouteSetupFailure(
      new Error(
        [
          'Authorization: Bearer header-secret',
          'Bearer standalone-secret',
          'CLOUDFLARE_API_TOKEN=cloudflare-secret',
          'workspace Cloudflare provisioning failed: Cloudflare API listCloudflareTunnels failed with status 403 api token=operation-secret',
          'https://example.test/?access_token=query-secret&state=state-secret',
        ].join('\n'),
      ),
    );

    expect(message).not.toMatch(
      /header-secret|standalone-secret|cloudflare-secret|operation-secret|query-secret|state-secret/,
    );
    expect(message).toContain('[redacted]');
    expect(message).toContain('listCloudflareTunnels failed with status 403');
  });
});
