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

  it('uses canonical worker-pool state instead of the request worker port environment', () => {
    const nodeHome = mkdtempSync(join(tmpdir(), 'consuelo-caddy-pool-state-'));
    homes.push(nodeHome);
    createGatewaySecurityConfig({
      home: nodeHome,
      workspaceId: 'workspace_state',
      workspaceSlug: 'state',
      workspaceHost: 'state.example.test',
      upstreamPort: 48_100,
      upstreamPorts: [48_100, 48_101],
      ingressPort: 48_000,
      edgeProxy: {
        nodeId: 'node_state',
        connectorId: 'connector_state',
        signingSecret: 'edge-state-secret',
      },
    });
    const runsDir = join(nodeHome, 'runs');
    mkdirSync(runsDir, { recursive: true });
    writeFileSync(join(runsDir, 'os-worker-pool.json'), JSON.stringify({
      schemaVersion: 1,
      desiredWorkers: 2,
      basePort: 48_100,
      generatedAt: new Date().toISOString(),
      workers: [
        { slot: 0, workerId: 'worker-0', workerInstanceId: 'instance-0', port: 48_100, state: 'ready', restartCount: 0 },
        { slot: 1, workerId: 'worker-1', workerInstanceId: 'instance-1', port: 48_101, state: 'ready', restartCount: 0 },
      ],
    }));

    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48101',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({
      upstreams: ['127.0.0.1:48100', '127.0.0.1:48101'],
    });
    expect(readFileSync(join(nodeHome, 'caddy', 'Caddyfile'), 'utf8')).toContain(
      'reverse_proxy 127.0.0.1:48100 127.0.0.1:48101 {',
    );
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
    expect(reconcileCaddyWorkerPoolConfig({
      nodeHome,
      env: {
        CONSUELO_OS_PORT: '48100',
        CONSUELO_OS_WORKER_COUNT: '2',
      },
    })).toMatchObject({ changed: false });
  });
});
