import {
  createConsueloGatewaySourceModePolicy,
  resolveConsueloGatewayDegradation,
  resolveConsueloGatewaySourceModePolicy,
} from './consuelo-sites-gateway-policy';
import {
  createConsueloSiteServiceRegistry,
  discoverRegisteredConsueloSiteServices,
  registerConsueloSiteService,
} from './consuelo-sites-gateway-registry';
import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayDecision,
  type ConsueloGatewayDiscovery,
  type ConsueloGatewayDiscoveryService,
  type ConsueloGatewayError,
  type ConsueloGatewayRequest,
  type ConsueloGatewayRouteFailure,
  type ConsueloGatewayRouteResult,
  type ConsueloGatewayServiceRegistration,
  type ConsueloGatewaySessionScope,
  type ConsueloGatewaySourceModePolicy,
  type ConsueloGatewayWorkspaceIdentity,
  type ConsueloSitesGateway,
  type ConsueloSitesGatewayOptions,
} from './consuelo-sites-gateway-types';

export {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayAllowDecision,
  type ConsueloGatewayCachePolicy,
  type ConsueloGatewayCircuitState,
  type ConsueloGatewayDecision,
  type ConsueloGatewayDegradation,
  type ConsueloGatewayDiscovery,
  type ConsueloGatewayDiscoveryService,
  type ConsueloGatewayError,
  type ConsueloGatewayErrorCode,
  type ConsueloGatewayPublicBoundary,
  type ConsueloGatewayRequest,
  type ConsueloGatewayRouteFailure,
  type ConsueloGatewayRouteResult,
  type ConsueloGatewayRouteSuccess,
  type ConsueloGatewayServiceCapability,
  type ConsueloGatewayServiceRegistration,
  type ConsueloGatewaySessionScope,
  type ConsueloGatewaySourceMode,
  type ConsueloGatewaySourceModePolicy,
  type ConsueloGatewayWorkspaceIdentity,
  type ConsueloSitesGateway,
  type ConsueloSitesGatewayOptions,
  type ConsueloSiteServiceRegistry,
  type ConsueloSiteSlug,
} from './consuelo-sites-gateway-types';
export {
  CONSUELO_GATEWAY_SOURCE_MODE_POLICY,
  createConsueloGatewaySourceModePolicy,
  resolveConsueloGatewayDegradation,
  resolveConsueloGatewaySourceModePolicy,
} from './consuelo-sites-gateway-policy';
export { registerConsueloSiteService } from './consuelo-sites-gateway-registry';

export const CONSUELO_SITES_GATEWAY_VERSION = '2026-06-13.gateway-2';

export function createConsueloSitesGateway(options: ConsueloSitesGatewayOptions = {}): ConsueloSitesGateway {
  return {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    registry: options.registry ?? createConsueloSiteServiceRegistry(),
    sourceModePolicy: createConsueloGatewaySourceModePolicy(options.sourceModePolicy),
  };
}

