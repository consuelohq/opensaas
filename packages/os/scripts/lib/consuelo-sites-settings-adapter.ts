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

export const CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'configuration',
    capability: 'configuration-read',
    serviceName: 'configuration-sites-read-endpoints',
    gatewayServiceName: 'configuration-sites-read-endpoints',
    gatewayAdapterName: 'configuration-sites-read-endpoints',
    publicSiteRouteFamily: '/configuration/*',
    gatewayRouteFamily: '/gateway/configuration/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'materialized-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'configuration',
    capability: 'configuration-write',
    serviceName: 'configuration-sites-write-endpoints',
    gatewayServiceName: 'configuration-sites-write-endpoints',
    gatewayAdapterName: 'configuration-sites-write-endpoints',
    publicSiteRouteFamily: '/configuration/*',
    gatewayRouteFamily: '/gateway/configuration/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'write-through', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'settings',
    capability: 'settings-read',
    serviceName: 'configuration-sites-read-endpoints',
    gatewayServiceName: 'configuration-sites-read-endpoints',
    gatewayAdapterName: 'configuration-sites-read-endpoints',
    publicSiteRouteFamily: '/settings/*',
    gatewayRouteFamily: '/gateway/settings/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'materialized-window', ttlSeconds: 10 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'settings',
    capability: 'settings-write',
    serviceName: 'configuration-sites-write-endpoints',
    gatewayServiceName: 'configuration-sites-write-endpoints',
    gatewayAdapterName: 'configuration-sites-write-endpoints',
    publicSiteRouteFamily: '/settings/*',
    gatewayRouteFamily: '/gateway/settings/*',
    supportedSourceModes: [...sourceModes],
    cachePolicy: { strategy: 'write-through', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerConfigurationConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createConfigurationConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerConfigurationConsueloSiteServices(createConsueloSiteServiceRegistry());
}

export const CONSUELO_SETTINGS_SITE_SERVICE_REGISTRATIONS = CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS;
export const registerSettingsConsueloSiteServices = registerConfigurationConsueloSiteServices;
export const createSettingsConsueloSiteServiceRegistry = createConfigurationConsueloSiteServiceRegistry;
