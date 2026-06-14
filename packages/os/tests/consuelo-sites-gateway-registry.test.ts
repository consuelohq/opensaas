import { describe, expect, it } from 'vitest';

import {
  createConsueloSiteServiceRegistry,
  discoverRegisteredConsueloSiteServices,
  registerConsueloSiteService,
} from '../scripts/lib/consuelo-sites-gateway-registry';

describe('Consuelo Sites Gateway service registry', () => {
  it('should start as a generic registry without Trace registrations', () => {
    expect(createConsueloSiteServiceRegistry()).toEqual([]);
  });

  it('should discover services by Site and capability', () => {
    const registry = registerConsueloSiteService(createConsueloSiteServiceRegistry(), {
      site: 'office',
      capability: 'office-read',
      serviceName: 'office-sites-read-layer',
      gatewayServiceName: 'office-sites-read-layer',
      gatewayAdapterName: 'office-sites-read-layer',
      publicSiteRouteFamily: '/office/*',
      gatewayRouteFamily: '/gateway/office/*',
      publicBoundary: 'consuelo-gateway',
      supportedSourceModes: ['local-networked', 'cloud-compute'],
      cachePolicy: { strategy: 'materialized-window', ttlSeconds: 60 },
      circuitState: { state: 'closed', retryPolicy: 'normal' },
    });

    const services = discoverRegisteredConsueloSiteServices(registry, {
      site: 'office',
      capability: 'office-read',
      sourceMode: 'cloud-compute',
    });

    expect(services).toEqual([
      expect.objectContaining({
        serviceName: 'office-sites-read-layer',
        gatewayServiceName: 'office-sites-read-layer',
        gatewayAdapterName: 'office-sites-read-layer',
        publicSiteRouteFamily: '/office/*',
        gatewayRouteFamily: '/gateway/office/*',
      }),
    ]);
  });

  it('should keep registered routes gateway-shaped and hide implementation fields', () => {
    const registry = registerConsueloSiteService(createConsueloSiteServiceRegistry(), {
      site: 'dashboard',
      capability: 'dashboard-read',
      serviceName: 'dashboard-sites-read-layer',
      gatewayServiceName: 'dashboard-sites-read-layer',
      gatewayAdapterName: 'dashboard-sites-read-layer',
      publicSiteRouteFamily: '/dashboard/*',
      gatewayRouteFamily: '/gateway/dashboard/*',
      publicBoundary: 'consuelo-gateway',
      supportedSourceModes: ['local-networked', 'cloud-compute'],
      cachePolicy: { strategy: 'materialized-window', ttlSeconds: 60 },
      circuitState: { state: 'closed', retryPolicy: 'normal' },
    });
    const serialized = JSON.stringify(registry);

    expect(serialized).not.toContain('backendServiceName');
    expect(serialized).not.toContain('implementationPath');
  });

  it('should support future Site registration without editing Trace registrations', () => {
    const baseRegistry = createConsueloSiteServiceRegistry();
    const registry = registerConsueloSiteService(baseRegistry, {
      site: 'dashboard',
      capability: 'dashboard-read',
      serviceName: 'dashboard-sites-read-layer',
      gatewayServiceName: 'dashboard-sites-read-layer',
      gatewayAdapterName: 'dashboard-sites-read-layer',
      publicSiteRouteFamily: '/dashboard/*',
      gatewayRouteFamily: '/gateway/dashboard/*',
      publicBoundary: 'consuelo-gateway',
      supportedSourceModes: ['local-networked', 'cloud-compute'],
      cachePolicy: { strategy: 'materialized-window', ttlSeconds: 60 },
      circuitState: { state: 'closed', retryPolicy: 'normal' },
    });

    expect(registry).toHaveLength(baseRegistry.length + 1);
    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'dashboard',
      capability: 'dashboard-read',
      sourceMode: 'cloud-compute',
    })).toEqual([
      expect.objectContaining({
        site: 'dashboard',
        capability: 'dashboard-read',
        serviceName: 'dashboard-sites-read-layer',
      }),
    ]);
  });
});
