import type { ConsueloGatewaySessionScope } from './consuelo-sites-gateway-types';
import {
  applySettingsGatewayOverlayPatch,
  isSettingsGatewayRoute,
  readSettingsGatewaySnapshot,
} from './settings-gateway';

export type SettingsSitesGatewayScopeResolver = (
  request: Request,
) => ConsueloGatewaySessionScope | Promise<ConsueloGatewaySessionScope>;

export type SettingsSitesGatewayEndpoints = {
  handle: (request: Request) => Promise<Response>;
};

export type SettingsSitesGatewayEndpointOptions = {
  home: string;
  resolveScope: SettingsSitesGatewayScopeResolver;
};

const SETTINGS_READ_ROUTES = new Set(['/gateway/settings/snapshot']);
const SETTINGS_WRITE_ROUTES = new Set(['/gateway/settings/overlay']);

export function createSettingsSitesGatewayEndpoints(
  options: SettingsSitesGatewayEndpointOptions,
): SettingsSitesGatewayEndpoints {
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (!isSettingsGatewayRoute(url.pathname)) {
        return jsonResponse({
          ok: false,
          publicBoundary: 'consuelo-gateway',
          error: { code: 'NOT_FOUND', message: 'Settings Sites gateway route not found.' },
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
            message: error instanceof Error ? error.message.slice(0, 240) : 'Settings Sites scope resolution failed.',
          },
        }, 403);
      }

      if (SETTINGS_READ_ROUTES.has(url.pathname)) {
        if (request.method !== 'GET') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Settings snapshot requires GET.' },
          }, 405);
        }

        if (!scope.capabilities.includes('settings-read')) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Settings snapshot read is not allowed for this session.' },
          }, 403);
        }

        const result = readSettingsGatewaySnapshot(options.home);
        if (!result.ok) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: result.error,
          }, result.status);
        }

        return jsonResponse({
          ok: true,
          publicBoundary: 'consuelo-gateway',
          route: url.pathname,
          workspace: {
            workspaceId: scope.workspaceId,
            workspaceHost: scope.workspaceHost,
          },
          snapshot: result.snapshot,
        });
      }

      if (SETTINGS_WRITE_ROUTES.has(url.pathname)) {
        if (request.method !== 'POST') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Settings overlay writes require POST.' },
          }, 405);
        }

        if (!scope.capabilities.includes('settings-write')) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Settings overlay writes are not allowed for this session.' },
          }, 403);
        }

        const body = await request.clone().text();
        const result = applySettingsGatewayOverlayPatch(options.home, body);
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
          workspace: {
            workspaceId: scope.workspaceId,
            workspaceHost: scope.workspaceHost,
          },
          snapshot: result.snapshot,
        });
      }

      return jsonResponse({
        ok: false,
        publicBoundary: 'consuelo-gateway',
        error: { code: 'NOT_FOUND', message: 'Settings Sites gateway route not found.' },
      }, 404);
    },
  };
}

export function settingsGatewayScopeFromHeaders(request: Request): ConsueloGatewaySessionScope {
  const url = new URL(request.url);
  const headers = request.headers;
  const allowedSites = splitHeader(headers.get('x-consuelo-allowed-sites'));
  const capabilities = splitHeader(headers.get('x-consuelo-capabilities'));
  const sourceModes = splitHeader(headers.get('x-consuelo-source-modes')).filter(isSettingsSourceMode);

  return {
    userId: headers.get('x-consuelo-user-id') || headers.get('x-consuelo-caller-id') || 'signed-gateway-caller',
    workspaceId: headers.get('x-consuelo-workspace-id') || 'workspace-unknown',
    workspaceHost: headers.get('x-consuelo-workspace-host') || url.host,
    allowedSites: allowedSites.length ? allowedSites : ['settings'],
    capabilities: capabilities.length ? capabilities : ['settings-read', 'settings-write'],
    sourceModesAllowed: sourceModes.length ? sourceModes : ['local-networked', 'cloud-compute'],
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
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isSettingsSourceMode(value: unknown): value is ConsueloGatewaySessionScope['sourceModesAllowed'][number] {
  return value === 'local-networked' || value === 'cloud-compute' || value === 'local-off-network';
}