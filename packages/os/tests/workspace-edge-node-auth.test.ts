import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createGatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import {
  createWorkspaceEdgeNodeHeaders,
  deriveWorkspaceEdgeNodeSecret,
  hasAnyWorkspaceEdgeNodeHeaders,
} from '../scripts/lib/workspace-edge-node-auth';
import { authorizeSignedRequest } from '../scripts/server/middleware/auth';

const originalAuthConfig = process.env.CONSUELO_OS_AUTH_CONFIG;
const tempHomes: string[] = [];

afterEach(() => {
  if (originalAuthConfig === undefined) delete process.env.CONSUELO_OS_AUTH_CONFIG;
  else process.env.CONSUELO_OS_AUTH_CONFIG = originalAuthConfig;
  for (const home of tempHomes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

function authFixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-edge-node-auth-'));
  tempHomes.push(home);
  const identity = {
    workspaceId: 'workspace_acme',
    nodeId: 'node_primary',
    connectorId: 'connector_primary',
  };
  const signingSecret = deriveWorkspaceEdgeNodeSecret({
    masterSecret: 'edge-authority-master-secret',
    ...identity,
  });
  const config = createGatewaySecurityConfig({
    home,
    workspaceId: identity.workspaceId,
    workspaceSlug: 'acme',
    workspaceHost: 'acme.consuelohq.com',
    edgeProxy: { ...identity, signingSecret },
  });
  process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;
  return { home, identity, signingSecret };
}

function requestFor(input: {
  signingSecret: string;
  workspaceId?: string;
  nodeId?: string;
  connectorId?: string;
  method?: string;
  path?: string;
  body?: string;
  timestamp?: string;
  nonce?: string;
}) {
  const method = input.method ?? 'GET';
  const requestPath = input.path ?? '/gateway/traces/recent?cursor=latest';
  const body = input.body ?? '';
  const headers = createWorkspaceEdgeNodeHeaders({
    signingSecret: input.signingSecret,
    workspaceId: input.workspaceId ?? 'workspace_acme',
    nodeId: input.nodeId ?? 'node_primary',
    connectorId: input.connectorId ?? 'connector_primary',
    surface: 'sites',
    method,
    pathWithSearch: requestPath,
    body,
    timestamp: input.timestamp ?? String(Date.parse('2026-08-06T00:00:00.000Z')),
    nonce: input.nonce ?? 'edge-node-auth-nonce-001',
  });
  return new Request('https://connector.example' + requestPath, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body }),
  });
}

