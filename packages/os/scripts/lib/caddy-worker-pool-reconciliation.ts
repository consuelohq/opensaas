import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createGatewaySecurityConfig,
  loadGatewaySecurityConfig,
  renderCaddyGatewayConfig,
} from './security-gateway';
import { MAX_OS_WORKERS, resolveWorkerPoolConfiguration } from './worker-pool';

const DEFAULT_CADDY_INGRESS_PORT = 46_320;

function ingressPortFromCaddyfile(source: string): number {
  const match = source.match(/^http:\/\/:(\d+) \{/m);
  if (!match) return DEFAULT_CADDY_INGRESS_PORT;
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('preserved Caddy ingress port is invalid');
  }
  return port;
}

export type CaddyWorkerPoolReconciliationResult = {
  changed: boolean;
  upstreams: string[];
  reason?: 'gateway-not-configured';
};

type ReconciliationWorkerPool = {
  basePort: number;
  workerPorts: number[];
};

function canonicalWorkerPoolFromSnapshot(nodeHome: string): ReconciliationWorkerPool | null {
  const snapshotPath = join(nodeHome, 'runs', 'os-worker-pool.json');
  if (!existsSync(snapshotPath)) return null;
  try {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { schemaVersion?: unknown; desiredWorkers?: unknown; basePort?: unknown };
    const desiredWorkers = snapshot.desiredWorkers;
    const basePort = snapshot.basePort;
    if (snapshot.schemaVersion !== 1
      || !Number.isInteger(desiredWorkers) || !Number.isInteger(basePort)
      || (desiredWorkers as number) < 1 || (desiredWorkers as number) > MAX_OS_WORKERS
      || (basePort as number) < 1 || (basePort as number) > 65_535
      || (basePort as number) + (desiredWorkers as number) - 1 > 65_535) return null;
    return {
      basePort: basePort as number,
      workerPorts: Array.from({ length: desiredWorkers as number }, (_, index) => (basePort as number) + index),
    };
  } catch {
    return null;
  }
}

function resolveReconciliationWorkerPool(input: { nodeHome: string; env?: NodeJS.ProcessEnv }): ReconciliationWorkerPool {
  // Lifecycle requests execute inside one HA worker. Its CONSUELO_OS_PORT is the slot
  // port, not the pool base. Prefer the supervisor snapshot so Caddy topology cannot
  // depend on which worker happened to receive the lifecycle request.
  const snapshot = canonicalWorkerPoolFromSnapshot(input.nodeHome);
  if (snapshot) return snapshot;
  const configured = resolveWorkerPoolConfiguration(input.env);
  return { basePort: configured.basePort, workerPorts: configured.workerPorts };
}

export function reconcileCaddyWorkerPoolConfig(input: {
  nodeHome: string;
  env?: NodeJS.ProcessEnv;
}): CaddyWorkerPoolReconciliationResult {
  const authConfigPath = join(
    input.nodeHome,
    'security',
    'generated',
    'auth.json',
  );
  const caddyfilePath = join(input.nodeHome, 'caddy', 'Caddyfile');
  if (!existsSync(authConfigPath) || !existsSync(caddyfilePath)) {
    return {
      changed: false,
      upstreams: [],
      reason: 'gateway-not-configured',
    };
  }

  const config = loadGatewaySecurityConfig({ authConfigPath });
  const workerPool = resolveReconciliationWorkerPool(input);
  const upstreams = workerPool.workerPorts.map(
    (port) => '127.0.0.1:' + String(port),
  );
  const currentCaddyfile = readFileSync(caddyfilePath, 'utf8');
  const ingressPort = ingressPortFromCaddyfile(currentCaddyfile);
  const expectedCaddyfile = renderCaddyGatewayConfig({
    workspaceHost: config.workspaceHost,
    ingressPort,
    upstream: { host: '127.0.0.1', port: workerPool.basePort },
    upstreams: workerPool.workerPorts.map((port) => ({
      host: '127.0.0.1',
      port,
    })),
  });
  if (currentCaddyfile === expectedCaddyfile) {
    return { changed: false, upstreams };
  }

  createGatewaySecurityConfig({
    home: input.nodeHome,
    workspaceId: config.workspaceId,
    workspaceSlug: config.workspaceSlug,
    workspaceHost: config.workspaceHost,
    upstreamPort: workerPool.basePort,
    upstreamPorts: workerPool.workerPorts,
    ingressPort,
  });
  return { changed: true, upstreams };
}
