import { randomUUID } from 'node:crypto';

import type { ConsueloGatewaySessionScope } from './consuelo-sites-gateway-types';
import {
  parseWorkspaceSourceControlConfiguration,
  readWorkspaceSourceControlConfiguration,
  updateWorkspaceSourceControlConfiguration,
} from './source-control-config';
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

type ConfigurationVocabulary = 'configuration' | 'settings';
type ConfigurationOperation = 'read' | 'write';

const CONFIGURATION_READ_ROUTES = new Set([
  '/gateway/configuration/snapshot',
  '/gateway/settings/snapshot',
]);
const CONFIGURATION_WRITE_ROUTES = new Set([
  '/gateway/configuration/overlay',
  '/gateway/settings/overlay',
]);
const CONFIGURATION_SOURCE_CONTROL_ROUTE = '/gateway/configuration/source-control';

function vocabularyForPath(pathname: string): ConfigurationVocabulary {
  return pathname.startsWith('/gateway/settings/') ? 'settings' : 'configuration';
}

function requiredCapability(pathname: string, operation: ConfigurationOperation): string {
  return `${vocabularyForPath(pathname)}-${operation}`;
}

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
          error: { code: 'NOT_FOUND', message: 'Configuration gateway route not found.' },
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
              : 'Configuration gateway scope resolution failed.',
          },
        }, 403);
      }

      if (url.pathname === CONFIGURATION_SOURCE_CONTROL_ROUTE) {
        if (request.method !== 'GET' && request.method !== 'POST') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Source-control configuration requires GET or POST.' },
          }, 405);
        }
        const operation: ConfigurationOperation = request.method === 'GET' ? 'read' : 'write';
        if (!scope.capabilities.includes(requiredCapability(url.pathname, operation))) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: {
              code: 'CAPABILITY_SCOPE_DENIED',
              message: `Source-control configuration ${operation} is not allowed for this session.`,
            },
          }, 403);
        }
        try {
          const snapshot = request.method === 'GET'
            ? readWorkspaceSourceControlConfiguration({
              home: options.home,
              workspaceId: scope.workspaceId,
            })
            : updateWorkspaceSourceControlConfiguration({
              home: options.home,
              workspaceId: scope.workspaceId,
              configuration: parseWorkspaceSourceControlConfiguration(
                JSON.parse(await request.clone().text()),
              ),
            });
          return jsonResponse({
            ok: true,
            publicBoundary: 'consuelo-gateway',
            route: url.pathname,
            workspace: { workspaceId: scope.workspaceId, workspaceHost: scope.workspaceHost },
            snapshot,
          });
        } catch (error: unknown) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            route: url.pathname,
            error: {
              code: 'INVALID_SOURCE_CONTROL_CONFIGURATION',
              message: error instanceof Error
                ? error.message.slice(0, 240)
                : 'Source-control configuration is invalid.',
            },
          }, 400);
        }
      }

      if (CONFIGURATION_READ_ROUTES.has(url.pathname)) {
        if (request.method !== 'GET') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Configuration snapshot requires GET.' },
          }, 405);
        }
        if (!scope.capabilities.includes(requiredCapability(url.pathname, 'read'))) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Configuration snapshot read is not allowed for this session.' },
          }, 403);
        }
        const result = await readSettingsGatewaySnapshot(options.home);
        if (!result.ok) {
          return jsonResponse({ ok: false, publicBoundary: 'consuelo-gateway', error: result.error }, result.status);
        }
        return jsonResponse({
          ok: true,
          publicBoundary: 'consuelo-gateway',
          route: url.pathname,
          workspace: { workspaceId: scope.workspaceId, workspaceHost: scope.workspaceHost },
          snapshot: result.snapshot,
        });
      }

      if (CONFIGURATION_WRITE_ROUTES.has(url.pathname)) {
        if (request.method !== 'POST') {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'METHOD_NOT_ALLOWED', message: 'Configuration overlay writes require POST.' },
          }, 405);
        }
        if (!scope.capabilities.includes(requiredCapability(url.pathname, 'write'))) {
          return jsonResponse({
            ok: false,
            publicBoundary: 'consuelo-gateway',
            error: { code: 'CAPABILITY_SCOPE_DENIED', message: 'Configuration overlay writes are not allowed for this session.' },
          }, 403);
        }
        const body = await request.clone().text();
        const result = await applySettingsGatewayOverlayPatch(options.home, body, {
          actorType: 'user',
          actorId: scope.userId,
          workspaceId: scope.workspaceId,
          correlationId: request.headers.get('x-consuelo-request-id') || randomUUID(),
        });
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
        });
      }

      return jsonResponse({
        ok: false,
        publicBoundary: 'consuelo-gateway',
        error: { code: 'NOT_FOUND', message: 'Configuration gateway route not found.' },
      }, 404);
    },
  };
}

export function settingsGatewayScopeFromHeaders(request: Request): ConsueloGatewaySessionScope {
  const url = new URL(request.url);
  const headers = request.headers;
  const userId = headers.get('x-consuelo-user-id') || headers.get('x-consuelo-caller-id');
  const workspaceId = headers.get('x-consuelo-workspace-id');
  const workspaceHost = headers.get('x-consuelo-workspace-host');
  const allowedSites = splitHeader(headers.get('x-consuelo-allowed-sites'));
  const capabilities = splitHeader(headers.get('x-consuelo-capabilities'));
  const sourceModeValues = splitHeader(headers.get('x-consuelo-source-modes'));
  const sourceModes = sourceModeValues.filter(isSettingsSourceMode);
  const vocabulary = vocabularyForPath(url.pathname);

  if (!userId || !workspaceId || !workspaceHost) {
    throw new Error('Signed Configuration gateway identity and workspace headers are required.');
  }
  if (workspaceHost !== url.host) {
    throw new Error('Signed Configuration gateway workspace host does not match the request host.');
  }
  if (!allowedSites.includes(vocabulary)) {
    throw new Error(`Signed Configuration gateway scope does not allow the ${vocabulary} site.`);
  }
  if (capabilities.length === 0) {
    throw new Error('Signed Configuration gateway capabilities are required.');
  }
  if (sourceModes.length === 0 || sourceModes.length !== sourceModeValues.length) {
    throw new Error('Signed Configuration gateway source modes are required and must be valid.');
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

export const configurationGatewayScopeFromHeaders = settingsGatewayScopeFromHeaders;
export const createConfigurationSitesGatewayEndpoints = createSettingsSitesGatewayEndpoints;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function splitHeader(value: string | null): string[] {
  return (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
}

function isSettingsSourceMode(value: unknown): value is ConsueloGatewaySessionScope['sourceModesAllowed'][number] {
  return value === 'local-networked' || value === 'cloud-compute' || value === 'local-off-network';
}
