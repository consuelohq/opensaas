import {
  createConsueloSiteServiceRegistry,
  registerConsueloSiteService,
} from './consuelo-sites-gateway-registry';
import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayServiceRegistration,
  type ConsueloSiteServiceRegistry,
} from './consuelo-sites-gateway-types';

export const CONSUELO_ARTIFACTS_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'artifacts',
    capability: 'artifacts-read',
    serviceName: 'artifacts-sites-read-layer',
    gatewayServiceName: 'artifacts-sites-read-layer',
    gatewayAdapterName: 'artifacts-sites-read-layer',
    publicSiteRouteFamily: '/artifacts/*',
    gatewayRouteFamily: '/gateway/artifacts/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'materialized-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerArtifactsConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_ARTIFACTS_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createArtifactsConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerArtifactsConsueloSiteServices(createConsueloSiteServiceRegistry());
}
