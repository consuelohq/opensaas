import { describe, expect, it } from 'vitest';

import { CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS } from '../scripts/lib/consuelo-sites-secrets-adapter';
import { renderConfigurationSite } from '../scripts/lib/settings-site';
import { createWorkspaceEdgeRouteSeedSql } from '../scripts/lib/workspace-edge-route-seed';

describe('secrets surface is backed by the credential broker', () => {
  it('registers a read service scoped to the secrets site', () => {
    const read = CONSUELO_SECRET_SITE_SERVICE_REGISTRATIONS.find(
      (registration) => registration.capability === 'secrets-read',
    );

    expect(read).toMatchObject({
      site: 'secrets',
      serviceName: 'secrets-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/secrets/*',
      publicSiteRouteFamily: '/secrets/*',
    });
  });

  it('seeds /gateway/secrets for the signed-in workspace session', () => {
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
  });
});

describe('secrets page renders bindings, never values', () => {
  const html = renderConfigurationSite('secrets');

  it('no longer ships the not-available placeholder', () => {
    expect(html).not.toContain('Secret connections are not available yet');
  });

  it('hydrates from the secrets gateway', () => {
    expect(html).toContain('/gateway/secrets/bindings');
    expect(html).toContain('secret-rows');
  });

  it('keeps the never-paste-a-credential warning', () => {
    expect(html).toContain('Never paste a credential into an agent conversation.');
  });

  it('renders only binding metadata columns, never a value column', () => {
    expect(html).toContain('Binding');
    expect(html).not.toMatch(/<th>\s*Value\s*<\/th>/);
    expect(html).not.toContain('Reveal');
  });
});
