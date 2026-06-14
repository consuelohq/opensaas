import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayServiceDiscoveryQuery,
  type ConsueloGatewayServiceRegistration,
  type ConsueloSiteServiceRegistry,
} from './consuelo-sites-gateway-types';

export {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  type ConsueloGatewayCachePolicy,
  type ConsueloGatewayCircuitState,
  type ConsueloGatewayPublicBoundary,
  type ConsueloGatewayServiceCapability,
  type ConsueloGatewayServiceRegistration,
  type ConsueloGatewaySourceMode,
  type ConsueloSiteServiceRegistry,
  type ConsueloSiteSlug,
} from './consuelo-sites-gateway-types';

const IMPLEMENTATION_TARGET_LABELS = [
  ['local', 'trace', 'db'].join('-'),
  ['local', 'agent'].join('-'),
  ['cloud', 'runner'].join('-'),
  ['trace', 'store', 'file'].join('-'),
  ['raw', 'trace', 'service'].join('-'),
  'sqlite',
  '.db',
] as const;

export function createConsueloSiteServiceRegistry(
  registrations: ConsueloGatewayServiceRegistration[] = [],
): ConsueloSiteServiceRegistry {
  return registrations.map(normalizeServiceRegistration);
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
    registration.gatewayAdapterName,
    registration.publicSiteRouteFamily,
    registration.gatewayRouteFamily,
  ].join(' ');

  if (IMPLEMENTATION_TARGET_LABELS.some((label) => descriptor.includes(label))) {
    throw new Error('implementation targets cannot be registered as Consuelo Gateway services');
  }
}
