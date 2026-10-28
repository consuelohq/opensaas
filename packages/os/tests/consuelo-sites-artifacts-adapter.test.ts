import { describe, expect, it } from 'vitest';

import { discoverRegisteredConsueloSiteServices } from '../scripts/lib/consuelo-sites-gateway-registry';
import {
  CONSUELO_ARTIFACTS_SITE_SERVICE_REGISTRATIONS,
  createArtifactsConsueloSiteServiceRegistry,
  registerArtifactsConsueloSiteServices,
} from '../scripts/lib/consuelo-sites-artifacts-adapter';

describe('Consuelo Sites Artifacts adapter registration', () => {
  it('registers the canonical Artifacts read gateway', () => {
    expect(CONSUELO_ARTIFACTS_SITE_SERVICE_REGISTRATIONS).toEqual([
      expect.objectContaining({
        site: 'artifacts',
        capability: 'artifacts-read',
        serviceName: 'artifacts-sites-read-layer',
        gatewayServiceName: 'artifacts-sites-read-layer',
        gatewayAdapterName: 'artifacts-sites-read-layer',
        publicSiteRouteFamily: '/artifacts/*',
        gatewayRouteFamily: '/gateway/artifacts/*',
        publicBoundary: 'consuelo-gateway',
        supportedSourceModes: ['local-networked', 'cloud-compute', 'local-off-network'],
      }),
    ]);
  });

  it('registers Artifacts services into a generic registry', () => {
    const registry = registerArtifactsConsueloSiteServices([]);
    expect(discoverRegisteredConsueloSiteServices(registry, {
      site: 'artifacts',
      capability: 'artifacts-read',
      sourceMode: 'local-networked',
    })).toEqual([
      expect.objectContaining({ serviceName: 'artifacts-sites-read-layer' }),
    ]);
  });

  it('creates an implementation-neutral Artifacts registry', () => {
    const serialized = JSON.stringify(createArtifactsConsueloSiteServiceRegistry());
    expect(serialized).toContain('/artifacts/*');
    expect(serialized).toContain('/gateway/artifacts/*');
    expect(serialized).not.toContain('office');
    expect(serialized).not.toContain('workspace');
    expect(serialized).not.toContain('implementationPath');
  });
});
