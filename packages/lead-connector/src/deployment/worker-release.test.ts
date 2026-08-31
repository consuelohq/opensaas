import { createHash } from 'node:crypto';
import { describe, expect, it } from 'bun:test';

import {
  parseWranglerDeploymentOutput,
  verifyLeadConnectorProductionEdge,
} from './worker-release';

describe('LeadConnector production worker release', () => {
  it('extracts one deploy version from Wrangler structured output', () => {
    expect(
      parseWranglerDeploymentOutput(
        [
          JSON.stringify({ type: 'wrangler-session', version: 1 }),
          JSON.stringify({
            type: 'deploy',
            version: 1,
            worker_name: 'consuelo-lead-connector-embed',
            version_id: 'worker-v1',
            targets: ['https://calls.consuelohq.com'],
          }),
        ].join('\n'),
      ),
    ).toEqual({
      workerName: 'consuelo-lead-connector-embed',
      versionId: 'worker-v1',
      targets: ['https://calls.consuelohq.com'],
    });
  });

  it('verifies shells, proxy health, CSP, and exact launcher asset hashes', async () => {
    const javascript = 'window.__consueloLauncher = true;\n';
    const css = '#launcher{}\n';
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const fetcher = async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/health') {
        return new Response(
          JSON.stringify({ service: 'dialer-server', status: 'ok' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      if (path.endsWith('.js'))
        return new Response(javascript, { status: 200 });
      if (path.endsWith('.css')) return new Response(css, { status: 200 });
      return new Response('<html>dialer</html>', {
        status: 200,
        headers: {
          'cache-control': 'no-store',
          'content-security-policy':
            "default-src 'self'; frame-ancestors https://app.leadconnectorhq.com",
          'permissions-policy': 'microphone=(self)',
        },
      });
    };

    const result = await verifyLeadConnectorProductionEdge(
      {
        baseUrl: 'https://calls.consuelohq.com',
        javascriptSha256: hash(javascript),
        cssSha256: hash(css),
      },
      fetcher,
    );

    expect(result.ok).toBe(true);
    expect(result.routes).toHaveLength(4);
    expect(result.javascriptSha256).toBe(hash(javascript));
    expect(result.cssSha256).toBe(hash(css));
  });
});
