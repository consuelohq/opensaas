import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { WORKSPACE_EDGE_NODE_HEADERS } from '../scripts/lib/workspace-edge-node-auth';

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
      edgeProxy: {
        nodeId: 'node_acme',
        connectorId: 'connector_acme',
        signingSecret: 'edge-test-secret',
      },
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
    for (const header of Object.values(WORKSPACE_EDGE_NODE_HEADERS)) {
      expect(caddyfile.toLowerCase()).not.toContain(`header_up -${header.toLowerCase()}`);
    }
    expect(caddyfile).toContain('header_up -X-Consuelo-Edge-Cache-Authority');
    expect(caddyfile).toContain('header_up -X-Consuelo-Route');
    const auth = JSON.parse(
      readFileSync(join(nodeHome, 'security', 'generated', 'auth.json'), 'utf8'),
    ) as { edgeProxy?: { nodeId?: string; connectorId?: string; signingSecret?: string } };
    expect(auth.edgeProxy).toMatchObject({
      nodeId: 'node_acme',
      connectorId: 'connector_acme',
      signingSecret: 'edge-test-secret',
    });
    expect(getAgentAppCredentialStatus({ config, tokenId: token.tokenId })).not.toBeNull();

    const runsDir = join(nodeHome, 'runs');
    mkdirSync(runsDir, { recursive: true });
    writeFileSync(join(runsDir, 'os-worker-pool.json'), JSON.stringify({
      schemaVersion: 1,
      basePort: 48_100,
      desiredWorkers: 2,
      workers: [
        { workerId: 'worker-0', port: 48_100, state: 'ready' },
        { workerId: 'worker-1', port: 48_101, state: 'ready' },
      ],
    }));
    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48101',
        PORT: '48101',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({
      changed: false,
      upstreams: ['127.0.0.1:48100', '127.0.0.1:48101'],
    });

    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_WORKER_BASE_PORT: '48100',
        CONSUELO_OS_PORT: '48101',
        PORT: '48101',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({
      changed: false,
      upstreams: ['127.0.0.1:48100', '127.0.0.1:48101'],
    });
    expect(readFileSync(join(nodeHome, 'caddy', 'Caddyfile'), 'utf8')).not.toContain('48102');
    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48100',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({ changed: false });
  });
});
