import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import {
  WEB_SECURITY_ROUTE_MATRIX,
  assertWebSecurityRouteMatrix,
} from '../cloudflare/web-security-route-matrix';
import {
  buildCloudflareAcceptanceNames,
  cleanupCloudflareAcceptance,
  createCloudflareAcceptanceInventory,
  provisionCloudflareAcceptance,
  renderCloudflareAcceptanceWranglerConfigs,
  verifyCloudflareAcceptance,
  type CloudflareAcceptanceClient,
} from '../scripts/testing/web-security/cloudflare-acceptance';

const REQUIRED_SURFACES = [
  'health',
  'oauth-metadata',
  'device-code',
  'google-login',
  'google-callback',
  'mcp-authorization',
  'mcp-oauth',
  'mcp-introspection',
  'central-mcp',
  'workspace-chooser',
  'handoff',
  'logout',
  'launcher',
  'gtm',
  'traces',
  'trace-feed',
  'connector-origin',
  'route-not-found',
  'unsupported-method',
] as const;

const packageRoot = existsSync(join(process.cwd(), 'tests'))
  ? process.cwd()
  : join(process.cwd(), 'packages', 'os');

describe('web security release acceptance', () => {
  it('locks one complete executable route/security matrix', () => {
    expect(() =>
      assertWebSecurityRouteMatrix(WEB_SECURITY_ROUTE_MATRIX),
    ).not.toThrow();
    expect(
      new Set(WEB_SECURITY_ROUTE_MATRIX.map((row) => row.surface)),
    ).toEqual(new Set(REQUIRED_SURFACES));
    for (const row of WEB_SECURITY_ROUTE_MATRIX) {
      expect(row.method).toMatch(/^(GET|POST|PATCH|DELETE|ALL)$/);
      expect(row.path).toMatch(/^\//);
      expect(row.authClass.length).toBeGreaterThan(0);
      expect(row.status.success).toBeGreaterThanOrEqual(200);
      expect(row.status.success).toBeLessThan(600);
      expect(row.headers.length).toBeGreaterThan(0);
      expect(row.storage.length).toBeGreaterThan(0);
      expect(row.destination.length).toBeGreaterThan(0);
      expect(row.evidence.length).toBeGreaterThan(0);
      for (const evidencePath of row.evidence) {
        expect(existsSync(join(packageRoot, evidencePath))).toBe(true);
      }
    }
  });

  it('keeps public metadata outside the protected MCP WAF class and connector origins private', () => {
    const metadata = WEB_SECURITY_ROUTE_MATRIX.find(
      (row) => row.surface === 'oauth-metadata',
    );
    const centralMcp = WEB_SECURITY_ROUTE_MATRIX.find(
      (row) => row.surface === 'central-mcp',
    );
    const connector = WEB_SECURITY_ROUTE_MATRIX.find(
      (row) => row.surface === 'connector-origin',
    );

    expect(metadata).toMatchObject({
      authClass: 'public-metadata',
      wafClass: 'public-metadata',
      destination: 'device-authority',
    });
    expect(centralMcp).toMatchObject({
      authClass: 'oauth-bearer',
      wafClass: 'managed-mcp-provider-only',
      destination: 'workspace-connector-private-tunnel',
    });
    expect(connector).toMatchObject({
      authClass: 'signed-edge-hmac',
      wafClass: 'connector-origin-private',
      destination: 'local-node-loopback',
    });
    expect(
      WEB_SECURITY_ROUTE_MATRIX.filter(
        (row) => row.wafClass === 'managed-mcp-provider-only',
      ).every((row) => row.path.startsWith('/mcp')),
    ).toBe(true);
  });

  it('uses exact run-owned Cloudflare names and never deletes unknown resources', async () => {
    const names = buildCloudflareAcceptanceNames('1662');
    expect(names).toEqual({
      runId: '1662',
      workerName: 'consuelo-os-dist-test-1662',
      edgeWorkerName: 'consuelo-os-dist-test-1662-edge',
      d1Name: 'consuelo-os-dist-test-1662',
      r2BucketName: 'consuelo-os-dist-test-1662',
      r2Prefix: 'consuelo-os-dist-test/1662/',
      hostname: 'os-dist-1662.consuelohq.com',
      edgeHostname: 'workspace-dist-1662.consuelohq.com',
    });

    const calls: string[] = [];
    const client: CloudflareAcceptanceClient = {
      async createD1(name) {
        calls.push(`create-d1:${name}`);
        return { id: 'd1-current', name };
      },
      async createR2Bucket(name) {
        calls.push(`create-r2:${name}`);
      },
      async listResources() {
        return {
          workers: [
            names.workerName,
            names.edgeWorkerName,
            'consuelo-os-dist-test-older',
          ],
          d1: [
            { id: 'd1-current', name: names.d1Name },
            { id: 'd1-older', name: 'consuelo-os-dist-test-older' },
          ],
          r2Buckets: [names.r2BucketName, 'consuelo-os-dist-test-older'],
        };
      },
      async deleteWorker(name) {
        calls.push(`delete-worker:${name}`);
      },
      async deleteD1(id) {
        calls.push(`delete-d1:${id}`);
      },
      async deleteR2Bucket(name) {
        calls.push(`delete-r2:${name}`);
      },
    };

    const inventory = createCloudflareAcceptanceInventory({
      runId: '1662',
      nowMs: Date.parse('2026-07-26T12:00:00Z'),
    });
    const provisioned = await provisionCloudflareAcceptance(client, inventory);
    expect(provisioned.expiresAt).toBe('2026-07-26T18:00:00.000Z');
    expect(provisioned.resources.d1Id).toBe('d1-current');
    expect(calls).toEqual([
      `create-d1:${names.d1Name}`,
      `create-r2:${names.r2BucketName}`,
    ]);

    const cleanup = await cleanupCloudflareAcceptance(client, provisioned);
    expect(cleanup.deleted).toEqual([
      `worker:${names.workerName}`,
      `worker:${names.edgeWorkerName}`,
      'd1:d1-current',
      `r2:${names.r2BucketName}`,
    ]);
    expect(cleanup.unknown).toEqual([
      'd1:d1-older:consuelo-os-dist-test-older',
      'r2:consuelo-os-dist-test-older',
      'worker:consuelo-os-dist-test-older',
    ]);
    expect(calls).not.toContain('delete-worker:consuelo-os-dist-test-older');
    expect(calls).not.toContain('delete-d1:d1-older');
    expect(calls).not.toContain('delete-r2:consuelo-os-dist-test-older');
  });

  it('renders and verifies the actual device-authority and workspace-edge artifacts', async () => {
    const inventory = {
      ...createCloudflareAcceptanceInventory({
        runId: '1662',
        nowMs: Date.now(),
      }),
      resources: {
        ...createCloudflareAcceptanceInventory({ runId: '1662' }).resources,
        d1Id: 'd1-current',
      },
    };
    const configs = renderCloudflareAcceptanceWranglerConfigs(inventory, {
      projectRoot: '/repo/packages/os',
    });

    expect(configs.authority).toMatchObject({
      name: 'consuelo-os-dist-test-1662',
      main: '/repo/packages/os/cloudflare/os-device-authority/src/worker.ts',
      routes: [
        {
          pattern: 'os-dist-1662.consuelohq.com',
          custom_domain: true,
        },
      ],
    });
    expect(configs.edge).toMatchObject({
      name: 'consuelo-os-dist-test-1662-edge',
      main: '/repo/packages/os/cloudflare/workspace-edge/src/index.ts',
      durable_objects: {
        bindings: [
          {
            name: 'OS_DEVICE_AUTHORITY',
            class_name: 'OsDeviceGrantDurableObject',
            script_name: 'consuelo-os-dist-test-1662',
          },
        ],
      },
      routes: [
        {
          pattern: 'workspace-dist-1662.consuelohq.com',
          custom_domain: true,
        },
      ],
    });
    expect(JSON.stringify(configs)).not.toContain(
      'consuelo-os-device-authority"',
    );
    expect(JSON.stringify(configs)).not.toContain(
      'consuelo-workspace-route-registry',
    );

    const resources = {
      workers: [inventory.names.workerName, inventory.names.edgeWorkerName],
      d1: [{ id: 'd1-current', name: inventory.names.d1Name }],
      r2Buckets: [inventory.names.r2BucketName],
    };
    const client: CloudflareAcceptanceClient = {
      async createD1() {
        throw new Error('not used');
      },
      async createR2Bucket() {
        throw new Error('not used');
      },
      async listResources() {
        return resources;
      },
      async deleteWorker() {},
      async deleteD1() {},
      async deleteR2Bucket() {},
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return Response.json({ ok: true });
      }
      if (url.includes('/.well-known/oauth-protected-resource')) {
        return Response.json({
          resource: `https://${inventory.names.hostname}/mcp`,
        });
      }
      if (url.endsWith('/mcp')) {
        return new Response(JSON.stringify({ error: 'missing_bearer_token' }), {
          status: 401,
          headers: {
            'www-authenticate': `Bearer resource_metadata="https://${inventory.names.hostname}/.well-known/oauth-protected-resource"`,
          },
        });
      }
      if (url.includes('/auth/consume')) {
        return Response.json({ error: 'invalid_handoff' }, { status: 400 });
      }
      return Response.json(
        { error: { code: 'WORKSPACE_HOSTNAME_NOT_FOUND' } },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      );
    };

    await expect(
      verifyCloudflareAcceptance(client, inventory, {
        fetchImpl,
        attempts: 1,
        sleep: async () => {},
      }),
    ).resolves.toMatchObject({ ok: true, runId: '1662', checks: 5 });
  });

  it('guards the live lane behind manual approval, the registered environment, and always cleanup', () => {
    const repositoryRoot = existsSync(join(process.cwd(), '.github'))
      ? process.cwd()
      : join(process.cwd(), '..', '..');
    const workflow = readFileSync(
      join(
        repositoryRoot,
        '.github',
        'workflows',
        'consuelo-os-web-security-e2e.yaml',
      ),
      'utf8',
    );
    const distributionWorkflow = readFileSync(
      join(
        repositoryRoot,
        '.github',
        'workflows',
        'consuelo-os-distribution-environments.yaml',
      ),
      'utf8',
    );
    const parsedWorkflow = YAML.parse(workflow) as {
      on?: {
        pull_request?: { paths?: string[] };
        push?: { paths?: string[] };
      };
    };
    const webSecurityPaths = [
      'packages/os/cloudflare/**',
      'packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts',
      'packages/os/scripts/lib/workspace-cloudflare-edge-router.ts',
      'packages/os/scripts/server/routes/traces.ts',
      'packages/os/scripts/testing/web-security/**',
      'packages/os/tests/cloudflare-edge-router.test.ts',
      'packages/os/tests/cloudflare-provisioning-contract.test.ts',
      'packages/os/tests/managed-os-mcp-origin-class-migration.test.ts',
      'packages/os/tests/mcp-oauth-refresh-rotation.test.ts',
      'packages/os/tests/os-device-authority-architecture.test.ts',
      'packages/os/tests/os-device-authority-worker.test.ts',
      'packages/os/tests/os-universal-login.test.ts',
      'packages/os/tests/traces-hono-routes.test.ts',
      'packages/os/tests/web-security-e2e.test.ts',
      'packages/os/tests/workspace-node-registry-routing.test.ts',
    ];

    expect(workflow).toContain('run_cloudflare_web_security_acceptance:');
    expect(workflow).toContain('environment: consuelo-os-dev');
    expect(workflow).toContain('secrets.CLOUDFLARE_OS_TEST_API_TOKEN');
    expect(workflow).toContain('vars.CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('cloudflare-acceptance.ts render');
    expect(workflow).toContain('cloudflare-acceptance.ts verify');
    expect(workflow).toContain('cloudflare-acceptance.ts cleanup');
    expect(workflow).toContain('wrangler d1 migrations apply');
    expect(workflow).toContain('wrangler deploy --config "$AUTHORITY_CONFIG"');
    expect(workflow).toContain('wrangler deploy --config "$EDGE_CONFIG"');
    expect(workflow).toContain('tests/mcp-oauth-refresh-rotation.test.ts');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('consuelo-os-dist-test-${{ github.run_id }}');
    expect(workflow).not.toContain('CLOUDFLARE_OS_RELEASE_API_TOKEN');
    expect(workflow).not.toContain('CLOUDFLARE_WAF_API_TOKEN');
    expect(parsedWorkflow.on?.pull_request?.paths ?? []).toEqual(
      expect.arrayContaining(webSecurityPaths),
    );
    expect(parsedWorkflow.on?.push?.paths ?? []).toEqual(
      expect.arrayContaining(webSecurityPaths),
    );
    expect(distributionWorkflow).not.toContain(
      'run_cloudflare_web_security_acceptance',
    );
    expect(distributionWorkflow).not.toContain(
      'cloudflare-web-security-acceptance',
    );
  });
});
