import path from 'node:path';

import { Hono, type Context } from 'hono';

import { ARTIFACT_LOCAL_SHARE_CSRF_PLACEHOLDER } from '../../lib/artifacts';
import { hasAnyWorkspaceEdgeNodeHeaders } from '../../lib/workspace-edge-node-auth';
import {
  authorizeSignedRequest,
  hasSignedGatewayHeaders,
  loadAuthConfigForRequest,
  requestHeaders,
} from '../middleware/auth';
import { internalError, invalidRequest, jsonResponse } from '../middleware/errors';
import {
  authorizeArtifactShareSession,
  claimArtifactShare,
  createArtifactShare,
  getArtifactShareStatus,
  getOrCreateLocalArtifactShareCsrf,
  listArtifactShares,
  revokeArtifactShare,
  verifyLocalArtifactShareCsrf,
  type ArtifactShareRecord,
} from '../services/artifact-sharing';
import {
  artifactsGatewayArtifact,
  artifactsGatewayCatalog,
  artifactsGatewayVersions,
  resolveArtifactPublicFile,
  resolveArtifactsHome,
} from '../services/artifacts-gateway';

const ARTIFACTS_GATEWAY_PATH = '/gateway/artifacts';
const ARTIFACT_SHARE_COOKIE_PREFIX = 'consuelo_artifact_share_';

type ArtifactRouteDependencies = {
  now?: () => number;
};

function isLoopbackRequest(request: Request): boolean {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return false;
  }
}

function isSameOriginLoopbackMutation(request: Request): boolean {
  if (!isLoopbackRequest(request)) return false;
  try {
    const requestOrigin = new URL(request.url).origin;
    return request.headers.get('origin') === requestOrigin;
  } catch {
    return false;
  }
}

function publicArtifactResponse(request: Request): Response {
  const pathname = new URL(request.url).pathname;
  const file = resolveArtifactPublicFile(pathname);
  if (!file) return new Response('Artifact not found', { status: 404 });

  let body = file.body;
  if (
    file.contentType.startsWith('text/html')
    && (pathname === '/artifacts' || pathname === '/artifacts/')
  ) {
    const html = new TextDecoder().decode(file.body);
    const replacement = isLoopbackRequest(request)
      ? getOrCreateLocalArtifactShareCsrf(resolveArtifactsHome())
      : '';
    body = new TextEncoder().encode(
      html.replaceAll(ARTIFACT_LOCAL_SHARE_CSRF_PLACEHOLDER, replacement),
    );
  }

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': file.contentType,
      'cache-control': file.contentType.startsWith('text/html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    },
  });
}

function authorizeRead(request: Request, path: string): Promise<Response | null> {
  return authorizeSignedRequest({
    request,
    path,
    body: '',
    requiredScope: 'route:/gateway/artifacts:read',
  });
}

function authorizeWrite(
  request: Request,
  path: string,
  body: string,
): Promise<Response | null> {
  const headers = requestHeaders(request);
  if (
    !isLoopbackRequest(request)
    || hasSignedGatewayHeaders(headers)
    || hasAnyWorkspaceEdgeNodeHeaders(headers)
  ) {
    return authorizeSignedRequest({
      request,
      path,
      body,
      requiredScope: 'route:/gateway/artifacts:write',
    });
  }

  if (!isSameOriginLoopbackMutation(request)) {
    return Promise.resolve(jsonResponse({
      ok: false,
      error: {
        code: 'ARTIFACT_SHARE_ORIGIN_FAILED',
        message: 'Artifact share changes must come from the local Artifacts page.',
      },
    }, 403));
  }

  const localCsrf = request.headers.get('x-consuelo-artifact-share-csrf')?.trim() ?? '';
  if (
    localCsrf
    && !verifyLocalArtifactShareCsrf(resolveArtifactsHome(), localCsrf)
  ) {
    return Promise.resolve(jsonResponse({
      ok: false,
      error: {
        code: 'ARTIFACT_SHARE_CSRF_FAILED',
        message: 'The local Artifacts share capability is invalid.',
      },
    }, 403));
  }

  return Promise.resolve(null);
}

function publicArtifactShareUrl(relativeUrl: string): string {
  const workspaceHost = loadAuthConfigForRequest().workspaceHost.trim().toLowerCase();
  if (!workspaceHost) throw new Error('workspace host is required for artifact sharing');
  return new URL(relativeUrl, `https://${workspaceHost}`).toString();
}

function shareSecurityHeaders(contentType?: string): Headers {
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow, noarchive',
  });
  if (contentType) headers.set('content-type', contentType);
  return headers;
}

function shareUnavailable(status: 'missing' | 'expired' | 'revoked'): Response {
  if (status === 'missing') {
    return new Response('Private artifact link not found.', {
      status: 404,
      headers: shareSecurityHeaders('text/plain; charset=utf-8'),
    });
  }
  return new Response('This private artifact link is no longer available.', {
    status: 410,
    headers: shareSecurityHeaders('text/plain; charset=utf-8'),
  });
}

