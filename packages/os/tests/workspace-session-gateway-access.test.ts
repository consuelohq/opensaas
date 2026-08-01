import { describe, expect, it } from 'vitest';

import { createWorkspaceEdgeRouteSeedSql } from '../scripts/lib/workspace-edge-route-seed';

// The dashboards fetch /gateway/* from the browser. A browser cannot produce an internal edge
// signature, so a gateway route seeded as auth 'required' answers 503 for every real viewer.
// Those routes must authorize the signed-in workspace session instead.
describe('browser-facing gateway routes authorize the workspace session', () => {
  const sql = createWorkspaceEdgeRouteSeedSql({
    workspaceId: 'workspace_internal',
    workspaceSlug: 'internal',
    hostname: 'internal.consuelohq.com',
    baseDomain: 'consuelohq.com',
    siteSnapshotKey: 'sites/workspace_internal/launcher/v1/index.html',
    siteVersionId: 'v1',
    publishedSiteIds: ['launcher'],
    siteContentHashes: { launcher: 'a'.repeat(64) },
  });
  const flat = sql.replace(/\\/g, '');

  it.each([
    '/gateway/traces',
    '/gateway/traces/events',
    '/gateway/configuration',
    '/gateway/environments',
    '/gateway/artifacts',
  ])('seeds %s so a signed-in viewer can read it', (pathPrefix) => {
    expect(flat).toContain(`"pathPrefix":"${pathPrefix}","auth":"workspace-session"`);
  });

  it('leaves no browser-facing gateway route on internal-signature auth', () => {
    expect(flat).not.toMatch(/"pathPrefix":"\/gateway\/[^"]*","auth":"required"/);
  });
});
