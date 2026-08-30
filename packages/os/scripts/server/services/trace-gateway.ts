import {
  createTraceSitesGatewayLiveEndpoints,
  traceGatewayScopeFromHeaders,
  type TraceSitesGatewayLiveEndpoints,
} from '../../lib/trace-sites-gateway-live-endpoints';
import { createLocalTraceSitesReadBackend } from '../../lib/trace-sites-local-read-backend';
import { resolveCanonicalTraceDbPath } from '../../lib/trace-persistence';
import { loadAuthConfigForRequest } from '../middleware/auth';

const traceGatewayEndpointCache = new Map<string, TraceSitesGatewayLiveEndpoints>();

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

export function traceGatewayEndpoints(): TraceSitesGatewayLiveEndpoints {
  const dbPath = resolveCanonicalTraceDbPath();
  const cached = traceGatewayEndpointCache.get(dbPath);
  if (cached) return cached;

  const created = createTraceSitesGatewayLiveEndpoints({
    backend: createLocalTraceSitesReadBackend({ dbPath }),
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
  traceGatewayEndpointCache.set(dbPath, created);
  return created;
}
