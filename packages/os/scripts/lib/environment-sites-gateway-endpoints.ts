import { randomUUID } from 'node:crypto';

import type { ConsueloGatewaySessionScope } from './consuelo-sites-gateway-types';
import {
  applyEnvironmentGatewayDelete,
  applyEnvironmentGatewayUpsert,
  isEnvironmentGatewayRoute,
  readEnvironmentGatewaySnapshot,
} from './environment-gateway';

export type EnvironmentSitesGatewayScopeResolver = (
  request: Request,
) => ConsueloGatewaySessionScope | Promise<ConsueloGatewaySessionScope>;

export type EnvironmentSitesGatewayEndpoints = {
  handle: (request: Request) => Promise<Response>;
};

export type EnvironmentSitesGatewayEndpointOptions = {
  home: string;
  resolveScope: EnvironmentSitesGatewayScopeResolver;
};

const READ_ROUTE = '/gateway/environments/snapshot';
const WRITE_ROUTES = new Set([
  '/gateway/environments/upsert',
  '/gateway/environments/delete',
]);

export function createEnvironmentSitesGatewayEndpoints(
  options: EnvironmentSitesGatewayEndpointOptions,
): EnvironmentSitesGatewayEndpoints {
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (!isEnvironmentGatewayRoute(url.pathname)) {
        return jsonResponse({
          ok: false,
          publicBoundary: 'consuelo-gateway',
          error: { code: 'NOT_FOUND', message: 'Environment gateway route not found.' },
        }, 404);
      }

      let scope: ConsueloGatewaySessionScope;
      try {
        scope = await options.resolveScope(request);
      } catch (error: unknown) {
        return jsonResponse({
          ok: false,
          publicBoundary: 'consuelo-gateway',
          error: {
            code: 'SCOPE_RESOLUTION_FAILED',
            message: error instanceof Error
              ? error.message.slice(0, 240)
              : 'Environment gateway scope resolution failed.',
          },
        }, 403);
      }

      if (url.pathname === READ_ROUTE) {
        if (request.method !== 'GET') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Environment snapshot requires GET.' },
          }, 405);
        }
        if (!scope.capabilities.includes('environments-read')) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Environment reads are not allowed for this session.' },
          }, 403);
        }
        const result = await readEnvironmentGatewaySnapshot(options.home, scope.workspaceId);
        if (!result.ok) return jsonResponse({ ok: false, publicBoundary: 'consuelo-gateway', error: result.error }, result.status);
        return jsonResponse({
          ok: true,
          publicBoundary: 'consuelo-gateway',
          route: url.pathname,
          workspace: { workspaceId: scope.workspaceId, workspaceHost: scope.workspaceHost },
          snapshot: result.snapshot,
        });
      }

      if (WRITE_ROUTES.has(url.pathname)) {
        if (request.method !== 'POST') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Environment writes require POST.' },
          }, 405);
        }
        if (!scope.capabilities.includes('environments-write')) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Environment writes are not allowed for this session.' },
          }, 403);
        }
        const body = await request.clone().text();
        const actor = {
          actorType: 'user' as const,
          actorId: scope.userId,
          workspaceId: scope.workspaceId,
          correlationId: request.headers.get('x-consuelo-request-id') || randomUUID(),
        };
        const result = url.pathname.endsWith('/delete')
          ? await applyEnvironmentGatewayDelete(options.home, scope.workspaceId, body, actor)
          : await applyEnvironmentGatewayUpsert(options.home, scope.workspaceId, body, actor);
        if (!result.ok) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            route: url.pathname,
            error: result.error,
          }, result.status);
        }
        return jsonResponse({
          ok: true,
          publicBoundary: 'consuelo-gateway',
          route: url.pathname,
          workspace: { workspaceId: scope.workspaceId, workspaceHost: scope.workspaceHost },
          snapshot: result.snapshot,
          ...(result.environment ? { environment: result.environment, created: result.created } : {}),
          ...(result.deletedEnvironmentId ? { deletedEnvironmentId: result.deletedEnvironmentId } : {}),
        });
      }

      return jsonResponse({
        ok: false,
        publicBoundary: 'consuelo-gateway',
        error: { code: 'NOT_FOUND', message: 'Environment gateway route not found.' },
      }, 404);
    },
  };
}

export function environmentGatewayScopeFromHeaders(request: Request): ConsueloGatewaySessionScope {
  const url = new URL(request.url);
  const headers = request.headers;
  const userId = headers.get('x-consuelo-user-id') || headers.get('x-consuelo-caller-id');
  const workspaceId = headers.get('x-consuelo-workspace-id');
  const workspaceHost = headers.get('x-consuelo-workspace-host');
  const allowedSites = splitHeader(headers.get('x-consuelo-allowed-sites'));
  const capabilities = splitHeader(headers.get('x-consuelo-capabilities'));
  const sourceModeValues = splitHeader(headers.get('x-consuelo-source-modes'));
  const sourceModes = sourceModeValues.filter(isSourceMode);

  if (!userId || !workspaceId || !workspaceHost) {
    throw new Error('Signed Environment gateway identity and workspace headers are required.');
  }
  if (workspaceHost !== url.host) {
    throw new Error('Signed Environment gateway workspace host does not match the request host.');
  }
  if (!allowedSites.includes('environments')) {
    throw new Error('Signed Environment gateway scope does not allow the environments site.');
  }
  if (capabilities.length === 0) {
    throw new Error('Signed Environment gateway capabilities are required.');
  }
  if (sourceModes.length === 0 || sourceModes.length !== sourceModeValues.length) {
    throw new Error('Signed Environment gateway source modes are required and must be valid.');
  }

  return {
    userId,
    workspaceId,
    workspaceHost,
    allowedSites,
    capabilities,
    sourceModesAllowed: sourceModes,
    bridgeConfigured: headers.get('x-consuelo-bridge-configured') === 'true',
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function splitHeader(value: string | null): string[] {
  return (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
}

function isSourceMode(value: unknown): value is ConsueloGatewaySessionScope['sourceModesAllowed'][number] {
  return value === 'local-networked' || value === 'cloud-compute' || value === 'local-off-network';
}