export function resolveConsueloGatewayRequest(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDecision {
  const sourceModePolicy = resolveConsueloGatewaySourceModePolicy(request.sourceMode, gateway.sourceModePolicy);
  const degradation = resolveConsueloGatewayDegradation(sourceModePolicy, request.session?.bridgeConfigured === true);
  const session = request.session;

  if (!session?.userId || !session.workspaceId || !session.workspaceHost) {
    return denyDecision(request, sourceModePolicy, degradation, {
      code: 'WORKSPACE_IDENTITY_MISSING',
      message: 'Consuelo Gateway requests require workspace identity from host/session scope.',
    });
  }

  const workspace = workspaceFromSession(session);

  if (session.workspaceHost !== request.host) {
    return denyDecision(request, sourceModePolicy, degradation, {
      code: 'WORKSPACE_HOST_MISMATCH',
      message: 'Consuelo Gateway request host must match the session workspace host.',
    }, workspace);
  }

  return allowDecision(request, sourceModePolicy, degradation, workspace);
}

export function authorizeConsueloGatewayRequest(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDecision {
  const resolved = resolveConsueloGatewayRequest(gateway, request);
  if (!resolved.ok) return resolved;

  const session = request.session;
  if (!session) return resolved;

  if (!session.allowedSites.includes(request.site)) {
    return denyDecision(request, resolved.sourceModePolicy, resolved.degradation, {
      code: 'SITE_SCOPE_DENIED',
      message: 'The session is not entitled to access the requested Consuelo Site.',
    }, resolved.workspace);
  }

  if (!session.capabilities.includes(request.capability)) {
    return denyDecision(request, resolved.sourceModePolicy, resolved.degradation, {
      code: 'CAPABILITY_SCOPE_DENIED',
      message: 'The session is not entitled to use the requested Consuelo Site capability.',
    }, resolved.workspace);
  }

  if (!session.sourceModesAllowed.includes(request.sourceMode)) {
    return denyDecision(request, resolved.sourceModePolicy, resolved.degradation, {
      code: 'SOURCE_MODE_DENIED',
      message: 'The session is not entitled to use the requested source mode.',
    }, resolved.workspace);
  }

  if (resolved.sourceModePolicy.bridgeRequired && session.bridgeConfigured !== true) {
    return denyDecision(request, resolved.sourceModePolicy, resolved.degradation, {
      code: 'BRIDGE_REQUIRED',
      message: 'Local off-network Consuelo Sites require a configured bridge before gateway routing is available.',
    }, resolved.workspace);
  }

  return resolved;
}

export function canReadConsueloSite(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDecision {
  return authorizeConsueloGatewayRequest(gateway, request);
}

export function discoverConsueloSiteServices(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDiscovery {
  const authorization = authorizeConsueloGatewayRequest(gateway, request);

  if (!authorization.ok) {
    return {
      ok: false,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: authorization.workspace,
      site: request.site,
      capability: request.capability,
      sourceMode: request.sourceMode,
      sourceModePolicy: authorization.sourceModePolicy,
      services: [],
      degradation: authorization.degradation,
      error: authorization.error,
    };
  }

  const services = discoverRegisteredConsueloSiteServices(gateway.registry, {
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
  }).map(toDiscoveryService);

  return {
    ok: true,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace: authorization.workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy: authorization.sourceModePolicy,
    services,
    degradation: authorization.degradation,
  };
}

export function routeConsueloGatewayRequest(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayRouteResult {
  const discovery = discoverConsueloSiteServices(gateway, request);

  if (!discovery.ok) {
    return routeFailure(request, discovery.sourceModePolicy, discovery.degradation, discovery.error ?? {
      code: 'SERVICE_NOT_FOUND',
      message: 'Consuelo Gateway request was denied before route resolution.',
    }, discovery.workspace);
  }

  const route = discovery.services[0];
  if (!route) {
    return routeFailure(request, discovery.sourceModePolicy, {
      state: 'unavailable',
      circuitState: 'open',
      retryPolicy: 'circuit-open',
    }, {
      code: 'SERVICE_NOT_FOUND',
      message: 'No Consuelo Gateway service is registered for the requested Site capability.',
    }, discovery.workspace);
  }

  return {
    ok: true,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace: discovery.workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy: discovery.sourceModePolicy,
    route,
    degradation: discovery.degradation,
  };
}

function allowDecision(
  request: ConsueloGatewayRequest,
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  degradation: ConsueloGatewayDecision['degradation'],
  workspace: ConsueloGatewayWorkspaceIdentity,
): ConsueloGatewayDecision {
  return {
    ok: true,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy,
    degradation,
  };
}

function denyDecision(
  request: ConsueloGatewayRequest,
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  degradation: ConsueloGatewayDecision['degradation'],
  error: ConsueloGatewayError,
  workspace?: ConsueloGatewayWorkspaceIdentity,
): ConsueloGatewayDecision {
  return {
    ok: false,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy,
    degradation,
    error,
  };
}

function routeFailure(
  request: ConsueloGatewayRequest,
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  degradation: ConsueloGatewayRouteFailure['degradation'],
  error: ConsueloGatewayError,
  workspace?: ConsueloGatewayWorkspaceIdentity,
): ConsueloGatewayRouteFailure {
  return {
    ok: false,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy,
    degradation,
    error,
  };
}

function workspaceFromSession(session: ConsueloGatewaySessionScope): ConsueloGatewayWorkspaceIdentity {
  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    workspaceHost: session.workspaceHost,
  };
}

function toDiscoveryService(registration: ConsueloGatewayServiceRegistration): ConsueloGatewayDiscoveryService {
  return {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: registration.site,
    capability: registration.capability,
    serviceName: registration.serviceName,
    gatewayServiceName: registration.gatewayServiceName,
    gatewayAdapterName: registration.gatewayAdapterName,
    publicSiteRouteFamily: registration.publicSiteRouteFamily,
    gatewayRouteFamily: registration.gatewayRouteFamily,
    cachePolicy: registration.cachePolicy,
    circuitState: registration.circuitState,
  };
}
