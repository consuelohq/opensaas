import path from 'node:path';

import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
  type TraceSitesGatewayLiveEndpoints,
} from '../../lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from '../../lib/trace-sites-local-read-backend';
import { loadAuthConfigForRequest } from '../middleware/auth';

let traceGatewayEndpointCache: TraceSitesGatewayLiveEndpoints | null = null;

type TraceWorkspaceHostResolutionInput = {
  request: Request;
  scopeWorkspaceHost: string;
  configuredWorkspaceHost: string;
};

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '::1' || normalized.startsWith('127.');
};

export function resolveTraceWorkspaceHost(
  input: TraceWorkspaceHostResolutionInput,
): string {
  if (input.request.headers.get('x-consuelo-workspace-host')?.trim()) {
    return input.scopeWorkspaceHost;
  }

  const requestHostname = new URL(input.request.url).hostname;
  return isLoopbackHostname(requestHostname)
    ? input.configuredWorkspaceHost || input.scopeWorkspaceHost
    : input.scopeWorkspaceHost;
}

function resolveTraceDbPath(): string {
  const traceDbEnv = process.env.CONSUELO_TRACE_DB ?? process.env.TRACE_DB ?? '';
  if (traceDbEnv) return traceDbEnv;
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  if (home) return path.join(home, 'traces', 'traces.db');
  if (process.platform === 'darwin') {
    return path.join(
      process.env.HOME ?? '',
      'Library',
      'Application Support',
      'OpenWorkspace',
      'traces',
      'traces.db',
    );
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA ?? process.env.HOME ?? '',
      'OpenWorkspace',
      'traces',
      'traces.db',
    );
  }
  const dataHome = process.env.XDG_DATA_HOME ??
    path.join(process.env.HOME ?? '', '.local', 'share');
  return path.join(dataHome, 'OpenWorkspace', 'traces', 'traces.db');
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
        workspaceHost: resolveTraceWorkspaceHost({
          request: traceRequest,
          scopeWorkspaceHost: scope.workspaceHost,
          configuredWorkspaceHost: config.workspaceHost,
        }),
      };
    },
  });
  return traceGatewayEndpointCache;
}
