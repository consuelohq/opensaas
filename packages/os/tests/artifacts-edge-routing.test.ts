import { describe, expect, it } from 'vitest';

import { createWorkspaceEdgeRouteSeedRecord } from '../scripts/lib/workspace-edge-route-seed';

describe('Artifacts workspace routing', () => {
  it('routes the public Artifacts surface through the live authenticated gateway', () => {
    const record = createWorkspaceEdgeRouteSeedRecord({
      workspaceId: 'workspace_internal',
      workspaceSlug: 'internal',
      hostname: 'internal.consuelohq.com',
      baseDomain: 'consuelohq.com',
      publishedSiteIds: [
        'launcher',
        'artifacts',
        'traces',
        'diffs',
        'docs',
        'configuration',
        'tools',
        'nodes',
        'environments',
        'secrets',
      ],
    });

    expect(record.routes.find((route) => route.pathPrefix === '/artifacts')).toMatchObject({
      surface: 'sites',
      auth: 'workspace-session',
      status: 'active',
      target: {
        kind: 'consuelo-gateway-service',
        serviceName: 'artifacts-sites-read-layer',
        gatewayRouteFamily: '/gateway/artifacts/*',
        publicSiteRouteFamily: '/artifacts/*',
      },
    });
    expect(
      record.routes.some(
        (route) => route.pathPrefix === '/artifacts' && route.target.kind === 'site-snapshot',
      ),
    ).toBe(false);
  });
});
