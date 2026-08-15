import type { Hono } from 'hono';

import { TTL_MS } from '../constants';
import { json, methodNotAllowed, page, text } from '../http';
import { normalizeAuthReturnPath } from '../security/web-auth-contract';
import { resolveCanonicalDeviceIdentity } from '../services/canonical-device-identity';
import {
  CloudFirstOnboardingError,
  resolveCanonicalWebUser,
  resolveWebOperatingAccountId,
} from '../services/cloud-first-onboarding';
import type { DeviceAuthorityRuntime } from '../types';
import { rand } from '../utils';
import {
  googleApprovalErrorMessage,
  googleAuthRedirect,
  googleConfig,
  googleIdentity,
  redirectUri,
} from '../services/google-oauth';
import {
  assignGrantWorkspace,
  commitGrantApproval,
  failGrantWorkspaceRouteSetup,
  prepareGrantApproval,
} from '../services/grants';
import { registerApprovedWorkspaceRoute } from '../services/connectors';
import { recordCanonicalInstallIdentity } from '../services/install-identity';
import { finishMcpOAuthGoogleCallback } from '../services/mcp-oauth';
import { accountNotFoundPage, completeWebGoogleLogin } from './web-auth';

async function handleGoogleOAuthRequest(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = runtime;
    const origin = runtime.origin;
    const now = runtime.now;
    const fetchImpl = runtime.fetchImpl;

    if (url.pathname === '/login/google/start') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const google = googleConfig({
        clientId: input.googleOAuthClientId,
        clientSecret: input.googleOAuthClientSecret,
      });
      if (!google) {
        return text(
          page({
            code: url.searchParams.get('user_code') ?? '',
            origin,
            error: 'Google approval is not configured yet.',
          }),
          { status: 503 },
        );
      }
      if (url.searchParams.get('purpose') === 'web') {
        const state = rand('web_state', 24);
        const nonce = rand('web_nonce', 24);
        const intent = url.searchParams.get('intent') === 'signup' ? 'signup' : 'login';
        await input.store.putWebOAuthState({
          state,
          nonce,
          intent,
          returnPath: normalizeAuthReturnPath(
            url.searchParams.get('return_to'),
          ),
          expiresAt: now() + TTL_MS,
        });
        return Response.redirect(
          googleAuthRedirect({
            origin,
            clientId: google.clientId,
            state,
            nonce,
          }),
          302,
        );
      }
      const code = url.searchParams.get('user_code') ?? '';
      const g = await input.store.byUserCode(code);
      if (!g)
        return text(page({ code, origin, error: 'Device code not found.' }), {
          status: 404,
        });
      if (now() >= g.expiresAt) {
        await input.store.del(g.hash);
        return text(
          page({
            code,
            origin,
            error: 'Device code expired. Restart the installer.',
          }),
          { status: 410 },
        );
      }
      const state = rand('state', 24);
      await input.store.putOAuthState({
        state,
        userCode: g.userCode,
        expiresAt: now() + TTL_MS,
      });
      return Response.redirect(
        googleAuthRedirect({ origin, clientId: google.clientId, state }),
        302,
      );
    }
    if (url.pathname === '/login/google/callback') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const google = googleConfig({
        clientId: input.googleOAuthClientId,
        clientSecret: input.googleOAuthClientSecret,
      });
      if (!google) {
        return text(
          page({
            code: '',
            origin,
            error: 'Google approval is not configured yet.',
          }),
          { status: 503 },
        );
      }
      const stateValue = url.searchParams.get('state') ?? '';
      const authCode = url.searchParams.get('code') ?? '';
      const mcpOAuthState = stateValue
        ? await input.store.byMcpOAuthState(stateValue)
        : undefined;
      if (authCode && mcpOAuthState) {
        return await finishMcpOAuthGoogleCallback({
          request,
          runtime,
          store: input.store,
          origin,
          googleClientId: google.clientId,
          googleClientSecret: google.clientSecret,
          fetchImpl,
          googleRedirectUri: redirectUri(origin),
          nowMs: now(),
        });
      }
      const webOAuthState = stateValue
        ? await input.store.byWebOAuthState(stateValue)
        : undefined;
      if (authCode && webOAuthState) {
        await input.store.delWebOAuthState(stateValue);
        if (now() >= webOAuthState.expiresAt) {
          return json({ error: 'invalid_login' }, { status: 400 });
        }
        try {
          const identity = await googleIdentity({
            code: authCode,
            origin,
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            fetchImpl,
            expectedNonce: webOAuthState.nonce,
          });
          const resolved = await resolveCanonicalWebUser({
            runtime,
            email: identity.email,
            intent: webOAuthState.intent,
          });
          const accountId = await resolveWebOperatingAccountId({
            runtime,
            user: resolved.user,
            googleSubject: identity.sub,
          });
          return await completeWebGoogleLogin({
            runtime,
            accountId,
            email: identity.email,
            returnPath: webOAuthState.returnPath,
            cloudOnboardingEligible: resolved.created,
          });
        } catch (error: unknown) {
          if (error instanceof CloudFirstOnboardingError) {
            if (error.code === 'ACCOUNT_NOT_FOUND') {
              return text(accountNotFoundPage(), { status: error.status });
            }
            return json({ error: error.code.toLowerCase() }, { status: error.status });
          }
          return json({ error: 'invalid_login' }, { status: 400 });
        }
      }
      const oauthState = await input.store.byOAuthState(stateValue);
      if (!stateValue || !authCode || !oauthState)
        return text(
          page({
            code: '',
            origin,
            error: 'Google approval session was not found.',
          }),
          { status: 400 },
        );
      if (now() >= oauthState.expiresAt)
        return text(
          page({
            code: oauthState.userCode,
            origin,
            error: 'Google approval session expired. Restart the installer.',
          }),
          { status: 410 },
        );
      const grant = await input.store.byUserCode(oauthState.userCode);
      if (!grant)
        return text(
          page({
            code: oauthState.userCode,
            origin,
            error: 'Device code not found.',
          }),
          { status: 404 },
        );
      if (now() >= grant.expiresAt) {
        await input.store.del(grant.hash);
        return text(
          page({
            code: oauthState.userCode,
            origin,
            error: 'Device code expired. Restart the installer.',
          }),
          { status: 410 },
        );
      }
      let identity: { sub: string; email: string; emailVerified: boolean };
      try {
        identity = await googleIdentity({
          code: authCode,
          origin,
          clientId: google.clientId,
          clientSecret: google.clientSecret,
          fetchImpl,
        });
      } catch (error: unknown) {
        return text(
          page({
            code: oauthState.userCode,
            origin,
            error: googleApprovalErrorMessage(error),
          }),
          { status: 502 },
        );
      }
      const canonicalIdentity = await resolveCanonicalDeviceIdentity({
        repository: input.installControlPlaneRepository,
        store: input.store,
        email: identity.email,
        googleSubject: identity.sub,
        nowMs: now(),
      });
      if (canonicalIdentity.status === 'denied') {
        await input.store.delOAuthState(stateValue);
        return text(
          page({
            code: oauthState.userCode,
            origin,
            error:
              'This Google account is not ready for Consuelo OS. Sign in to Consuelo first, then retry device approval.',
          }),
          { status: 403 },
        );
      }
      const accountId = canonicalIdentity.operatingAccountId;
      grant.canonicalUserId = canonicalIdentity.canonicalUserId;
      grant.canonicalWorkspaceId = canonicalIdentity.canonicalWorkspaceId;
      grant.workspaceId = canonicalIdentity.canonicalWorkspaceId;
      grant.accountId = accountId;
      grant.accountAuthMethod = 'google';
      if (canonicalIdentity.workspaceRoute) {
        assignGrantWorkspace({
          grant,
          workspaceId: canonicalIdentity.canonicalWorkspaceId,
          workspaceSlug: canonicalIdentity.workspaceRoute.workspaceSlug,
          workspaceHost: canonicalIdentity.workspaceRoute.workspaceHost,
        });
      }
      if (grant.workspaceSlug && grant.workspaceHost) {
        try {
          await prepareGrantApproval({
            store: input.store,
            grant,
            accountId,
            authMethod: 'google',
            nowMs: now(),
          });
          await registerApprovedWorkspaceRoute({
            routeRegistry: input.workspaceRouteRegistry,
            workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
            grant,
            defaultSiteSnapshot: input.defaultSiteSnapshot,
          });
        } catch (error: unknown) {
          const failureMessage = await failGrantWorkspaceRouteSetup({
            store: input.store,
            grant,
            error,
          });
          return text(
            page({
              code: oauthState.userCode,
              origin,
              error: `Workspace route setup failed (${failureMessage}). Restart the installer after platform setup is fixed.`,
            }),
            { status: 502 },
          );
        }
        await input.store.delOAuthState(stateValue);
        await commitGrantApproval({
          store: input.store,
          grant,
          accountId,
          nowMs: now(),
        });
        await recordCanonicalInstallIdentity(runtime, grant);
        return text(
          page({
            code: oauthState.userCode,
            origin,
            message: `Approved for ${identity.email}. Return to your terminal.`,
          }),
        );
      }
      await input.store.put(grant);
      await input.store.delOAuthState(stateValue);
      return text(
        page({
          code: oauthState.userCode,
          origin,
          message: `Approved for ${identity.email}. Return to your terminal to name this workspace.`,
        }),
      );
    }
    return new Response('Not found\n', { status: 404 });
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Google OAuth request failed');
  }
}

export function registerGoogleOAuthRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.all('/login/google/start', (context) =>
    handleGoogleOAuthRequest(context.req.raw, runtime),
  );
  app.all('/login/google/callback', (context) =>
    handleGoogleOAuthRequest(context.req.raw, runtime),
  );
}
