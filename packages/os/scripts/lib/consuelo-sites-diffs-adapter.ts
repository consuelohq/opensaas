import {
  createConsueloSiteServiceRegistry,
  registerConsueloSiteService,
} from './consuelo-sites-gateway-registry';
import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayServiceRegistration,
  type ConsueloSiteServiceRegistry,
} from './consuelo-sites-gateway-types';

const sourceModes = ['local-networked', 'cloud-compute', 'local-off-network'] as const;

export const CONSUELO_DIFFS_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'diffs',
    capability: 'diffs-read',
    serviceName: 'diffs-sites-read-endpoints',
    gatewayServiceName: 'diffs-sites-read-endpoints',
    gatewayAdapterName: 'diffs-sites-read-endpoints',
    publicSiteRouteFamily: '/diffs/*',
    gatewayRouteFamily: '/gateway/diffs/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'control-plane', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'diffs',
    capability: 'diffs-write',
    serviceName: 'diffs-sites-write-endpoints',
    gatewayServiceName: 'diffs-sites-write-endpoints',
    gatewayAdapterName: 'diffs-sites-write-endpoints',
    publicSiteRouteFamily: '/diffs/*',
    gatewayRouteFamily: '/gateway/diffs/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'write-through', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerDiffsConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_DIFFS_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createDiffsConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerDiffsConsueloSiteServices(createConsueloSiteServiceRegistry());
}