function shareCookieName(shareId: string): string {
  return `${ARTIFACT_SHARE_COOKIE_PREFIX}${shareId.replace(/[^A-Za-z0-9_-]/gu, '')}`;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

function shareSessionCookie(input: {
  shareId: string;
  sessionToken: string;
  sessionExpiresAt: string;
  nowMs: number;
}): string {
  const maxAge = Math.max(
    1,
    Math.floor((Date.parse(input.sessionExpiresAt) - input.nowMs) / 1000),
  );
  return [
    `${shareCookieName(input.shareId)}=${encodeURIComponent(input.sessionToken)}`,
    `Path=/share/artifacts/${input.shareId}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

function renderShareLanding(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <meta name="referrer" content="no-referrer" />
  <title>Private Consuelo artifact</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(88vw, 440px); text-align: center; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    p { margin: 0; opacity: .72; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Opening private artifact…</h1>
    <p data-status>Checking this private link.</p>
  </main>
  <script>
    (async () => {
      const status = document.querySelector('[data-status]');
      const secret = location.hash.length > 1 ? location.hash.slice(1) : '';
      history.replaceState(null, '', location.pathname);
      if (!secret) {
        if (status) status.textContent = 'This private link is missing its access key.';
        return;
      }
      try {
        const response = await fetch(location.pathname + '/claim', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret }),
        });
        if (!response.ok) {
          if (status) status.textContent = response.status === 410
            ? 'This private link has expired or was revoked.'
            : 'This private link could not be opened.';
          return;
        }
        location.replace(location.pathname);
      } catch {
        if (status) status.textContent = 'Could not open this private link. Try again.';
      }
    })();
  </script>
</body>
</html>`;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}') as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('request body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function safeShareRemainder(pathname: string, shareId: string): string | null {
  const prefix = `/share/artifacts/${shareId}`;
  const raw = pathname.slice(prefix.length).replace(/^\/+/, '');
  if (!raw) return '';
  try {
    const decoded = decodeURIComponent(raw);
    const normalized = path.posix.normalize(decoded);
    if (
      normalized === '..'
      || normalized.startsWith('../')
      || path.posix.isAbsolute(normalized)
    ) return null;
    return normalized === '.' ? '' : normalized;
  } catch {
    return null;
  }
}

function shareArtifactResponse(input: {
  share: ArtifactShareRecord;
  pathname: string;
}): Response {
  const artifact = artifactsGatewayArtifact(input.share.artifactId);
  if (!artifact) {
    return new Response('Shared artifact not found.', {
      status: 404,
      headers: shareSecurityHeaders('text/plain; charset=utf-8'),
    });
  }
  const remainder = safeShareRemainder(input.pathname, input.share.id);
  if (remainder === null) {
    return new Response('Artifact file not found.', {
      status: 404,
      headers: shareSecurityHeaders('text/plain; charset=utf-8'),
    });
  }
  const artifactPath = `/artifacts${artifact.path}${remainder ? `/${remainder}` : ''}`;
  const file = resolveArtifactPublicFile(artifactPath);
  if (!file) {
    return new Response('Artifact file not found.', {
      status: 404,
      headers: shareSecurityHeaders('text/plain; charset=utf-8'),
    });
  }
  return new Response(file.body, {
    status: 200,
    headers: shareSecurityHeaders(file.contentType),
  });
}

export function createArtifactRoutes(
  dependencies: ArtifactRouteDependencies = {},
): Hono {
  const app = new Hono();
  const now = dependencies.now ?? Date.now;

  app.get('/artifacts', (context) => publicArtifactResponse(context.req.raw));
  app.get('/artifacts/*', (context) => publicArtifactResponse(context.req.raw));

  app.post('/share/artifacts/:shareId/claim', async (context) => {
    const shareId = context.req.param('shareId');
    const home = resolveArtifactsHome();
    const nowMs = now();
    try {
      const body = parseJsonObject(await context.req.text());
      const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
      if (!secret) return invalidRequest(new Error('artifact share secret is required'));
      const claimed = claimArtifactShare({ home, shareId, secret, nowMs });
      if (!claimed.ok) {
        if (claimed.status === 'invalid-secret') {
          return new Response('Private artifact link is invalid.', {
            status: 403,
            headers: shareSecurityHeaders('text/plain; charset=utf-8'),
          });
        }
        return shareUnavailable(claimed.status);
      }
      const response = jsonResponse({
        ok: true,
        location: `/share/artifacts/${shareId}`,
      });
      for (const [key, value] of shareSecurityHeaders().entries()) {
        response.headers.set(key, value);
      }
      response.headers.append('set-cookie', shareSessionCookie({
        shareId,
        sessionToken: claimed.sessionToken,
        sessionExpiresAt: claimed.sessionExpiresAt,
        nowMs,
      }));
      return response;
    } catch (error: unknown) {
      return invalidRequest(error);
    }
  });

  const serveSharedArtifact = async (context: Context): Promise<Response> => {
    const request = context.req.raw;
    const shareId = context.req.param('shareId');
    const home = resolveArtifactsHome();
    const nowMs = now();
    const status = getArtifactShareStatus({ home, shareId, nowMs });
    if (status.kind !== 'active') return shareUnavailable(status.kind);

    const rawSessionToken = cookieValue(request, shareCookieName(shareId));
    if (rawSessionToken) {
      let sessionToken: string;
      try {
        sessionToken = decodeURIComponent(rawSessionToken);
      } catch {
        return new Response('Private artifact session is invalid.', {
          status: 401,
          headers: shareSecurityHeaders('text/plain; charset=utf-8'),
        });
      }
      const session = authorizeArtifactShareSession({
        home,
        shareId,
        sessionToken,
        nowMs,
      });
      if (session.kind === 'active') {
        return shareArtifactResponse({
          share: session.share,
          pathname: context.req.path,
        });
      }
      if (session.kind === 'expired' || session.kind === 'revoked') {
        return shareUnavailable(session.kind);
      }
    }

    if (context.req.path === `/share/artifacts/${shareId}`) {
      return new Response(renderShareLanding(), {
        status: 200,
        headers: shareSecurityHeaders('text/html; charset=utf-8'),
      });
    }
    return new Response('Private artifact access is required.', {
      status: 401,
      headers: shareSecurityHeaders('text/plain; charset=utf-8'),
    });
  };

  app.get('/share/artifacts/:shareId', serveSharedArtifact);
  app.get('/share/artifacts/:shareId/*', serveSharedArtifact);

  app.get(ARTIFACTS_GATEWAY_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeRead(request, ARTIFACTS_GATEWAY_PATH);
      if (denied) return denied;
      const catalog = artifactsGatewayCatalog();
      return jsonResponse({
        ok: true,
        updatedAt: catalog.updatedAt,
        artifacts: catalog.entries,
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.get('/gateway/artifacts/:artifactId', async (context) => {
    const request = context.req.raw;
    const requestPath = context.req.path;
    try {
      const denied = await authorizeRead(request, requestPath);
      if (denied) return denied;
      const artifact = artifactsGatewayArtifact(context.req.param('artifactId'));
      if (!artifact) {
        return jsonResponse({
          ok: false,
          error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found.' },
        }, 404);
      }
      return jsonResponse({ ok: true, artifact });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.get('/gateway/artifacts/:artifactId/versions', async (context) => {
    const request = context.req.raw;
    const requestPath = context.req.path;
    try {
      const denied = await authorizeRead(request, requestPath);
      if (denied) return denied;
      const artifactId = context.req.param('artifactId');
      const artifact = artifactsGatewayArtifact(artifactId);
      if (!artifact) {
        return jsonResponse({
          ok: false,
          error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found.' },
        }, 404);
      }
      return jsonResponse({
        ok: true,
        artifactId,
        versions: artifactsGatewayVersions(artifactId),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.get('/gateway/artifacts/:artifactId/shares', async (context) => {
    const request = context.req.raw;
    const requestPath = context.req.path;
    try {
      const denied = await authorizeRead(request, requestPath);
      if (denied) return denied;
      const artifactId = context.req.param('artifactId');
      if (!artifactsGatewayArtifact(artifactId)) {
        return jsonResponse({
          ok: false,
          error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found.' },
        }, 404);
      }
      return jsonResponse({
        ok: true,
        artifactId,
        shares: listArtifactShares({
          home: resolveArtifactsHome(),
          artifactId,
          nowMs: now(),
        }),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.post('/gateway/artifacts/:artifactId/shares', async (context) => {
    const request = context.req.raw;
    const requestPath = context.req.path;
    try {
      const body = await context.req.text();
      const denied = await authorizeWrite(request, requestPath, body);
      if (denied) return denied;
      const artifactId = context.req.param('artifactId');
      if (!artifactsGatewayArtifact(artifactId)) {
        return jsonResponse({
          ok: false,
          error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found.' },
        }, 404);
      }
      const parsed = parseJsonObject(body);
      const share = createArtifactShare({
        home: resolveArtifactsHome(),
        artifactId,
        expiresInSeconds: parsed.expiresInSeconds,
        nowMs: now(),
      });
      return jsonResponse({
        ok: true,
        share: {
          id: share.id,
          artifactId: share.artifactId,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
          active: share.active,
          url: publicArtifactShareUrl(share.url),
        },
      }, 201);
    } catch (error: unknown) {
      return invalidRequest(error);
    }
  });

  app.delete('/gateway/artifacts/:artifactId/shares/:shareId', async (context) => {
    const request = context.req.raw;
    const requestPath = context.req.path;
    try {
      const denied = await authorizeWrite(request, requestPath, '');
      if (denied) return denied;
      const share = revokeArtifactShare({
        home: resolveArtifactsHome(),
        artifactId: context.req.param('artifactId'),
        shareId: context.req.param('shareId'),
        nowMs: now(),
      });
      if (!share) {
        return jsonResponse({
          ok: false,
          error: {
            code: 'ARTIFACT_SHARE_NOT_FOUND',
            message: 'Artifact share not found.',
          },
        }, 404);
      }
      return jsonResponse({ ok: true, share });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
