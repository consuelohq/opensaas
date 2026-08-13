import { describe, expect, it } from 'bun:test';

import { createLeadConnectorMarketplaceBootstrap } from './marketplace-bootstrap';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('stable HighLevel Marketplace bootstrap', () => {
  it('loads the launcher assets from one stable HTTPS origin without credentials', () => {
    const html = createLeadConnectorMarketplaceBootstrap({
      assetOrigin: 'https://calls.consuelohq.com',
    });

    expect(html).toContain(
      'https://calls.consuelohq.com/consuelo-lead-connector-click-to-call.css',
    );
    expect(html).toContain(
      'https://calls.consuelohq.com/consuelo-lead-connector-click-to-call.js',
    );
    expect(html).toContain('<link');
    expect(html).toContain('<script');
    expect(html).not.toMatch(/authorization|bearer|token|secret/i);
  });

  it('rejects non-HTTPS asset origins', () => {
    expect(() =>
      createLeadConnectorMarketplaceBootstrap({
        assetOrigin: 'http://localhost:3000',
      }),
    ).toThrow('Marketplace asset origin must use HTTPS');
  });

  it('is emitted as a dedicated one-time Marketplace installation artifact', () => {
    const packageRoot = join(import.meta.dir, '..', '..');
    const build = readFileSync(
      join(packageRoot, 'scripts', 'build-embed.ts'),
      'utf8',
    );
    expect(build).toContain('marketplace-loader.html');
    expect(build).toContain('createLeadConnectorMarketplaceBootstrap');
    expect(
      existsSync(
        join(packageRoot, 'src', 'deployment', 'marketplace-bootstrap.ts'),
      ),
    ).toBe(true);
  });
});
