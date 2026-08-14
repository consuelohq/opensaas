import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  reconcileCaddyWorkerPoolConfig,
} from '../scripts/lib/caddy-worker-pool-reconciliation';
import {
  createGatewaySecurityConfig,
  getAgentAppCredentialStatus,
  issueAgentAppToken,
} from '../scripts/lib/security-gateway';

describe('Caddy worker-pool reconciliation', () => {
  const homes: string[] = [];

  afterEach(() => {
    for (const home of homes.splice(0)) rmSync(home, { force: true, recursive: true });
  });

  it('upgrades a preserved single-upstream config without rotating credentials', () => {
    const nodeHome = mkdtempSync(join(tmpdir(), 'consuelo-caddy-pool-'));
    homes.push(nodeHome);
    const config = createGatewaySecurityConfig({
      home: nodeHome,
      workspaceId: 'workspace_acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.example.test',
      upstreamPort: 48_100,
      ingressPort: 48_000,
    });
    const token = issueAgentAppToken({
      config,
      callerId: 'codex',
      appId: 'codex',
      scopes: ['mcp:call'],
      expiresInSeconds: 3_600,
    });

    expect(readFileSync(join(nodeHome, 'caddy', 'Caddyfile'), 'utf8')).toContain(
      'reverse_proxy 127.0.0.1:48100 {',
    );

    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48100',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({
      changed: true,
      upstreams: ['127.0.0.1:48100', '127.0.0.1:48101'],
    });

    const caddyfile = readFileSync(join(nodeHome, 'caddy', 'Caddyfile'), 'utf8');
    expect(caddyfile).toContain(
      'reverse_proxy 127.0.0.1:48100 127.0.0.1:48101 {',
    );
    expect(caddyfile).toContain('lb_policy round_robin');
    expect(caddyfile).toContain('health_uri /ready');
    expect(getAgentAppCredentialStatus({ config, tokenId: token.tokenId })).not.toBeNull();
    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48100',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({ changed: false });
  });
});
