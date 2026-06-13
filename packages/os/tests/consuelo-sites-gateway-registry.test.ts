import { describe, expect, it } from 'vitest';

import {
  CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS,
  createConsueloSiteServiceRegistry,
  createDefaultConsueloSiteServiceRegistry,
  discoverRegisteredConsueloSiteServices,
  registerConsueloSiteService,
} from '../scripts/lib/consuelo-sites-gateway-registry';

describe('Consuelo Sites Gateway service registry', () => {
  it('should register Trace read and live as the first concrete gateway service adapters', () => {
    expect(CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-read',
        gatewayServiceName: 'trace-sites-read-layer',
        backendServiceName: 'trace-sites-read-layer',
        publicRouteFamily: '/traces/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-live',
        gatewayServiceName: 'trace-sites-live-endpoints',
        backendServiceName: 'trace-sites-live-endpoints',
        publicRouteFamily: '/traces/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
  });

  it('should discover services by Site and capability', () => {
    const registry = createDefaultConsueloSiteServiceRegistry();

    const services = discoverRegisteredConsueloSiteServices(registry, {
      site: 'trace-burn-intelligence',
      capability: 'trace-read',
      sourceMode: 'local-networked',
    });

    expect(services).toEqual([
      expect.objectContaining({
        serviceName: 'trace-sites-read-layer',
        gatewayServiceName: 'trace-sites-read-layer',
        publicRouteFamily: '/traces/*',
      }),
    ]);
  });

  it('should keep registered routes gateway-shaped and hide direct backend implementation targets', () => {
    const registry = createDefaultConsueloSiteServiceRegistry();
    const serialized = JSON.stringify(registry);

    expect(serialized).toContain('trace-sites-read-layer');
    for (const forbidden of [
      `local-${'trace'}-db`,
      `local-${'agent'}`,
      `cloud-${'runner'}`,
      `trace-${'store'}-file`,
      `raw-${'trace'}-service`,
      'implementationPath',
      'backendTarget',
      'directBackendTarget',
      'sqlite',
      '.db',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('should support future Site registration without editing Trace registrations', () => {
    const baseRegistry = createDefaultConsueloSiteServiceRegistry();
    const registry = registerConsueloSiteService(baseRegistry, {
      site: 'dashboard',
      capability: 'dashboard-read',
      serviceName: 'dashboard-sites-read-layer',
      gatewayServiceName: 'dashboard-sites-read-layer',
      backendServiceName: 'dashboard-sites-read-layer',
      publicRouteFamily: '/dashboard/*',
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
    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'trace-burn-intelligence',
      capability: 'trace-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({ serviceName: 'trace-sites-read-layer' }),
    ]);
  });

  it('should reject direct backend target registration', () => {
    expect(() => registerConsueloSiteService(createConsueloSiteServiceRegistry(), {
      site: 'trace-burn-intelligence',
      capability: 'trace-read',
      serviceName: `local-${'trace'}-db`,
      gatewayServiceName: `local-${'trace'}-db`,
      backendServiceName: `local-${'trace'}-db`,
      publicRouteFamily: '/traces/*',
      publicBoundary: 'consuelo-gateway',
      supportedSourceModes: ['local-networked'],
      cachePolicy: { strategy: 'none', ttlSeconds: 0 },
      circuitState: { state: 'closed', retryPolicy: 'normal' },
    })).toThrow('direct backend targets cannot be registered as Consuelo Gateway services');
  });
});
