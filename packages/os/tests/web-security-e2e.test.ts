import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WEB_SECURITY_ROUTE_MATRIX,
  assertWebSecurityRouteMatrix,
} from '../cloudflare/web-security-route-matrix';
import {
  buildCloudflareAcceptanceNames,
  cleanupCloudflareAcceptance,
  createCloudflareAcceptanceInventory,
  provisionCloudflareAcceptance,
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
      d1Name: 'consuelo-os-dist-test-1662',
      r2BucketName: 'consuelo-os-dist-test-1662',
      r2Prefix: 'consuelo-os-dist-test/1662/',
      hostname: 'os-dist-1662.consuelohq.com',
    });

    const calls: string[] = [];
    const client: CloudflareAcceptanceClient = {
      async createWorker(name) {
        calls.push(`create-worker:${name}`);
      },
      async createD1(name) {
        calls.push(`create-d1:${name}`);
        return { id: 'd1-current', name };
      },
      async migrateD1(id) {
        calls.push(`migrate-d1:${id}`);
      },
      async createR2Bucket(name) {
        calls.push(`create-r2:${name}`);
      },
      async verifyWorker(name) {
        calls.push(`verify-worker:${name}`);
      },
      async listResources() {
        return {
          workers: [names.workerName, 'consuelo-os-dist-test-older'],
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

    const cleanup = await cleanupCloudflareAcceptance(client, provisioned);
    expect(cleanup.deleted).toEqual([
      `worker:${names.workerName}`,
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

  it('guards the live lane behind manual approval, the registered environment, and always cleanup', () => {
    const repositoryRoot = existsSync(join(process.cwd(), '.github'))
      ? process.cwd()
      : join(process.cwd(), '..', '..');
    const workflow = readFileSync(
      join(
        repositoryRoot,
        '.github',
        'workflows',
        'consuelo-os-distribution-environments.yaml',
      ),
      'utf8',
    );

    expect(workflow).toContain('run_cloudflare_web_security_acceptance:');
    expect(workflow).toContain('environment: consuelo-os-dev');
    expect(workflow).toContain('secrets.CLOUDFLARE_OS_TEST_API_TOKEN');
    expect(workflow).toContain('vars.CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('cloudflare-acceptance.ts cleanup');
    expect(workflow).toContain('consuelo-os-dist-test-${{ github.run_id }}');
    expect(workflow).not.toContain('CLOUDFLARE_OS_RELEASE_API_TOKEN');
    expect(workflow).not.toContain('CLOUDFLARE_WAF_API_TOKEN');
  });
});
