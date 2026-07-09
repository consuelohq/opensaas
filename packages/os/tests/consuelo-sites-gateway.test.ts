import { describe, expect, it } from 'vitest';

import {
  CONSUELO_GATEWAY_PUBLIC_BOUNDARY,
  authorizeConsueloGatewayRequest,
  canReadConsueloSite,
  createConsueloSitesGateway,
  discoverConsueloSiteServices,
  resolveConsueloGatewayRequest,
  routeConsueloGatewayRequest,
} from '../scripts/lib/consuelo-sites-gateway';
import { createConsueloSiteServiceRegistry, registerConsueloSiteService } from '../scripts/lib/consuelo-sites-gateway-registry';
import { createTraceConsueloSiteServiceRegistry } from '../scripts/lib/consuelo-sites-trace-adapter';
import type { ConsueloGatewayRequest, ConsueloGatewaySessionScope } from '../scripts/lib/consuelo-sites-gateway-types';

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

function traceGateway() {
  return createConsueloSitesGateway({ registry: createTraceConsueloSiteServiceRegistry() });
}

describe('Consuelo Sites Gateway contract service', () => {
  it('should resolve workspace identity when request contains host/session scope', () => {
    const decision = resolveConsueloGatewayRequest(traceGateway(), request());

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
    const decision = resolveConsueloGatewayRequest(traceGateway(), request({
      session: { ...baseScope, workspaceId: '', workspaceHost: '' },
    }));

    expect(decision).toMatchObject({
      ok: false,
      publicBoundary: 'consuelo-gateway',
      error: { code: 'WORKSPACE_IDENTITY_MISSING' },
    });
  });

  it('should deny access when requested Site is not allowed', () => {
    const decision = canReadConsueloSite(traceGateway(), request({
      session: { ...baseScope, allowedSites: ['trace'] },
      site: 'trace-burn-intelligence',
    }));

    expect(decision).toMatchObject({
      ok: false,
      error: { code: 'SITE_SCOPE_DENIED' },
    });
  });

  it('should authorize generically before gateway routing', () => {
    const decision = authorizeConsueloGatewayRequest(traceGateway(), request());

    expect(decision.ok).toBe(true);
    if (!decision.ok) throw new Error('expected authorization to pass');
    expect(decision.workspace.workspaceId).toBe('wrk_gateway');
    expect(decision.degradation.state).toBe('healthy');
  });

  it('should route Trace Site read capability through the registered Trace adapter service', () => {
    const result = routeConsueloGatewayRequest(traceGateway(), request({ capability: 'trace-read' }));

    expect(result).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      route: {
        publicSiteRouteFamily: '/traces/*',
        gatewayRouteFamily: '/gateway/traces/*',
        gatewayServiceName: 'trace-sites-read-layer',
        gatewayAdapterName: 'trace-sites-read-layer',
        capability: 'trace-read',
        site: 'trace-burn-intelligence',
      },
    });
  });

  it('should not expose local DB, local agent, cloud runner, trace files, or raw internal service targets', () => {
    const result = routeConsueloGatewayRequest(traceGateway(), request());
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      `local-${'trace'}-db`,
      `local-${'agent'}`,
      `cloud-${'runner'}`,
      `trace-${'store'}-file`,
      `raw-${'trace'}-service`,
      'directBackendTarget',
      'backendTarget',
      'backendServiceName',
      'implementationPath',
      'sqlite',
      '.db',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('should return bridge-required/degraded state for local-off-network without a bridge', () => {
    const result = routeConsueloGatewayRequest(traceGateway(), request({ sourceMode: 'local-off-network' }));

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

  it('should expose service discovery as gateway service names and route families', () => {
    const discovery = discoverConsueloSiteServices(traceGateway(), request());

    expect(discovery).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-gateway',
      services: [expect.objectContaining({
        gatewayServiceName: 'trace-sites-read-layer',
        gatewayAdapterName: 'trace-sites-read-layer',
        capability: 'trace-read',
        publicSiteRouteFamily: '/traces/*',
        gatewayRouteFamily: '/gateway/traces/*',
      })],
    });
    expect(JSON.stringify(discovery)).not.toContain('implementationPath');
    expect(JSON.stringify(discovery)).not.toContain(`local-${'agent'}`);
    expect(JSON.stringify(discovery)).not.toContain('backendServiceName');
  });

  it('should support registering future Sites without changing Trace-specific code', () => {
    const registry = registerConsueloSiteService(createConsueloSiteServiceRegistry(), {
      site: 'office',
      capability: 'office-read',
      gatewayServiceName: 'office-sites-read-layer',
      serviceName: 'office-sites-read-layer',
      gatewayAdapterName: 'office-sites-read-layer',
      publicSiteRouteFamily: '/office/*',
      gatewayRouteFamily: '/gateway/office/*',
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
        publicSiteRouteFamily: '/office/*',
        gatewayRouteFamily: '/gateway/office/*',
      },
    });
  });

  it('should keep Trace read/live layer as adapters under the generic gateway', () => {
    const discovery = discoverConsueloSiteServices(traceGateway(), request({ capability: 'trace-live' }));

    expect(discovery.ok).toBe(true);
    expect(discovery.services).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-live',
        gatewayServiceName: 'trace-sites-live-endpoints',
        gatewayAdapterName: 'trace-sites-live-endpoints',
        publicSiteRouteFamily: '/traces/*',
        gatewayRouteFamily: '/gateway/traces/*',
      }),
    ]));
    expect(discovery.services.every((service) => service.publicBoundary === 'consuelo-gateway')).toBe(true);
  });

  it('should allow Trace to be absent without changing generic gateway core behavior', () => {
    const gateway = createConsueloSitesGateway({ registry: createConsueloSiteServiceRegistry() });
    const authorization = authorizeConsueloGatewayRequest(gateway, request());
    const route = routeConsueloGatewayRequest(gateway, request());

    expect(authorization.ok).toBe(true);
    expect(route).toMatchObject({
      ok: false,
      error: { code: 'SERVICE_NOT_FOUND' },
    });
  });
});
