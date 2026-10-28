import { describe, expect, it } from 'vitest';

import { createWorkspaceConnectorProvisionerFromEnv } from '../cloudflare/os-device-authority/src/services/connectors';
import type { Env } from '../cloudflare/os-device-authority/src/types';

describe('OS device authority connector provisioning', () => {
  it('returns and persists the canonical opaque connector origin', async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (request, init) => {
      const url = String(request);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) as unknown : undefined;
      calls.push({ method, url, ...(body ? { body } : {}) });

      if (url.includes('/accounts/account_123/cfd_tunnel?name=')) {
        return new Response(JSON.stringify({ success: true, result: [] }));
      }
      if (url.endsWith('/accounts/account_123/cfd_tunnel') && method === 'POST') {
        return new Response(JSON.stringify({ success: true, result: { id: 'tunnel_123' } }));
      }
      if (url.endsWith('/accounts/account_123/cfd_tunnel/tunnel_123/token')) {
        return new Response(JSON.stringify({ success: true, result: 'tunnel_token_123' }));
      }
      if (
        url.endsWith('/accounts/account_123/cfd_tunnel/tunnel_123/configurations') &&
        method === 'PUT'
      ) {
        return new Response(JSON.stringify({ success: true, result: {} }));
      }
      if (url.endsWith('/zones/zone_123/workers/routes') && method === 'GET') {
        return new Response(JSON.stringify({ success: true, result: [] }));
      }
      if (url.endsWith('/zones/zone_123/workers/routes') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'worker_route_123',
              pattern: 'c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com/*',
              script: null,
            },
          }),
        );
      }
      if (url.includes('/zones/zone_123/dns_records?type=CNAME&')) {
        return new Response(JSON.stringify({ success: true, result: [] }));
      }
      if (url.endsWith('/zones/zone_123/dns_records') && method === 'POST') {
        return new Response(
          JSON.stringify({ success: true, result: { id: `record_${calls.length}` } }),
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: `unexpected ${method} ${url}` }],
        }),
        { status: 500 },
      );
    };
    const env = {
      DEVICE_GRANTS: {} as Env['DEVICE_GRANTS'],
      CLOUDFLARE_ACCOUNT_ID: 'account_123',
      CLOUDFLARE_ZONE_ID: 'zone_123',
      CLOUDFLARE_API_TOKEN: 'api_token_123',
      OS_DEVICE_AUTH_BASE_DOMAIN: 'consuelohq.com',
      OS_DEVICE_AUTH_CLOUDFLARE_API_BASE_URL: 'https://api.cloudflare.test/client/v4',
      OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL: 'http://127.0.0.1:46320',
    } satisfies Env;
    const provision = createWorkspaceConnectorProvisionerFromEnv(env, fetchImpl);

    expect(provision).toBeDefined();
    const result = await provision!({
      workspaceId: 'workspace_testing45_78',
      workspaceSlug: 'testing45-78',
      workspaceHost: 'testing45-78.consuelohq.com',
      connectorId: 'connector_123',
    });

    expect(result).toEqual({
      connectorId: 'connector_123',
      cloudflareTunnelToken: 'tunnel_token_123',
      tunnelOriginUrl:
        'https://c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
      localServiceUrl: 'http://127.0.0.1:46320',
    });
    expect(calls[3]?.body).toEqual({
      config: {
        ingress: [
          {
            hostname: 'c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
            service: 'http://127.0.0.1:46320',
            originRequest: {
              httpHostHeader: 'testing45-78.consuelohq.com',
            },
          },
          { service: 'http_status:404' },
        ],
      },
    });
    expect(calls[5]?.body).toEqual({
      pattern: 'c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com/*',
    });
    expect(calls[9]?.body).toMatchObject({
      name: 'c-ad94b888d3062f30e27d571fdeb3d6f4.consuelohq.com',
      content: 'tunnel_123.cfargotunnel.com',
      proxied: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/testing45|workspace_testing45_78/);
  });
});
