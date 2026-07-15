import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
  type TraceSitesGatewayLiveEndpoints,
} from '../../lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from '../../lib/trace-sites-local-read-backend';
import { loadAuthConfigForRequest } from '../middleware/auth';

let traceGatewayEndpointCache: TraceSitesGatewayLiveEndpoints | null = null;

export type TraceDbPathOptions = {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
};

export function resolveTraceDbPath(options: TraceDbPathOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const traceDbEnv = env.CONSUELO_TRACE_DB ?? env.TRACE_DB ?? '';
  if (traceDbEnv) return traceDbEnv;
  const home = env.CONSUELO_OS_HOME ?? env.CONSUELO_HOME ?? '';
  if (home) return newestTraceDbUnder(path.join(home, 'traces'));
  if (platform === 'darwin') {
    return newestTraceDbUnder(path.join(
      env.HOME ?? '',
      'Library',
      'Application Support',
      'OpenWorkspace',
      'traces',
    ));
  }
  if (platform === 'win32') {
    return newestTraceDbUnder(path.join(
      env.APPDATA ?? env.HOME ?? '',
      'OpenWorkspace',
      'traces',
    ));
  }
  const dataHome = env.XDG_DATA_HOME ??
    path.join(env.HOME ?? '', '.local', 'share');
  return newestTraceDbUnder(path.join(dataHome, 'OpenWorkspace', 'traces'));
}

function newestTraceDbUnder(traceRoot: string): string {
  const direct = path.join(traceRoot, 'traces.db');
  const candidates = existsSync(direct) ? [direct] : [];
  if (existsSync(traceRoot)) {
    try {
      for (const entry of readdirSync(traceRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(traceRoot, entry.name, 'traces.db');
        if (existsSync(candidate)) candidates.push(candidate);
      }
    } catch {
      return direct;
    }
  }
  if (candidates.length === 0) return direct;
  return candidates.reduce((latest, candidate) => {
    try {
      return statSync(candidate).mtimeMs > statSync(latest).mtimeMs
        ? candidate
        : latest;
    } catch {
      return latest;
    }
  });
}

export function traceGatewayEndpoints(): TraceSitesGatewayLiveEndpoints {
  traceGatewayEndpointCache ??= createTraceSitesGatewayLiveEndpoints({
    backend: createLocalTraceSitesReadBackend({ dbPath: resolveTraceDbPath() }),
    resolveScope: (traceRequest) => {
      const scope = traceGatewayScopeFromHeaders(traceRequest);
      const config = loadAuthConfigForRequest();
      return {
        ...scope,
        workspaceId: scope.workspaceId === 'workspace-unknown'
          ? config.workspaceId
          : scope.workspaceId,
        workspaceHost: scope.workspaceHost === '127.0.0.1:8960'
          ? config.workspaceHost
          : scope.workspaceHost,
      };
    },
  });
  return traceGatewayEndpointCache;
}
