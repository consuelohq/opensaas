import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  createDefaultConsueloSiteServiceRegistry,
  discoverRegisteredConsueloSiteServices,
  registerConsueloSiteService,
  type ConsueloGatewayCachePolicy,
  type ConsueloGatewayCircuitState,
  type ConsueloGatewayPublicBoundary,
  type ConsueloGatewayServiceCapability,
  type ConsueloGatewayServiceRegistration,
  type ConsueloGatewaySourceMode,
  type ConsueloSiteServiceRegistry,
  type ConsueloSiteSlug,
} from './consuelo-sites-gateway-registry';

export {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  registerConsueloSiteService,
  type ConsueloGatewayCachePolicy,
  type ConsueloGatewayCircuitState,
  type ConsueloGatewayPublicBoundary,
  type ConsueloGatewayServiceCapability,
  type ConsueloGatewayServiceRegistration,
  type ConsueloGatewaySourceMode,
  type ConsueloSiteSlug,
};

export const CONSUELO_SITES_GATEWAY_VERSION = '2026-06-13.gateway-1';

export type ConsueloGatewaySessionScope = {
  userId: string;
  workspaceId: string;
  workspaceHost: string;
  allowedSites: ConsueloSiteSlug[];
  capabilities: ConsueloGatewayServiceCapability[];
  sourceModesAllowed: ConsueloGatewaySourceMode[];
  bridgeConfigured?: boolean;
};

export type ConsueloGatewayRequest = {
  host: string;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  publicPath: string;
  session?: ConsueloGatewaySessionScope;
};

export type ConsueloGatewayWorkspaceIdentity = {
  userId: string;
  workspaceId: string;
  workspaceHost: string;
};

export type ConsueloGatewaySourceModePolicy = {
  sourceMode: ConsueloGatewaySourceMode;
  computeLocation: 'user-device' | 'consuelo-managed-runner';
  sitesHydration: 'consuelo-gateway' | 'bridge-required';
  requiresRelay: boolean;
  bridgeRequired: boolean;
  supportsRunnerControl: boolean;
};

export type ConsueloGatewayErrorCode =
  | 'WORKSPACE_IDENTITY_MISSING'
  | 'WORKSPACE_HOST_MISMATCH'
  | 'SITE_SCOPE_DENIED'
  | 'CAPABILITY_SCOPE_DENIED'
  | 'SOURCE_MODE_DENIED'
  | 'BRIDGE_REQUIRED'
  | 'SERVICE_NOT_FOUND';

export type ConsueloGatewayError = {
  code: ConsueloGatewayErrorCode;
  message: string;
};

export type ConsueloGatewayDegradation = {
  state: 'healthy' | 'degraded' | 'bridge-required' | 'unavailable';
  circuitState: ConsueloGatewayCircuitState['state'];
  retryPolicy: ConsueloGatewayCircuitState['retryPolicy'];
};

export type ConsueloGatewayDecision = {
  ok: boolean;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace?: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  error?: ConsueloGatewayError;
};

export type ConsueloGatewayDiscoveryService = {
  publicBoundary: ConsueloGatewayPublicBoundary;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  serviceName: string;
  gatewayServiceName: string;
  backendServiceName: string;
  publicRouteFamily: string;
  cachePolicy: ConsueloGatewayCachePolicy;
  circuitState: ConsueloGatewayCircuitState;
};

export type ConsueloGatewayDiscovery = {
  ok: boolean;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace?: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  services: ConsueloGatewayDiscoveryService[];
  degradation: ConsueloGatewayDegradation;
  error?: ConsueloGatewayError;
};

export type ConsueloGatewayRouteResult = {
  ok: boolean;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace?: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  route?: ConsueloGatewayDiscoveryService;
  degradation: ConsueloGatewayDegradation;
  error?: ConsueloGatewayError;
};

export type ConsueloSitesGateway = {
  publicBoundary: ConsueloGatewayPublicBoundary;
  registry: ConsueloSiteServiceRegistry;
  sourceModePolicy: Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy>;
};

export type ConsueloSitesGatewayOptions = {
  registry?: ConsueloSiteServiceRegistry;
  sourceModePolicy?: Partial<Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy>>;
};

const DEFAULT_SOURCE_MODE_POLICY: Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy> = {
  'local-networked': {
    sourceMode: 'local-networked',
    computeLocation: 'user-device',
    sitesHydration: 'consuelo-gateway',
    requiresRelay: true,
    bridgeRequired: false,
    supportsRunnerControl: false,
  },
  'cloud-compute': {
    sourceMode: 'cloud-compute',
    computeLocation: 'consuelo-managed-runner',
    sitesHydration: 'consuelo-gateway',
    requiresRelay: false,
    bridgeRequired: false,
    supportsRunnerControl: true,
  },
  'local-off-network': {
    sourceMode: 'local-off-network',
    computeLocation: 'user-device',
    sitesHydration: 'bridge-required',
    requiresRelay: false,
    bridgeRequired: true,
    supportsRunnerControl: false,
  },
};

export function createConsueloSitesGateway(options: ConsueloSitesGatewayOptions = {}): ConsueloSitesGateway {
  return {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    registry: options.registry ?? createDefaultConsueloSiteServiceRegistry(),
    sourceModePolicy: {
      ...DEFAULT_SOURCE_MODE_POLICY,
      ...options.sourceModePolicy,
    },
  };
}

