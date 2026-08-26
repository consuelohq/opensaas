import fs from 'node:fs';

import { Hono } from 'hono';

import {
  loadWorkspaceYamlConfig,
  resolveConsueloHomeLayout,
} from '../../lib/consuelo-home';
import {
  buildWorkspaceSourceControlSnapshot,
  parseWorkspaceSourceControlConfiguration,
  updateWorkspaceSourceControlFromGitHubInstallation,
  updateWorkspaceSourceControlConfiguration,
  type WorkspaceSourceControlConfigurationInput,
} from '../../lib/source-control-config';
import {
  claimGitHubSourceControlInstall,
  githubInstallationConnectionRef,
  startGitHubSourceControlInstall,
} from '../../lib/github-source-control-client';
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

function safeSourceControlReturnPath(value: string | null): string {
  if (!value) return '/configuration';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/configuration';
  }
  try {
    const parsed = new URL(trimmed, 'https://workspace.invalid');
    if (parsed.origin !== 'https://workspace.invalid' || parsed.hash) return '/configuration';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/configuration';
  }
}

export function createSettingsRoutes(): Hono {
  const app = new Hono();

  app.get('/gateway/configuration/source-control/github/connect', async (context) => {
    const request = context.req.raw;
    const requestUrl = new URL(request.url);
    const signedPath = `${requestUrl.pathname}${requestUrl.search}`;
    try {
      const authentication = await authenticateSignedRequest({
        request,
        path: signedPath,
        body: '',
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
        'Consuelo OS home is required to connect GitHub.',
      );
      if (home instanceof Response) return home;
      const returnPath = safeSourceControlReturnPath(requestUrl.searchParams.get('return_to'));
      const { installUrl } = await startGitHubSourceControlInstall({ home, returnPath });
      return new Response(null, {
        status: 302,
        headers: { location: installUrl, 'cache-control': 'no-store' },
      });
    } catch (error: unknown) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'GITHUB_CONNECT_FAILED',
          message: error instanceof Error ? error.message : 'GitHub connection could not be started.',
        },
      }, 503);
    }
  });

  app.post('/gateway/configuration/source-control/github/complete', async (context) => {
    const request = context.req.raw;
    try {
      const body = await request.clone().text();
      const authentication = await authenticateSignedRequest({
        request,
        path: '/gateway/configuration/source-control/github/complete',
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
        'Consuelo OS home is required to finish connecting GitHub.',
      );
      if (home instanceof Response) return home;
      let handoff = '';
      try {
        const parsed = JSON.parse(body) as unknown;
        handoff = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          && typeof (parsed as Record<string, unknown>).handoff === 'string'
          ? ((parsed as Record<string, unknown>).handoff as string).trim()
          : '';
      } catch {
        handoff = '';
      }
      if (!handoff) {
        return jsonResponse({
          ok: false,
          error: { code: 'GITHUB_HANDOFF_REQUIRED', message: 'GitHub connection handoff is required.' },
        }, 400);
      }
      const claim = await claimGitHubSourceControlInstall({ home, handoff });
      const snapshot = updateWorkspaceSourceControlFromGitHubInstallation({
        home,
        workspaceId,
        installation: {
          connectionRef: githubInstallationConnectionRef(claim.connectionId),
          repositories: claim.repositories,
        },
      });
      return jsonResponse({
        ok: true,
        snapshot,
        returnPath: safeSourceControlReturnPath(claim.returnPath),
        github: {
          accountLogin: claim.accountLogin,
          repositorySelection: claim.repositorySelection,
        },
      });
    } catch (error: unknown) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'GITHUB_CONNECT_FAILED',
          message: error instanceof Error ? error.message : 'GitHub connection could not be completed.',
        },
      }, 503);
    }
  });

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
