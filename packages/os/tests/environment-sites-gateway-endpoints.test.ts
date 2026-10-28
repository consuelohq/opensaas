import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createEnvironmentSitesGatewayEndpoints,
  environmentGatewayScopeFromHeaders,
} from '../scripts/lib/environment-sites-gateway-endpoints';

function request(pathname: string, init: RequestInit = {}, capabilities = 'environments-read,environments-write'): Request {
  return new Request(`https://testing.consuelohq.com${pathname}`, {
    ...init,
    headers: {
      'x-consuelo-user-id': 'usr_environments',
      'x-consuelo-workspace-id': 'wrk_environments',
      'x-consuelo-workspace-host': 'testing.consuelohq.com',
      'x-consuelo-allowed-sites': 'environments',
      'x-consuelo-capabilities': capabilities,
      'x-consuelo-source-modes': 'local-networked,cloud-compute,local-off-network',
      ...(init.headers ?? {}),
    },
  });
}

describe('Environment Sites gateway endpoints', () => {
  it('serves and mutates workspace-scoped environments through authorized routes', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-sites-gateway-'));
    const endpoints = createEnvironmentSitesGatewayEndpoints({ home, resolveScope: environmentGatewayScopeFromHeaders });

    const createResponse = await endpoints.handle(request('/gateway/environments/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Production', scope: { kind: 'workspace' }, metadata: { REGION: 'iad1' } }),
    }));
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json() as { environment: { environmentId: string } };

    const listResponse = await endpoints.handle(request('/gateway/environments/snapshot'));
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: '/gateway/environments/snapshot',
      workspace: { workspaceId: 'wrk_environments', workspaceHost: 'testing.consuelohq.com' },
      snapshot: { environments: [{ environmentId: created.environment.environmentId, name: 'Production' }] },
    });
  });

  it('fails closed for missing site scope and write capability', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environment-sites-gateway-'));
    const endpoints = createEnvironmentSitesGatewayEndpoints({ home, resolveScope: environmentGatewayScopeFromHeaders });

    const noScope = await endpoints.handle(new Request('https://testing.consuelohq.com/gateway/environments/snapshot'));
    expect(noScope.status).toBe(403);

    const noWrite = await endpoints.handle(request('/gateway/environments/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Denied', scope: { kind: 'workspace' } }),
    }, 'environments-read'));
    expect(noWrite.status).toBe(403);
    await expect(noWrite.json()).resolves.toMatchObject({ error: { code: 'CAPABILITY_SCOPE_DENIED' } });
  });
});
