import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS,
  createEnvironmentConsueloSiteServiceRegistry,
} from '../scripts/lib/consuelo-sites-environment-adapter';

describe('Consuelo Sites Environment adapter registration', () => {
  it('registers separate read and write environment services', () => {
    expect(CONSUELO_ENVIRONMENT_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'environments',
        capability: 'environments-read',
        serviceName: 'environment-sites-read-endpoints',
        publicSiteRouteFamily: '/environments/*',
        gatewayRouteFamily: '/gateway/environments/*',
      }),
      expect.objectContaining({
        site: 'environments',
        capability: 'environments-write',
        serviceName: 'environment-sites-write-endpoints',
        publicSiteRouteFamily: '/environments/*',
        gatewayRouteFamily: '/gateway/environments/*',
      }),
    ]));
  });

  it('supports generic discovery without implementation-path leakage', () => {
    const registry = createEnvironmentConsueloSiteServiceRegistry();
    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'environments',
      capability: 'environments-read',
      sourceMode: 'local-networked',
    })).toHaveLength(1);
    expect(JSON.stringify(registry)).not.toMatch(/implementationPath|backendServiceName|sqlite|.db/i);
  });
});
