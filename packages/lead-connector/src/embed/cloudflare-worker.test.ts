import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createLeadConnectorEdgeWorker } from './cloudflare-worker';

const expectTwilioVoiceConnectivity = (response: Response): void => {
  const policy = response.headers.get('content-security-policy');
  expect(policy).toContain(
    "connect-src 'self' https://*.twilio.com wss://*.twilio.com",
  );
};

const createEnvironment = () => {
  const originRequests: Request[] = [];
  const assetRequests: Request[] = [];
  return {
    originRequests,
    assetRequests,
    environment: {
      DIALER_SERVER_ORIGIN: 'https://dialer-origin.example.test',
      DIALER_EDGE_PROXY_SECRET: 'edge-proxy-secret-for-tests-0001',
      ASSETS: {
        fetch: async (request: Request) => {
          assetRequests.push(request);
          return new Response('<html>embed</html>', {
            headers: { 'content-type': 'text/html' },
          });
        },
      },
      fetchOrigin: async (request: Request) => {
        originRequests.push(request);
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  };
};

describe('LeadConnector Cloudflare embed edge', () => {
  it('deploys the browser application build rather than TypeScript library output', () => {
    const config = readFileSync(
      resolve(import.meta.dir, '../../wrangler.jsonc'),
      'utf8',
    );
    expect(config).toContain('"directory": "./dist/embed-app"');
    expect(config).toContain('"run_worker_first": true');
    expect(config).not.toContain('"directory": "./dist/embed"');
  });

  it('proxies only dialer API, OAuth, webhook, and health paths to Railway', async () => {
    const fixture = createEnvironment();
    const worker = createLeadConnectorEdgeWorker(
      fixture.environment.fetchOrigin,
    );
    const response = await worker.fetch(
      new Request('https://dialer.example.test/v1/call-sessions?view=full', {
        method: 'POST',
        headers: { authorization: 'Bearer scoped-session' },
        body: JSON.stringify({ source: 'direct' }),
      }),
      fixture.environment,
    );

    expect(response.status).toBe(201);
    expect(fixture.originRequests).toHaveLength(1);
    expect(fixture.originRequests[0]?.url).toBe(
      'https://dialer-origin.example.test/v1/call-sessions?view=full',
    );
    expect(fixture.assetRequests).toHaveLength(0);
  });

  it('replaces forged client identity with a signed Cloudflare-observed identity for public customer APIs', async () => {
    const fixture = createEnvironment();
    const worker = createLeadConnectorEdgeWorker(
      fixture.environment.fetchOrigin,
      () => 1_789_742_400_000,
    );
    const response = await worker.fetch(
      new Request('https://dialer.example.test/v1/inbound/customer/sales/callbacks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.44',
          'x-consuelo-edge-client-address': '198.51.100.99',
          'x-consuelo-edge-client-timestamp': '1',
          'x-consuelo-edge-client-signature': 'forged',
        },
        body: '{}',
      }),
      fixture.environment,
    );

    expect(response.status).toBe(201);
    const proxied = fixture.originRequests[0]!;
    expect(proxied.headers.get('x-consuelo-edge-client-address')).toBe(
      '203.0.113.44',
    );
    expect(proxied.headers.get('x-consuelo-edge-client-timestamp')).toBe(
      '1789742400000',
    );
    expect(proxied.headers.get('x-consuelo-edge-client-signature')).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(proxied.headers.get('x-consuelo-edge-client-signature')).not.toBe(
      'forged',
    );
    expect(proxied.method).toBe('POST');
    expect(await proxied.text()).toBe('{}');
  });

  it('fails closed before origin proxying when trusted customer attribution is unavailable', async () => {
    const fixture = createEnvironment();
    fixture.environment.DIALER_EDGE_PROXY_SECRET = '';
    const worker = createLeadConnectorEdgeWorker(fixture.environment.fetchOrigin);
    const response = await worker.fetch(
      new Request('https://dialer.example.test/v1/inbound/customer/sales/callbacks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.44',
        },
        body: '{}',
      }),
      fixture.environment,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'EDGE_PROXY_UNAVAILABLE',
        message: 'Customer callback service is temporarily unavailable',
        retryable: true,
      },
    });
    expect(fixture.originRequests).toHaveLength(0);
  });

  it('serves root, admin, and overlay browser routes through the same iframe-safe application shell', async () => {
    for (const pathname of ['/', '/admin', '/overlay']) {
      const fixture = createEnvironment();
      const worker = createLeadConnectorEdgeWorker(
        fixture.environment.fetchOrigin,
      );
      const response = await worker.fetch(
        new Request(`https://dialer.example.test${pathname}`),
        fixture.environment,
      );

      expect(response.status).toBe(200);
      expect(fixture.originRequests).toHaveLength(0);
      expect(fixture.assetRequests).toHaveLength(1);
      const shellRequest = new URL(fixture.assetRequests[0]!.url);
      expect(shellRequest.pathname).toBe('/');
      expect(shellRequest.searchParams.get('__shell')).toBeTruthy();
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-frame-options')).toBeNull();
      expect(response.headers.get('content-security-policy')).toContain(
        'frame-ancestors https://app.leadconnectorhq.com https://app.msgsndr.com https://app.gohighlevel.com',
      );
      expect(response.headers.get('permissions-policy')).toContain(
        'microphone',
      );
      expectTwilioVoiceConnectivity(response);
    }
  });

  it('serves public customer routes through a non-iframe, non-voice application shell', async () => {
    const fixture = createEnvironment();
    const worker = createLeadConnectorEdgeWorker(
      fixture.environment.fetchOrigin,
    );
    const response = await worker.fetch(
      new Request('https://dialer.example.test/call/sales'),
      fixture.environment,
    );

    expect(response.status).toBe(200);
    expect(fixture.originRequests).toHaveLength(0);
    expect(fixture.assetRequests).toHaveLength(1);
    const shellRequest = new URL(fixture.assetRequests[0]!.url);
    expect(shellRequest.pathname).toBe('/');
    expect(shellRequest.searchParams.get('__shell')).toBeTruthy();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get('content-security-policy')).not.toContain(
      'wss://*.twilio.com',
    );
    expect(response.headers.get('permissions-policy')).toContain(
      'microphone=()',
    );
  });

  it('serves other static assets without rewriting them to the application shell', async () => {
    const fixture = createEnvironment();
    const worker = createLeadConnectorEdgeWorker(
      fixture.environment.fetchOrigin,
    );
    const response = await worker.fetch(
      new Request('https://dialer.example.test/embed/'),
      fixture.environment,
    );

    expect(response.status).toBe(200);
    expect(fixture.originRequests).toHaveLength(0);
    expect(fixture.assetRequests).toHaveLength(1);
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('content-security-policy')).toContain(
      'frame-ancestors https://app.leadconnectorhq.com https://app.msgsndr.com https://app.gohighlevel.com',
    );
    expect(response.headers.get('permissions-policy')).toContain('microphone');
    expectTwilioVoiceConnectivity(response);
  });

  it('forces the stable marketplace launcher assets to revalidate', async () => {
    for (const pathname of [
      '/consuelo-lead-connector-click-to-call.js',
      '/consuelo-lead-connector-click-to-call.css',
    ]) {
      const fixture = createEnvironment();
      const worker = createLeadConnectorEdgeWorker(
        fixture.environment.fetchOrigin,
      );
      const response = await worker.fetch(
        new Request(`https://dialer.example.test${pathname}`),
        fixture.environment,
      );
      expect(response.headers.get('cache-control')).toBe(
        'no-cache, max-age=0, must-revalidate',
      );
    }
  });
});