describe('workspace edge node authentication', () => {
  it('selects node-scoped auth only when the protocol version header is present', () => {
    expect(hasAnyWorkspaceEdgeNodeHeaders({
      'x-consuelo-edge-signature': 'sha256=legacy',
      'x-consuelo-edge-timestamp': '1800000000000',
      'x-consuelo-edge-nonce': 'legacy-nonce',
    })).toBe(false);
    expect(hasAnyWorkspaceEdgeNodeHeaders({
      'x-consuelo-edge-auth-version': 'consuelo-edge-node-v1',
    })).toBe(true);
  });

  it('binds the local device identity to the signed node identity', async () => {
    const { signingSecret } = authFixture();
    const request = requestFor({
      signingSecret,
      nonce: 'edge-node-auth-device-binding',
    });
    expect(request.headers.get('x-consuelo-device-id')).toBe('node_primary');

    const headers = new Headers(request.headers);
    headers.set('x-consuelo-device-id', 'node_other');
    const denied = await authorizeSignedRequest({
      request: new Request(request.url, { headers }),
      path: '/gateway/traces/recent?cursor=latest',
      body: '',
      requiredScope: 'os:traces:read',
      now: new Date('2026-08-06T00:00:05.000Z'),
    });
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toMatchObject({ error: { code: 'NODE_MISMATCH' } });
  });

  it('derives isolated node secrets from the platform master secret', () => {
    const base = deriveWorkspaceEdgeNodeSecret({
      masterSecret: 'master-secret',
      workspaceId: 'workspace_acme',
      nodeId: 'node_primary',
      connectorId: 'connector_primary',
    });
    expect(base).toMatch(/^wen_[A-Za-z0-9_-]{43}$/);
    expect(deriveWorkspaceEdgeNodeSecret({
      masterSecret: 'master-secret',
      workspaceId: 'workspace_other',
      nodeId: 'node_primary',
      connectorId: 'connector_primary',
    })).not.toBe(base);
    expect(deriveWorkspaceEdgeNodeSecret({
      masterSecret: 'master-secret',
      workspaceId: 'workspace_acme',
      nodeId: 'node_secondary',
      connectorId: 'connector_secondary',
    })).not.toBe(base);
  });

  it('accepts a fresh edge request whose identity, path, and body are signed', async () => {
    const { signingSecret } = authFixture();
    const body = JSON.stringify({ name: 'production' });
    const request = requestFor({
      signingSecret,
      method: 'POST',
      path: '/gateway/environments/upsert?source=web',
      body,
      nonce: 'edge-node-auth-nonce-accept',
    });

    await expect(authorizeSignedRequest({
      request,
      path: '/gateway/environments/upsert?source=web',
      body,
      requiredScope: 'os:settings:write',
      now: new Date('2026-08-06T00:00:05.000Z'),
    })).resolves.toBeNull();
  });

  it.each([
    ['body', { body: '{"name":"tampered"}' }, 'EDGE_BODY_MISMATCH'],
    ['workspace', { workspaceId: 'workspace_other' }, 'WORKSPACE_MISMATCH'],
    ['node', { nodeId: 'node_other' }, 'NODE_MISMATCH'],
    ['connector', { connectorId: 'connector_other' }, 'CONNECTOR_MISMATCH'],
  ] as const)('rejects a signed request with mismatched %s identity', async (_label, override, code) => {
    const { signingSecret } = authFixture();
    const signedBody = JSON.stringify({ name: 'production' });
    const request = requestFor({
      signingSecret,
      method: 'POST',
      path: '/gateway/environments/upsert',
      body: signedBody,
      nonce: 'edge-node-auth-nonce-mismatch-' + _label,
      ...override,
    });
    const actualBody = _label === 'body' ? signedBody : signedBody;
    const verifiedBody = _label === 'body' ? '{"name":"tampered-after-signing"}' : actualBody;
    const response = await authorizeSignedRequest({
      request,
      path: '/gateway/environments/upsert',
      body: verifiedBody,
      requiredScope: 'os:settings:write',
      now: new Date('2026-08-06T00:00:05.000Z'),
    });
    expect(response?.status).toBe(_label === 'body' ? 401 : 403);
    await expect(response?.json()).resolves.toMatchObject({ error: { code } });
  });

  it('rejects expired and replayed edge requests', async () => {
    const { signingSecret } = authFixture();
    const expired = requestFor({
      signingSecret,
      timestamp: String(Date.parse('2026-08-05T23:50:00.000Z')),
      nonce: 'edge-node-auth-nonce-expired',
    });
    const expiredResponse = await authorizeSignedRequest({
      request: expired,
      path: '/gateway/traces/recent?cursor=latest',
      body: '',
      requiredScope: 'os:traces:read',
      now: new Date('2026-08-06T00:00:05.000Z'),
    });
    expect(expiredResponse?.status).toBe(401);
    await expect(expiredResponse?.json()).resolves.toMatchObject({
      error: { code: 'EDGE_SIGNATURE_EXPIRED' },
    });

    const replayed = requestFor({
      signingSecret,
      nonce: 'edge-node-auth-nonce-replay',
    });
    await expect(authorizeSignedRequest({
      request: replayed.clone(),
      path: '/gateway/traces/recent?cursor=latest',
      body: '',
      requiredScope: 'os:traces:read',
      now: new Date('2026-08-06T00:00:05.000Z'),
    })).resolves.toBeNull();
    const replayResponse = await authorizeSignedRequest({
      request: replayed,
      path: '/gateway/traces/recent?cursor=latest',
      body: '',
      requiredScope: 'os:traces:read',
      now: new Date('2026-08-06T00:00:06.000Z'),
    });
    expect(replayResponse?.status).toBe(401);
    await expect(replayResponse?.json()).resolves.toMatchObject({
      error: { code: 'EDGE_NONCE_REPLAY' },
    });
  });

  it('does not expose the node signing secret through the public auth config', () => {
    const { signingSecret } = authFixture();
    const authPath = process.env.CONSUELO_OS_AUTH_CONFIG!;
    const publicConfig = createGatewaySecurityConfig({
      home: path.dirname(path.dirname(path.dirname(authPath))),
      workspaceId: 'workspace_acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    expect(JSON.stringify(publicConfig)).not.toContain(signingSecret);
  });
});
