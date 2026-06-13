import { describe, expect, it } from 'vitest';

import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  canReadConsueloSite,
  createConsueloSitesGateway,
  discoverConsueloSiteServices,
  resolveConsueloGatewayRequest,
  routeConsueloGatewayRequest,
  type ConsueloGatewayRequest,
  type ConsueloGatewaySessionScope,
} from '../scripts/lib/consuelo-sites-gateway';
import {
  createDefaultConsueloSiteServiceRegistry,
  registerConsueloSiteService,
} from '../scripts/lib/consuelo-sites-gateway-registry';

const baseScope: ConsueloGatewaySessionScope = {
  userId: 'usr_gateway',
  workspaceId: 'wrk_gateway',
  workspaceHost: 'testing.consuelohq.com',
  allowedSites: ['trace', 'trace-burn-intelligence'],
  capabilities: ['trace-read', 'trace-live'],
  sourceModesAllowed: ['local-networked', 'cloud-compute', 'local-off-network'],
  bridgeConfigured: false,
};

function request(overrides: Partial<ConsueloGatewayRequest> = {}): ConsueloGatewayRequest {
  return {
    host: 'testing.consuelohq.com',
    site: 'trace-burn-intelligence',
    capability: 'trace-read',
    sourceMode: 'local-networked',
    publicPath: '/traces',
    session: baseScope,
    ...overrides,
  };
}

describe('Consuelo Sites Gateway contract service', () => {
  it('should resolve workspace identity when request contains host/session scope', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const decision = resolveConsueloGatewayRequest(gateway, request());

    expect(decision).toMatchObject({
      ok: true,
      publicBoundary: CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
      workspace: {
        workspaceId: 'wrk_gateway',
        workspaceHost: 'testing.consuelohq.com',
      },
      site: 'trace-burn-intelligence',
      capability: 'trace-read',
      sourceMode: 'local-networked',
    });
  });

  it('should deny access when workspace identity is missing', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const decision = resolveConsueloGatewayRequest(gateway, request({
      session: { ...baseScope, workspaceId: '', workspaceHost: '' },
    }));

    expect(decision).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      error: { code: 'WORKSPACE_IDENTITY_MISSING' },
    });
  });

  it('should deny access when requested Site is not allowed', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const decision = canReadConsueloSite(gateway, request({
      session: { ...baseScope, allowedSites: ['trace'] },
      site: 'trace-burn-intelligence',
    }));

    expect(decision).toMatchObject({
      ok: false,
      error: { code: 'SITE_SCOPE_DENIED' },
    });
  });

  it('should route Trace Site read capability through the registered Trace gateway service', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const result = routeConsueloGatewayRequest(gateway, request({ capability: 'trace-read' }));

    expect(result).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: {
        publicRouteFamily: '/traces/*',
        gatewayServiceName: 'trace-sites-read-layer',
        capability: 'trace-read',
        site: 'trace-burn-intelligence',
      },
    });
  });

  it('should not expose local DB, local agent, cloud runner, trace files, or raw internal service targets', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const result = routeConsueloGatewayRequest(gateway, request());
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      `local-${'trace'}-db`,
      `local-${'agent'}`,
      `cloud-${'runner'}`,
      `trace-${'store'}-file`,
      `raw-${'trace'}-service`,
      'directBackendTarget',
      'backendTarget',
      'implementationPath',
      'sqlite',
      '.db',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('should preserve local-networked, cloud-compute, and local-off-network source-mode semantics generically', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    expect(gateway.sourceModePolicy).toMatchObject({
      'local-networked': {
        computeLocation: 'user-device',
        requiresRelay: true,
        sitesHydration: 'consuelo-gateway',
      },
      'cloud-compute': {
        computeLocation: 'consuelo-managed-runner',
        requiresRelay: false,
        supportsRunnerControl: true,
        sitesHydration: 'consuelo-gateway',
      },
      'local-off-network': {
        computeLocation: 'user-device',
        bridgeRequired: true,
        sitesHydration: 'bridge-required',
      },
    });
  });

  it('should return bridge-required/degraded state for local-off-network without a bridge', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const result = routeConsueloGatewayRequest(gateway, request({ sourceMode: 'local-off-network' }));

    expect(result).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      error: { code: 'BRIDGE_REQUIRED' },
      degradation: {
        state: 'bridge-required',
        circuitState: 'open',
        retryPolicy: 'manual-bridge-required',
      },
    });
  });

  it('should expose service discovery as gateway service names, not backend implementation paths', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const discovery = discoverConsueloSiteServices(gateway, request());

    expect(discovery).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      services: [expect.objectContaining({
        gatewayServiceName: 'trace-sites-read-layer',
        serviceName: 'trace-sites-read-layer',
        capability: 'trace-read',
        publicRouteFamily: '/traces/*',
      })],
    });
    expect(JSON.stringify(discovery)).not.toContain('implementationPath');
    expect(JSON.stringify(discovery)).not.toContain(`local-${'agent'}`);
  });

  it('should support registering future Sites without changing Trace-specific code', () => {
    const registry = registerConsueloSiteService(createDefaultConsueloSiteServiceRegistry(), {
      site: 'office',
      capability: 'office-read',
      gatewayServiceName: 'office-sites-read-layer',
      serviceName: 'office-sites-read-layer',
      backendServiceName: 'office-sites-read-layer',
      publicRouteFamily: '/office/*',
      supportedSourceModes: ['local-networked', 'cloud-compute'],
      cachePolicy: { strategy: 'materialized-window', ttlSeconds: 30 },
      circuitState: { state: 'closed', retryPolicy: 'normal' },
    });
    const gateway = createConsueloSitesGateway({ registry });

    const result = routeConsueloGatewayRequest(gateway, request({
      site: 'office',
      capability: 'office-read',
      publicPath: '/office',
      session: {
        ...baseScope,
        allowedSites: ['office'],
        capabilities: ['office-read'],
      },
    }));

    expect(result).toMatchObject({
      ok: true,
      route: {
        site: 'office',
        capability: 'office-read',
        gatewayServiceName: 'office-sites-read-layer',
        publicRouteFamily: '/office/*',
      },
    });
  });

  it('should keep Trace read/live layer as backend adapters under the generic gateway', () => {
    const gateway = createConsueloSitesGateway({ registry: createDefaultConsueloSiteServiceRegistry() });

    const discovery = discoverConsueloSiteServices(gateway, request({ capability: 'trace-live' }));

    expect(discovery.ok).toBe(true);
    expect(discovery.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-live',
        gatewayServiceName: 'trace-sites-live-endpoints',
        backendServiceName: 'trace-sites-live-endpoints',
        publicRouteFamily: '/traces/*',
      }),
    ]));
    expect(discovery.services.every((service) => service.publicBoundary === 'consuelo-gateway')).toBe(true);
  });
});
