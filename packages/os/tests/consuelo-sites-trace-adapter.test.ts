import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS,
  createTraceConsueloSiteServiceRegistry,
  registerTraceConsueloSiteServices,
} from '../scripts/lib/consuelo-sites-trace-adapter';

describe('Consuelo Sites Trace adapter registration', () => {
  it('should register Trace read and live as first concrete gateway service adapters', () => {
    expect(CONSUELO_TRACE_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-read',
        gatewayServiceName: 'trace-sites-read-layer',
        gatewayAdapterName: 'trace-sites-read-layer',
        publicSiteRouteFamily: '/traces/*',
        gatewayRouteFamily: '/gateway/traces/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'trace-burn-intelligence',
        capability: 'trace-live',
        gatewayServiceName: 'trace-sites-live-endpoints',
        gatewayAdapterName: 'trace-sites-live-endpoints',
        publicSiteRouteFamily: '/traces/*',
        gatewayRouteFamily: '/gateway/traces/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
  });

  it('should register Trace services into a generic registry', () => {
    const registry = registerTraceConsueloSiteServices([]);

    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'trace-burn-intelligence',
      capability: 'trace-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({
        serviceName: 'trace-sites-read-layer',
        gatewayServiceName: 'trace-sites-read-layer',
        gatewayAdapterName: 'trace-sites-read-layer',
      }),
    ]);
  });

  it('should create a Trace registry without implementation-path fields', () => {
    const serialized = JSON.stringify(createTraceConsueloSiteServiceRegistry());

    expect(serialized).toContain('trace-sites-read-layer');
    expect(serialized).toContain('/traces/*');
    expect(serialized).toContain('/gateway/traces/*');
    expect(serialized).not.toContain('backendServiceName');
    expect(serialized).not.toContain('implementationPath');
  });
});
