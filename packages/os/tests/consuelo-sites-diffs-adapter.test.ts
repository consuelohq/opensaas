import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_DIFFS_SITE_SERVICE_REGISTRATIONS,
  createDiffsConsueloSiteServiceRegistry,
  registerDiffsConsueloSiteServices,
} from '../scripts/lib/consuelo-sites-diffs-adapter';

describe('Consuelo Sites Diffs adapter registration', () => {
  it('registers separate read and write capabilities behind the Consuelo gateway', () => {
    expect(CONSUELO_DIFFS_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'diffs',
        capability: 'diffs-read',
        gatewayServiceName: 'diffs-sites-read-endpoints',
        gatewayAdapterName: 'diffs-sites-read-endpoints',
        publicSiteRouteFamily: '/diffs/*',
        gatewayRouteFamily: '/gateway/diffs/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'diffs',
        capability: 'diffs-write',
        gatewayServiceName: 'diffs-sites-write-endpoints',
        gatewayAdapterName: 'diffs-sites-write-endpoints',
        publicSiteRouteFamily: '/diffs/*',
        gatewayRouteFamily: '/gateway/diffs/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
  });

  it('discovers Diffs services from the generic registry', () => {
    const registry = registerDiffsConsueloSiteServices([]);
    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'diffs',
      capability: 'diffs-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({ serviceName: 'diffs-sites-read-endpoints' }),
    ]);
  });

  it('does not expose implementation-path or credential fields', () => {
    const serialized = JSON.stringify(createDiffsConsueloSiteServiceRegistry());
    expect(serialized).not.toContain('implementationPath');
    expect(serialized).not.toContain('backendServiceName');
    expect(serialized).not.toContain('credential');
    expect(serialized).not.toContain('token');
  });
});