export function resolveConsueloGatewayRequest(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDecision {
  const sourceModePolicy = gateway.sourceModePolicy[request.sourceMode];
  const session = request.session;

  if (!session?.userId || !session.workspaceId || !session.workspaceHost) {
    return decision(request, sourceModePolicy, false, {
      code: 'WORKSPACE_IDENTITY_MISSING',
      message: 'Consuelo Gateway requests require workspace identity from host/session scope.',
    });
  }

  if (session.workspaceHost !== request.host) {
    return decision(request, sourceModePolicy, false, {
      code: 'WORKSPACE_HOST_MISMATCH',
      message: 'Consuelo Gateway request host must match the session workspace host.',
    }, workspaceFromSession(session));
  }

  return decision(request, sourceModePolicy, true, undefined, workspaceFromSession(session));
}

export function canReadConsueloSite(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDecision {
  const resolved = resolveConsueloGatewayRequest(gateway, request);
  if (!resolved.ok) return resolved;

  const session = request.session;
  if (!session) return resolved;

  if (!session.allowedSites.includes(request.site)) {
    return decision(request, resolved.sourceModePolicy, false, {
      code: 'SITE_SCOPE_DENIED',
      message: 'The session is not entitled to access the requested Consuelo Site.',
    }, resolved.workspace);
  }

  if (!session.capabilities.includes(request.capability)) {
    return decision(request, resolved.sourceModePolicy, false, {
      code: 'CAPABILITY_SCOPE_DENIED',
      message: 'The session is not entitled to use the requested Consuelo Site capability.',
    }, resolved.workspace);
  }

  if (!session.sourceModesAllowed.includes(request.sourceMode)) {
    return decision(request, resolved.sourceModePolicy, false, {
      code: 'SOURCE_MODE_DENIED',
      message: 'The session is not entitled to use the requested source mode.',
    }, resolved.workspace);
  }

  return resolved;
}

export function discoverConsueloSiteServices(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayDiscovery {
  const scoped = canReadConsueloSite(gateway, request);
  const degradation = resolveGatewayDegradation(scoped.sourceModePolicy, request.session?.bridgeConfigured === true);
  if (!scoped.ok) {
    return {
      ok: false,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: scoped.workspace,
      site: request.site,
      capability: request.capability,
      sourceMode: request.sourceMode,
      sourceModePolicy: scoped.sourceModePolicy,
      services: [],
      degradation,
      error: scoped.error,
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
    workspace: scoped.workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy: scoped.sourceModePolicy,
    services,
    degradation,
  };
}

export function routeConsueloGatewayRequest(
  gateway: ConsueloSitesGateway,
  request: ConsueloGatewayRequest,
): ConsueloGatewayRouteResult {
  const discovery = discoverConsueloSiteServices(gateway, request);

  if (discovery.sourceModePolicy.bridgeRequired && request.session?.bridgeConfigured !== true) {
    return {
      ok: false,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: discovery.workspace,
      site: request.site,
      capability: request.capability,
      sourceMode: request.sourceMode,
      sourceModePolicy: discovery.sourceModePolicy,
      degradation: discovery.degradation,
      error: {
        code: 'BRIDGE_REQUIRED',
        message: 'Local off-network Consuelo Sites require a configured bridge before gateway routing is available.',
      },
    };
  }

  if (!discovery.ok) {
    return {
      ok: false,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: discovery.workspace,
      site: request.site,
      capability: request.capability,
      sourceMode: request.sourceMode,
      sourceModePolicy: discovery.sourceModePolicy,
      degradation: discovery.degradation,
      error: discovery.error,
    };
  }

  const route = discovery.services[0];
  if (!route) {
    return {
      ok: false,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: discovery.workspace,
      site: request.site,
      capability: request.capability,
      sourceMode: request.sourceMode,
      sourceModePolicy: discovery.sourceModePolicy,
      degradation: { state: 'unavailable', circuitState: 'open', retryPolicy: 'circuit-open' },
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: 'No Consuelo Gateway service is registered for the requested Site capability.',
      },
    };
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

function decision(
  request: ConsueloGatewayRequest,
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  ok: boolean,
  error?: ConsueloGatewayError,
  workspace?: ConsueloGatewayWorkspaceIdentity,
): ConsueloGatewayDecision {
  return {
    ok,
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    workspace,
    site: request.site,
    capability: request.capability,
    sourceMode: request.sourceMode,
    sourceModePolicy,
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

function resolveGatewayDegradation(
  sourceModePolicy: ConsueloGatewaySourceModePolicy,
  bridgeConfigured: boolean,
): ConsueloGatewayDegradation {
  if (sourceModePolicy.bridgeRequired && !bridgeConfigured) {
    return {
      state: 'bridge-required',
      circuitState: 'open',
      retryPolicy: 'manual-bridge-required',
    };
  }

  return {
    state: 'healthy',
    circuitState: 'closed',
    retryPolicy: 'normal',
  };
}

function toDiscoveryService(registration: ConsueloGatewayServiceRegistration): ConsueloGatewayDiscoveryService {
  return {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: registration.site,
    capability: registration.capability,
    serviceName: registration.serviceName,
    gatewayServiceName: registration.gatewayServiceName,
    backendServiceName: registration.backendServiceName,
    publicRouteFamily: registration.publicRouteFamily,
    cachePolicy: registration.cachePolicy,
    circuitState: registration.circuitState,
  };
}
