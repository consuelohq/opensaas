import { describe, expect, it } from 'vitest';

import { CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS } from '../scripts/lib/consuelo-sites-secrets-adapter';
import { renderConfigurationSite } from '../scripts/lib/settings-site';
import { createWorkspaceEdgeRouteSeedSql } from '../scripts/lib/workspace-edge-route-seed';

describe('secrets surface is backed by the node sealed store', () => {
  it('registers one read-only service scoped to the secrets site', () => {
    expect(CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS).toHaveLength(1);
    expect(CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS[0]).toMatchObject({
      site: 'secrets',
      capability: 'secrets-read',
      serviceName: 'secrets-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/secrets/*',
      publicSiteRouteFamily: '/secrets/*',
    });
  });

  it('seeds /gateway/secrets for a workspace session', () => {
    const sql = createWorkspaceEdgeRouteSeedSql({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      siteSnapshotKey: 'sites/workspace_internal/launcher/v1/index.html',
      siteVersionId: 'v1',
      publishedSiteIds: ['launcher'],
      siteContentHashes: { launcher: 'a'.repeat(64) },
    }).replace(/\\/g, '');

    expect(sql).toContain('"pathPrefix":"/gateway/secrets","auth":"workspace-session"');
    expect(sql).toContain('"serviceName":"secrets-sites-read-endpoints"');
  });
});

describe('secrets page renders bindings, never values', () => {
  const html = renderConfigurationSite('secrets');

  it('hydrates metadata from the secrets gateway', () => {
    expect(html).not.toContain('Secret connections are not available yet');
    expect(html).toContain('/gateway/secrets/bindings');
    expect(html).toContain('secret-rows');
    expect(html).toContain("credentials: 'same-origin'");
  });

  it('keeps the credential safety warning and metadata-only columns', () => {
    expect(html).toContain('Values are never returned to this page or to an agent.');
    expect(html).toContain('Never paste a credential into an agent conversation.');
    expect(html).toContain('<th>Binding</th><th>Node</th><th>Status</th><th>Updated</th>');
    expect(html).not.toMatch(/<th>\s*Value\s*<\/th>/i);
    expect(html).not.toContain('Reveal');
  });
});
