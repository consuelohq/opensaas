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

export type ConsueloGatewaySourceModePolicy = {
  sourceMode: ConsueloGatewaySourceMode;
  computeLocation: 'user-device' | 'consuelo-managed-runner';
  sitesHydration: 'consuelo-gateway' | 'bridge-required';
  requiresRelay: boolean;
  bridgeRequired: boolean;
  supportsRunnerControl: boolean;
};

export type ConsueloGatewayDegradation = {
  state: 'healthy' | 'degraded' | 'bridge-required' | 'unavailable';
  circuitState: ConsueloGatewayCircuitState['state'];
  retryPolicy: ConsueloGatewayCircuitState['retryPolicy'];
};

export type ConsueloGatewayServiceRegistration = {
  publicBoundary?: ConsueloGatewayPublicBoundary;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  serviceName: string;
  gatewayServiceName: string;
  gatewayAdapterName: string;
  publicSiteRouteFamily: string;
  gatewayRouteFamily: string;
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

export type ConsueloGatewayAllowDecision = {
  ok: true;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  degradation: ConsueloGatewayDegradation;
};

export type ConsueloGatewayDenyDecision = {
  ok: false;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace?: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  degradation: ConsueloGatewayDegradation;
  error: ConsueloGatewayError;
};

export type ConsueloGatewayDecision = ConsueloGatewayAllowDecision | ConsueloGatewayDenyDecision;

export type ConsueloGatewayDiscoveryService = {
  publicBoundary: ConsueloGatewayPublicBoundary;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  serviceName: string;
  gatewayServiceName: string;
  gatewayAdapterName: string;
  publicSiteRouteFamily: string;
  gatewayRouteFamily: string;
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

export type ConsueloGatewayRouteSuccess = {
  ok: true;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  route: ConsueloGatewayDiscoveryService;
  degradation: ConsueloGatewayDegradation;
};

export type ConsueloGatewayRouteFailure = {
  ok: false;
  publicBoundary: ConsueloGatewayPublicBoundary;
  workspace?: ConsueloGatewayWorkspaceIdentity;
  site: ConsueloSiteSlug;
  capability: ConsueloGatewayServiceCapability;
  sourceMode: ConsueloGatewaySourceMode;
  sourceModePolicy: ConsueloGatewaySourceModePolicy;
  degradation: ConsueloGatewayDegradation;
  error: ConsueloGatewayError;
};

export type ConsueloGatewayRouteResult = ConsueloGatewayRouteSuccess | ConsueloGatewayRouteFailure;

export type ConsueloSitesGateway = {
  publicBoundary: ConsueloGatewayPublicBoundary;
  registry: ConsueloSiteServiceRegistry;
  sourceModePolicy: Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy>;
};

export type ConsueloSitesGatewayOptions = {
  registry?: ConsueloSiteServiceRegistry;
  sourceModePolicy?: Partial<Record<ConsueloGatewaySourceMode, ConsueloGatewaySourceModePolicy>>;
};
