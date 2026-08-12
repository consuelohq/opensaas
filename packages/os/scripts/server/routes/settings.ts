import fs from 'node:fs';

import { Hono } from 'hono';

import {
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
} from '../../lib/consuelo-home';
import {
  buildWorkspaceSourceControlSnapshot,
  parseWorkspaceSourceControlConfiguration,
  updateWorkspaceSourceControlConfiguration,
  type WorkspaceSourceControlConfigurationInput,
} from '../../lib/source-control-config';
import {
  applySettingsGatewayOverlayPatch,
  readSettingsGatewaySnapshot,
  resolveSettingsGatewayHome,
} from '../../lib/settings-gateway';
import { authenticateSignedRequest, authorizeSignedRequest } from '../middleware/auth';
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

function workspaceSourceControlPath(home: string, workspaceId: string): string {
  return resolveConsueloHomeLayout(home).workspaceConfigPath(workspaceId);
}


function sourceControlConfigurationError(_error: unknown): Response {
  return jsonResponse({
    ok: false,
    error: {
      code: 'INVALID_SOURCE_CONTROL_CONFIGURATION',
      message: 'Source-control configuration is invalid.',
    },
  }, 400);
}

export function createSettingsRoutes(): Hono {
  const app = new Hono();

  app.get('/gateway/configuration/source-control', async (context) => {
    const request = context.req.raw;
    try {
      const authentication = await authenticateSignedRequest({
        request,
        path: '/gateway/configuration/source-control',
        body: '',
        requiredScope: 'route:/gateway/configuration:read',
      });
      if (!authentication.ok) return authentication.response;
      const workspaceId = authentication.principal.workspaceId?.trim();
      if (!workspaceId) {
        return jsonResponse({
          ok: false,
          error: { code: 'WORKSPACE_ID_REQUIRED', message: 'Signed workspace identity is required.' },
        }, 403);
      }
      const home = requireConfigurationHome(
        'Consuelo OS home is required for source-control configuration.',
      );
      if (home instanceof Response) return home;
      const workspacePath = workspaceSourceControlPath(home, workspaceId);
      if (!fs.existsSync(workspacePath)) {
        return jsonResponse({
          ok: false,
          error: { code: 'WORKSPACE_NOT_FOUND', message: `Workspace configuration was not found for ${workspaceId}.` },
        }, 404);
      }
      const snapshot = buildWorkspaceSourceControlSnapshot(loadWorkspaceYamlConfig(workspacePath));
      return jsonResponse({ ok: true, snapshot });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.post('/gateway/configuration/source-control', async (context) => {
    const request = context.req.raw;
    try {
      const body = await request.clone().text();
      const authentication = await authenticateSignedRequest({
        request,
        path: '/gateway/configuration/source-control',
        body,
        requiredScope: 'route:/gateway/configuration:write',
      });
      if (!authentication.ok) return authentication.response;
      const workspaceId = authentication.principal.workspaceId?.trim();
      if (!workspaceId) {
        return jsonResponse({
          ok: false,
          error: { code: 'WORKSPACE_ID_REQUIRED', message: 'Signed workspace identity is required.' },
        }, 403);
      }
      const home = requireConfigurationHome(
        'Consuelo OS home is required for source-control configuration writes.',
      );
      if (home instanceof Response) return home;
      const workspacePath = workspaceSourceControlPath(home, workspaceId);
      if (!fs.existsSync(workspacePath)) {
        return jsonResponse({
          ok: false,
          error: { code: 'WORKSPACE_NOT_FOUND', message: `Workspace configuration was not found for ${workspaceId}.` },
        }, 404);
      }
      let configuration: WorkspaceSourceControlConfigurationInput;
      try {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new Error('Source-control configuration must be valid JSON.');
        }
        configuration = parseWorkspaceSourceControlConfiguration(parsed);
        const snapshot = updateWorkspaceSourceControlConfiguration({
          home,
          workspaceId,
          configuration,
        });
        return jsonResponse({ ok: true, snapshot });
      } catch (error: unknown) {
        return sourceControlConfigurationError(error);
      }
    } catch (error: unknown) {
      return internalError(error);
    }
  });

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
