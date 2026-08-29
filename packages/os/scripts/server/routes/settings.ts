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

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderGitHubConnectHandoff(input: { installUrl: string; returnPath: string }): string {
  const installHref = escapeHtmlAttribute(input.installUrl);
  const returnHref = escapeHtmlAttribute(input.returnPath);
  const installUrlJson = JSON.stringify(input.installUrl).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>Opening GitHub · Consuelo OS</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff; color: #111; }
    main { width: min(100% - 40px, 520px); padding: 48px 0; }
    .identity { margin: 0 0 18px; font-size: 12px; font-weight: 650; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(32px, 8vw, 54px); line-height: .98; letter-spacing: -.045em; }
    .copy { margin: 22px 0 0; max-width: 42ch; font-size: 16px; line-height: 1.55; color: #5b5b5b; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
    a { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; border: 1px solid #d7d7d7; border-radius: 8px; color: inherit; text-decoration: none; font-size: 14px; font-weight: 600; }
    a.primary { background: #111; border-color: #111; color: #fff; }
    .status { margin: 16px 0 0; font-size: 12px; color: #777; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b0b0b; color: #f5f5f5; }
      .copy, .status { color: #aaa; }
      a { border-color: #353535; }
      a.primary { background: #f5f5f5; border-color: #f5f5f5; color: #111; }
    }
  </style>
</head>
<body>
  <main aria-labelledby="github-handoff-title">
    <p class="identity">Consuelo OS</p>
    <h1 id="github-handoff-title">Opening GitHub…</h1>
    <p class="copy">Choose the repositories Consuelo may access on GitHub. You’ll return to Consuelo when you’re done.</p>
    <div class="actions">
      <a class="primary" href="${installHref}">Open GitHub</a>
      <a href="${returnHref}">Back to Consuelo</a>
    </div>
    <p class="status" aria-live="polite">GitHub will open automatically.</p>
  </main>
  <script>
    const installUrl = ${installUrlJson};
    requestAnimationFrame(() => requestAnimationFrame(() => window.location.replace(installUrl)));
  </script>
</body>
</html>`;
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
      return new Response(renderGitHubConnectHandoff({ installUrl, returnPath }), {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
          'x-content-type-options': 'nosniff',
        },
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
