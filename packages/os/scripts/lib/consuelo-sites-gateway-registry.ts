export const CONSUELO_GATEWAY_PUBLIC_BOUNDARY = 'consuelo-gateway' as const;

export type ConsueloGatewayPublicBoundary = typeof CONSUELO_GATEWAY_PUBLIC_BOUNDARY;
export type ConsueloSiteSlug = 'trace' | 'trace-burn-intelligence' | (string & {});
export type ConsueloGatewaySourceMode = 'local-networked' | 'cloud-compute' | 'local-off-network';
export type ConsueloGatewayServiceCapability =
  | 'trace-read'
  | 'trace-live'
  | 'trace-ingest'
  | 'runner-control'
  | (string & {});

export type ConsueloGatewayCachePolicy = {
  strategy: 'cursor-window' | 'materialized-window' | 'event-stream' | 'write-through' | 'control-plane' | 'none';
  ttlSeconds: number;
};

export type ConsueloGatewayCircuitState = {
  state: 'closed' | 'degraded' | 'open';
  retryPolicy: 'normal' | 'backoff' | 'circuit-open' | 'manual-bridge-required';
};

export type ConsueloGatewayServiceRegistration = {
  publicBoundary?: ConsueloGatewayPublicBoundary;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  serviceName: string;
  gatewayServiceName: string;
  backendServiceName: string;
  publicRouteFamily: string;
  supportedSourceModes: ConsueloGatewaySourceMode[];
  cachePolicy: ConsueloGatewayCachePolicy;
  circuitState: ConsueloGatewayCircuitState;
};

export type ConsueloGatewayServiceDiscoveryQuery = {
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
};

export type ConsueloSiteServiceRegistry = ConsueloGatewayServiceRegistration[];

const DIRECT_BACKEND_TARGETS = [
  'local-trace-db',
  'local-agent',
  'cloud-runner',
  'trace-store-file',
  'raw-trace-service',
  'sqlite',
  '.db',
] as const;

export const CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'trace',
    capability: 'trace-read',
    serviceName: 'trace-sites-read-layer',
    gatewayServiceName: 'trace-sites-read-layer',
    backendServiceName: 'trace-sites-read-layer',
    publicRouteFamily: '/traces/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'cursor-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'trace-burn-intelligence',
    capability: 'trace-read',
    serviceName: 'trace-sites-read-layer',
    gatewayServiceName: 'trace-sites-read-layer',
    backendServiceName: 'trace-sites-read-layer',
    publicRouteFamily: '/traces/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'materialized-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'trace',
    capability: 'trace-live',
    serviceName: 'trace-sites-live-endpoints',
    gatewayServiceName: 'trace-sites-live-endpoints',
    backendServiceName: 'trace-sites-live-endpoints',
    publicRouteFamily: '/traces/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'event-stream', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'trace-burn-intelligence',
    capability: 'trace-live',
    serviceName: 'trace-sites-live-endpoints',
    gatewayServiceName: 'trace-sites-live-endpoints',
    backendServiceName: 'trace-sites-live-endpoints',
    publicRouteFamily: '/traces/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'event-stream', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function createConsueloSiteServiceRegistry(
  registrations: ConsueloGatewayServiceRegistration[] = [],
): ConsueloSiteServiceRegistry {
  return registrations.map(normalizeServiceRegistration);
}

export function createDefaultConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return createConsueloSiteServiceRegistry(CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS);
}

export function registerConsueloSiteService(
  registry: ConsueloSiteServiceRegistry,
  registration: ConsueloGatewayServiceRegistration,
): ConsueloSiteServiceRegistry {
  return [...registry, normalizeServiceRegistration(registration)];
}

export function discoverRegisteredConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
  query: ConsueloGatewayServiceDiscoveryQuery,
): ConsueloGatewayServiceRegistration[] {
  return registry.filter((registration) => (
    registration.site === query.site
    && registration.capability === query.capability
    && registration.supportedSourceModes.includes(query.sourceMode)
  ));
}

function normalizeServiceRegistration(registration: ConsueloGatewayServiceRegistration): ConsueloGatewayServiceRegistration {
  const normalized = {
    ...registration,
    publicBoundary: registration.publicBoundary ?? CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  } satisfies ConsueloGatewayServiceRegistration;

  assertGatewayServiceRegistration(normalized);
  return normalized;
}

function assertGatewayServiceRegistration(registration: ConsueloGatewayServiceRegistration): void {
  if (registration.publicBoundary !== CONSUELO_GATEWAY_PUBLIC_BOUNDARY) {
    throw new Error('Consuelo Gateway services must use the consuelo-gateway public boundary');
  }

  const descriptor = [
    registration.serviceName,
    registration.gatewayServiceName,
    registration.backendServiceName,
  ].join(' ');

  if (DIRECT_BACKEND_TARGETS.some((target) => descriptor.includes(target))) {
    throw new Error('direct backend targets cannot be registered as Consuelo Gateway services');
  }
}
