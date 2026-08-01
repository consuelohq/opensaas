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

/**
 * Read-only by design. The Secrets surface lists which bindings exist and where they are
 * installed; it never returns, reveals, or proxies a credential value. Values leave the sealed
 * store only through the broker, which takes an operation and hands back a result.
 */
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
