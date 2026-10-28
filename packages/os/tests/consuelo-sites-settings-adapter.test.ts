import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS,
  createConfigurationConsueloSiteServiceRegistry,
  registerConfigurationConsueloSiteServices,
} from '../scripts/lib/consuelo-sites-settings-adapter';

describe('Consuelo Sites Configuration adapter registration', () => {
  it('registers canonical Configuration read and write gateway adapters', () => {
    expect(CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'configuration',
        capability: 'configuration-read',
        gatewayServiceName: 'configuration-sites-read-endpoints',
        gatewayAdapterName: 'configuration-sites-read-endpoints',
        publicSiteRouteFamily: '/configuration/*',
        gatewayRouteFamily: '/gateway/configuration/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'configuration',
        capability: 'configuration-write',
        gatewayServiceName: 'configuration-sites-write-endpoints',
        gatewayAdapterName: 'configuration-sites-write-endpoints',
        publicSiteRouteFamily: '/configuration/*',
        gatewayRouteFamily: '/gateway/configuration/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
  });

  it('keeps legacy Settings service discovery aliases', () => {
    expect(CONSUELO_CONFIGURATION_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'settings',
        capability: 'settings-read',
        gatewayServiceName: 'configuration-sites-read-endpoints',
        gatewayRouteFamily: '/gateway/settings/*',
      }),
      expect.objectContaining({
        site: 'settings',
        capability: 'settings-write',
        gatewayServiceName: 'configuration-sites-write-endpoints',
        gatewayRouteFamily: '/gateway/settings/*',
      }),
    ]));
  });

  it('registers Configuration services into the generic registry', () => {
    const registry = registerConfigurationConsueloSiteServices([]);

    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'configuration',
      capability: 'configuration-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({
        serviceName: 'configuration-sites-read-endpoints',
        gatewayServiceName: 'configuration-sites-read-endpoints',
        gatewayAdapterName: 'configuration-sites-read-endpoints',
      }),
    ]);
  });

  it('creates a Configuration registry without implementation-path fields', () => {
    const serialized = JSON.stringify(createConfigurationConsueloSiteServiceRegistry());

    expect(serialized).toContain('configuration-sites-read-endpoints');
    expect(serialized).toContain('configuration-sites-write-endpoints');
    expect(serialized).toContain('/configuration/*');
    expect(serialized).toContain('/gateway/configuration/*');
    expect(serialized).not.toContain('backendServiceName');
    expect(serialized).not.toContain('implementationPath');
  });
});
