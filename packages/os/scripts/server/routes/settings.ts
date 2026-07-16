import { Hono } from 'hono';

import {
  applySettingsGatewayOverlayPatch,
  readSettingsGatewaySnapshot,
  resolveSettingsGatewayHome,
} from '../../lib/settings-gateway';
import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';

const SETTINGS_SNAPSHOT_PATH = '/gateway/settings/snapshot';
const SETTINGS_OVERLAY_PATH = '/gateway/settings/overlay';

function requireSettingsHome(message: string): string | Response {
  const home = resolveSettingsGatewayHome();
  if (home) return home;
  return jsonResponse({
    ok: false,
    error: {
      code: 'OS_HOME_REQUIRED',
      message,
    },
  }, 500);
}

export function createSettingsRoutes(): Hono {
  const app = new Hono();

  app.get(SETTINGS_SNAPSHOT_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeSignedRequest({
        request,
        path: SETTINGS_SNAPSHOT_PATH,
        body: '',
        requiredScope: 'route:/gateway/settings:read',
      });
      if (denied) return denied;

      const home = requireSettingsHome(
        'Consuelo OS home is required for settings snapshot.',
      );
      if (home instanceof Response) return home;

      const result = await readSettingsGatewaySnapshot(home);
      if (!result.ok) {
        return jsonResponse({ ok: false, error: result.error }, result.status);
      }
      return jsonResponse({ ok: true, snapshot: result.snapshot });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.post(SETTINGS_OVERLAY_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const body = await request.clone().text();
      const denied = await authorizeSignedRequest({
        request,
        path: SETTINGS_OVERLAY_PATH,
        body,
        requiredScope: 'route:/gateway/settings:write',
      });
      if (denied) return denied;

      const home = requireSettingsHome(
        'Consuelo OS home is required for settings overlay writes.',
      );
      if (home instanceof Response) return home;

      const result = await applySettingsGatewayOverlayPatch(home, body);
      if (!result.ok) {
        return jsonResponse({ ok: false, error: result.error }, result.status);
      }
      return jsonResponse({ ok: true, snapshot: result.snapshot });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
