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

/** Metadata reads plus sealed-envelope writes. Credential plaintext never enters the gateway. */
export const CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'secrets',
    capability: 'secrets-read',
    serviceName: 'secrets-sites-read-endpoints',
    gatewayServiceName: 'secrets-sites-read-endpoints',
    gatewayAdapterName: 'secrets-sites-read-endpoints',
    publicSiteRouteFamily: '/secrets/*',
    gatewayRouteFamily: '/gateway/secrets/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'control-plane', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'secrets',
    capability: 'secrets-write',
    serviceName: 'secrets-sites-write-endpoints',
    gatewayServiceName: 'secrets-sites-write-endpoints',
    gatewayAdapterName: 'secrets-sites-write-endpoints',
    publicSiteRouteFamily: '/secrets/*',
    gatewayRouteFamily: '/gateway/secrets/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'control-plane', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerSecretConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createSecretConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerSecretConsueloSiteServices(createConsueloSiteServiceRegistry());
}
