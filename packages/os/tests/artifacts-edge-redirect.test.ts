import { describe, expect, it } from 'vitest';

import { createWorkspaceCloudflareEdgeRouter } from '../scripts/lib/workspace-cloudflare-edge-router';

describe('legacy artifact edge redirects', () => {
  it.each([
    ['/office', '/artifacts'],
    ['/office/specs/example?view=full', '/artifacts/specs/example?view=full'],
    ['/design-wiki', '/artifacts'],
    ['/design-wiki/guides/example', '/artifacts/guides/example'],
  ])('redirects %s without creating an internal Office route', async (requestPath, expectedLocation) => {
    const route = requestPath.startsWith('/design-wiki') ? '/design-wiki' : '/office';
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: {
        async resolve() {
          return {
            allowed: true as const,
            workspaceId: 'workspace_artifacts_redirect',
            hostname: 'artifacts.consuelohq.com',
            route,
            surface: 'sites' as const,
            auth: 'public' as const,
            auditEvent: 'workspace.hostname.route.allowed' as const,
            target: {
              kind: 'redirect' as const,
              location: '/artifacts',
              statusCode: 308 as const,
            },
          };
        },
      },
    });

    const response = await router.fetch(new Request(`https://artifacts.consuelohq.com${requestPath}`));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(expectedLocation);
    expect(response.headers.get('x-consuelo-edge-route-authority')).toBe('legacy-redirect');
  });
});
