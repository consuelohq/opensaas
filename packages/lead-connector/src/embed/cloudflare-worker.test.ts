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
