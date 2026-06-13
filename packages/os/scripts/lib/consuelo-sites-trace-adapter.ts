import {
  createConsueloSiteServiceRegistry,
  registerConsueloSiteService,
} from './consuelo-sites-gateway-registry';
import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayServiceRegistration,
  type ConsueloSiteServiceRegistry,
} from './consuelo-sites-gateway-types';

export const CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS: ConsueloGatewayServiceRegistration[] = [
  {
    publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
    site: 'trace',
    capability: 'trace-read',
    serviceName: 'trace-sites-read-layer',
    gatewayServiceName: 'trace-sites-read-layer',
    gatewayAdapterName: 'trace-sites-read-layer',
    publicSiteRouteFamily: '/traces/*',
    gatewayRouteFamily: '/gateway/traces/*',
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
    gatewayAdapterName: 'trace-sites-read-layer',
    publicSiteRouteFamily: '/traces/*',
    gatewayRouteFamily: '/gateway/traces/*',
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
    gatewayAdapterName: 'trace-sites-live-endpoints',
    publicSiteRouteFamily: '/traces/*',
    gatewayRouteFamily: '/gateway/traces/*',
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
    gatewayAdapterName: 'trace-sites-live-endpoints',
    publicSiteRouteFamily: '/traces/*',
    gatewayRouteFamily: '/gateway/traces/*',
    supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
    cachePolicy: { strategy: 'event-stream', ttlSeconds: 0 },
    circuitState: { state: 'closed', retryPolicy: 'normal' },
  },
];

export function registerTraceConsueloSiteServices(
  registry: ConsueloSiteServiceRegistry,
): ConsueloSiteServiceRegistry {
  return CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS.reduce(
    (nextRegistry, registration) => registerConsueloSiteService(nextRegistry, registration),
    registry,
  );
}

export function createTraceConsueloSiteServiceRegistry(): ConsueloSiteServiceRegistry {
  return registerTraceConsueloSiteServices(createConsueloSiteServiceRegistry());
}
