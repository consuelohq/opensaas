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

export const CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'environments',
    capability: 'environments-read',
    serviceName: 'environment-sites-read-endpoints',
    gatewayServiceName: 'environment-sites-read-endpoints',
    gatewayAdapterName: 'environment-sites-read-endpoints',
    publicSiteRouteFamily: '/environments/*',
    gatewayRouteFamily: '/gateway/environments/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'control-plane', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'environments',
    capability: 'environments-write',
    serviceName: 'environment-sites-write-endpoints',
    gatewayServiceName: 'environment-sites-write-endpoints',
    gatewayAdapterName: 'environment-sites-write-endpoints',
    publicSiteRouteFamily: '/environments/*',
    gatewayRouteFamily: '/gateway/environments/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'write-through', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerEnvironmentConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createEnvironmentConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerEnvironmentConsueloSiteServices(createConsueloSiteServiceRegistry());
}
