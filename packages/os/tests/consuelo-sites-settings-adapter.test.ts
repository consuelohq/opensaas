import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_SETTINGS_SITE_SERVICE_REGISTRATIONS,
  createSettingsConsueloSiteServiceRegistry,
  registerSettingsConsueloSiteServices,
} from '../scripts/lib/consuelo-sites-settings-adapter';

describe('Consuelo Sites Settings adapter registration', () => {
  it('should register Settings read and write as gateway service adapters', () => {
    expect(CONSUELO_SETTINGS_SITE_SERVICE_REGISTRATIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        site: 'settings',
        capability: 'settings-read',
        gatewayServiceName: 'settings-sites-read-endpoints',
        gatewayAdapterName: 'settings-sites-read-endpoints',
        publicSiteRouteFamily: '/settings/*',
        gatewayRouteFamily: '/gateway/settings/*',
        publicBoundary: 'consuelo-gateway',
      }),
      expect.objectContaining({
        site: 'settings',
        capability: 'settings-write',
        gatewayServiceName: 'settings-sites-write-endpoints',
        gatewayAdapterName: 'settings-sites-write-endpoints',
        publicSiteRouteFamily: '/settings/*',
        gatewayRouteFamily: '/gateway/settings/*',
        publicBoundary: 'consuelo-gateway',
      }),
    ]));
  });

  it('should register Settings services into a generic registry', () => {
    const registry = registerSettingsConsueloSiteServices([]);

    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'settings',
      capability: 'settings-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({
        serviceName: 'settings-sites-read-endpoints',
        gatewayServiceName: 'settings-sites-read-endpoints',
        gatewayAdapterName: 'settings-sites-read-endpoints',
      }),
    ]);
  });

  it('should create a Settings registry without implementation-path fields', () => {
    const serialized = JSON.stringify(createSettingsConsueloSiteServiceRegistry());

    expect(serialized).toContain('settings-sites-read-endpoints');
    expect(serialized).toContain('settings-sites-write-endpoints');
    expect(serialized).toContain('/settings/*');
    expect(serialized).toContain('/gateway/settings/*');
    expect(serialized).not.toContain('backendServiceName');
    expect(serialized).not.toContain('implementationPath');
  });
});