import { describe, expect, it } from 'bun:test';

import {
  buildDialerReleaseManifest,
  parseRailwayDeploymentList,
  rollbackRailwayDeployment,
  runDialerProductionSmoke,
  selectNewRailwayDeployment,
} from './production-release';

describe('dialer production release safety', () => {
  it('selects the new Railway deployment instead of racing the previous latest', () => {
    const deployments = parseRailwayDeploymentList(
      JSON.stringify([
        { id: 'new-deployment', status: 'DEPLOYING' },
        { id: 'previous-deployment', status: 'SUCCESS' },
      ]),
    );
    expect(selectNewRailwayDeployment(deployments, 'previous-deployment')).toEqual({
      id: 'new-deployment',
      status: 'DEPLOYING',
    });
    expect(selectNewRailwayDeployment(deployments, 'new-deployment')).toEqual({
      id: 'previous-deployment',
      status: 'SUCCESS',
    });
  });

  it('smokes only non-mutating health/auth/signature boundaries', async () => {
    const requests: Array<{ path: string; method: string; authorization: string | null }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      requests.push({
        path: url.pathname,
        method,
        authorization: new Headers(init?.headers).get('authorization'),
      });
      const expected = new Map<string, number>([
        ['GET /health', 200],
        ['GET /v1/commercial/admin', 401],
        ['GET /v1/commercial/caller', 401],
        ['POST /webhooks/twilio/status', 401],
        ['POST /v1/webhooks/stripe', 401],
        ['POST /v1/webhooks/leadconnector', 401],
      ]);
      return new Response('{}', { status: expected.get(`${method} ${url.pathname}`) ?? 599 });
    };

    const result = await runDialerProductionSmoke(
      { baseUrl: 'https://calls.consuelohq.com' },
      fetcher,
    );

    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(6);
    expect(requests.every(({ authorization }) => authorization === null)).toBe(true);
    expect(requests.map(({ path }) => path)).not.toContain(
      '/v1/commercial/billing/checkout',
    );
    expect(requests.map(({ path }) => path).join(' ')).not.toMatch(
      /provision|release|call-sessions|recording|transcription/,
    );
  });

  it('builds a secret-free release manifest from immutable deployment evidence', () => {
    const manifest = buildDialerReleaseManifest({
      gitSha: 'abc123',
      railway: { deploymentId: 'railway-1', status: 'SUCCESS' },
      cloudflare: { versionId: 'worker-v1', buildMarker: 'build-v1' },
      assets: { javascriptSha256: 'js-hash', cssSha256: 'css-hash' },
      customMenu: { customMenuId: 'menu-1', readBackVerified: true },
      smoke: { ok: true, checks: [] },
    });

    expect(manifest.gitSha).toBe('abc123');
    expect(JSON.stringify(manifest)).not.toMatch(/token|secret|password|authorization/i);
  });

  it('refuses to serialize a release manifest from non-green evidence', () => {
    expect(() =>
      buildDialerReleaseManifest({
        gitSha: 'abc123',
        railway: { deploymentId: 'railway-1', status: 'FAILED' },
        cloudflare: { versionId: 'worker-v1', buildMarker: 'build-v1' },
        assets: { javascriptSha256: 'js-hash', cssSha256: 'css-hash' },
        customMenu: { customMenuId: 'menu-1', readBackVerified: true },
        smoke: { ok: true, checks: [] },
      }),
    ).toThrow('successful Railway deployment');
  });

  it('rolls Railway back to one explicit deployment id through the public API', async () => {
    const calls: Array<{ url: string; body: unknown; auth: string | null }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        auth: new Headers(init?.headers).get('project-access-token'),
      });
      return new Response(JSON.stringify({ data: { deploymentRollback: { id: 'new-deploy' } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await rollbackRailwayDeployment(
      { projectToken: 'railway-token', deploymentId: 'known-good-deployment' },
      fetcher,
    );

    expect(result).toEqual({ deploymentId: 'new-deploy' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://backboard.railway.com/graphql/v2');
    expect(calls[0]?.auth).toBe('railway-token');
    expect(calls[0]?.body).toEqual({
      query:
        'mutation deploymentRollback($id: String!) { deploymentRollback(id: $id) { id } }',
      variables: { id: 'known-good-deployment' },
    });
  });
});
