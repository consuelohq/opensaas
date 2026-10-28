import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  createGatewaySecurityConfig,
  loadGatewaySecurityConfig,
  renderCaddyGatewayConfig,
} from './security-gateway';
import { resolveWorkerPoolConfiguration } from './worker-pool';

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

type RecordedWorkerPoolTopology = {
  basePort: number;
  desiredWorkers: number;
};

function readRecordedWorkerPoolTopology(nodeHome: string): RecordedWorkerPoolTopology | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(join(nodeHome, 'runs', 'os-worker-pool.json'), 'utf8'),
    ) as { schemaVersion?: unknown; basePort?: unknown; desiredWorkers?: unknown };
    if (
      parsed.schemaVersion !== 1
      || !Number.isInteger(parsed.basePort)
      || Number(parsed.basePort) < 1
      || Number(parsed.basePort) > 65_535
      || !Number.isInteger(parsed.desiredWorkers)
      || Number(parsed.desiredWorkers) < 1
      || Number(parsed.desiredWorkers) > 16
      || Number(parsed.basePort) + Number(parsed.desiredWorkers) - 1 > 65_535
    ) return undefined;
    return {
      basePort: Number(parsed.basePort),
      desiredWorkers: Number(parsed.desiredWorkers),
    };
  } catch {
    return undefined;
  }
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
  const recordedTopology = readRecordedWorkerPoolTopology(input.nodeHome);
  const workerPool = resolveWorkerPoolConfiguration({
    ...input.env,
    ...(recordedTopology
      ? {
          CONSUELO_OS_WORKER_BASE_PORT: String(recordedTopology.basePort),
          CONSUELO_OS_WORKER_COUNT: String(recordedTopology.desiredWorkers),
        }
      : {}),
  });
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
