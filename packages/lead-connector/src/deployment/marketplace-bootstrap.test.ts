import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';

import {
  createLeadConnectorMarketplaceBootstrap,
  verifyLeadConnectorMarketplaceBootstrap,
} from './marketplace-bootstrap';
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
    expect(html.startsWith('<script>')).toBe(true);
    expect(html).toContain("document.createElement('link')");
    expect(html).toContain("document.createElement('script')");
    expect(html).toContain('data-consuelo-dialer-loader');
    expect(html).not.toMatch(/authorization|bearer|token|secret/i);
  });

  it('rejects non-HTTPS asset origins', () => {
    expect(() =>
      createLeadConnectorMarketplaceBootstrap({
        assetOrigin: 'http://localhost:3000',
      }),
    ).toThrow('Marketplace asset origin must use HTTPS');
  });

  it('verifies the built loader against the approved one-time source SHA-256', () => {
    const html = createLeadConnectorMarketplaceBootstrap({
      assetOrigin: 'https://calls.consuelohq.com',
    });
    const sha256 = createHash('sha256').update(html).digest('hex');

    expect(
      verifyLeadConnectorMarketplaceBootstrap({
        contents: html,
        expectedSha256: sha256,
      }),
    ).toEqual({ sha256, installationMode: 'one-time' });

    expect(() =>
      verifyLeadConnectorMarketplaceBootstrap({
        contents: `${html}<!-- drift -->`,
        expectedSha256: sha256,
      }),
    ).toThrow('does not match the approved one-time bootstrap source');
  });

  it('is emitted as a dedicated one-time Marketplace installation artifact', () => {
    const packageRoot = join(import.meta.dir, '..', '..');
    const build = readFileSync(
      join(packageRoot, 'scripts', 'build-embed.ts'),
      'utf8',
    );
    const wrangler = readFileSync(join(packageRoot, 'wrangler.jsonc'), 'utf8');
    const osWrangler = readFileSync(
      join(
        packageRoot,
        '..',
        'os',
        'cloudflare',
        'workspace-edge',
        'wrangler.toml',
      ),
      'utf8',
    );
    expect(build).toContain('marketplace-loader.html');
    expect(build).toContain('createLeadConnectorMarketplaceBootstrap');
    expect(build).toContain("assetOrigin: 'https://calls.consuelohq.com'");
    expect(wrangler).toContain('"pattern": "calls.consuelohq.com"');
    expect(wrangler).toContain('"custom_domain": true');
    expect(wrangler).toContain('"pattern": "calls.consuelohq.com/*"');
    expect(wrangler).toContain('"zone_name": "consuelohq.com"');
    expect(wrangler).toContain('"workers_dev": false');
    expect(wrangler).toContain('"preview_urls": false');
    expect(osWrangler).toContain('*.consuelohq.com/*');
    expect(osWrangler).not.toContain('calls.consuelohq.com/*');
    expect(
      existsSync(
        join(packageRoot, 'src', 'deployment', 'marketplace-bootstrap.ts'),
      ),
    ).toBe(true);
  });
});
