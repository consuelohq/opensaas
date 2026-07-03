import {
  createConsueloSiteServiceRegistry,
  registerConsueloSiteService,
} from './consuelo-sites-gateway-registry';
import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayServiceRegistration,
  type ConsueloSiteServiceRegistry,
} from './consuelo-sites-gateway-types';

export const CONSUELO_SETTINGS_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'settings',
    capability: 'settings-read',
    serviceName: 'settings-sites-read-endpoints',
    gatewayServiceName: 'settings-sites-read-endpoints',
    gatewayAdapterName: 'settings-sites-read-endpoints',
    publicSiteRouteFamily: '/settings/*',
    gatewayRouteFamily: '/gateway/settings/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'materialized-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'settings',
    capability: 'settings-write',
    serviceName: 'settings-sites-write-endpoints',
    gatewayServiceName: 'settings-sites-write-endpoints',
    gatewayAdapterName: 'settings-sites-write-endpoints',
    publicSiteRouteFamily: '/settings/*',
    gatewayRouteFamily: '/gateway/settings/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'write-through', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerSettingsConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_SETTINGS_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createSettingsConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerSettingsConsueloSiteServices(createConsueloSiteServiceRegistry());
}