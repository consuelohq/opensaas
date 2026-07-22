import { Hono } from 'hono';

import {
  applySettingsGatewayOverlayPatch,
  readSettingsGatewaySnapshot,
  resolveSettingsGatewayHome,
} from '../../lib/settings-gateway';
import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';

const SNAPSHOT_ROUTES = [
  {
    path: '/gateway/configuration/snapshot',
    scope: 'route:/gateway/configuration:read',
  },
  {
    path: '/gateway/settings/snapshot',
    scope: 'route:/gateway/settings:read',
  },
] as const;

const OVERLAY_ROUTES = [
  {
    path: '/gateway/configuration/overlay',
    scope: 'route:/gateway/configuration:write',
  },
  {
    path: '/gateway/settings/overlay',
    scope: 'route:/gateway/settings:write',
  },
] as const;

function requireConfigurationHome(message: string): string | Response {
  const home = resolveSettingsGatewayHome();
  if (home) return home;
  return jsonResponse({
    ok: false,
    error: { code: 'OS_HOME_REQUIRED', message },
  }, 500);
}

export function createSettingsRoutes(): Hono {
  const app = new Hono();

  for (const route of SNAPSHOT_ROUTES) {
    app.get(route.path, async (context) => {
      const request = context.req.raw;
      try {
        const denied = await authorizeSignedRequest({
          request,
          path: route.path,
          body: '',
          requiredScope: route.scope,
        });
        if (denied) return denied;

        const home = requireConfigurationHome(
          'Consuelo OS home is required for configuration snapshot.',
        );
        if (home instanceof Response) return home;

        const result = await readSettingsGatewaySnapshot(home);
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, result.status);
        return jsonResponse({ ok: true, snapshot: result.snapshot });
      } catch (error: unknown) {
        return internalError(error);
      }
    });
  }

  for (const route of OVERLAY_ROUTES) {
    app.post(route.path, async (context) => {
      const request = context.req.raw;
      try {
        const body = await request.clone().text();
        const denied = await authorizeSignedRequest({
          request,
          path: route.path,
          body,
          requiredScope: route.scope,
        });
        if (denied) return denied;

        const home = requireConfigurationHome(
          'Consuelo OS home is required for configuration overlay writes.',
        );
        if (home instanceof Response) return home;

        const result = await applySettingsGatewayOverlayPatch(home, body);
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, result.status);
        return jsonResponse({ ok: true, snapshot: result.snapshot });
      } catch (error: unknown) {
        return internalError(error);
      }
    });
  }

  return app;
}

export const createConfigurationRoutes = createSettingsRoutes;
