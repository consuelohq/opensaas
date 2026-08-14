import { Hono } from 'hono';

import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';
import {
  artifactsGatewayArtifact,
  artifactsGatewayCatalog,
  artifactsGatewayVersions,
  resolveArtifactPublicFile,
} from '../services/artifacts-gateway';

const ARTIFACTS_GATEWAY_PATH = '/gateway/artifacts';

function publicArtifactResponse(pathname: string): Response {
  const file = resolveArtifactPublicFile(pathname);
  if (!file) return new Response('Artifact not found', { status: 404 });
  return new Response(file.body, {
    status: 200,
    headers: {
      'content-type': file.contentType,
      'cache-control': file.contentType.startsWith('text/html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    },
  });
}

async function authorizeRead(request: Request, path: string): Promise<Response | null> {
  return await authorizeSignedRequest({
    request,
    path,
    body: '',
    requiredScope: 'route:/gateway/artifacts:read',
  });
}

export function createArtifactRoutes(): Hono {
  const app = new Hono();

  app.get('/artifacts', (context) => publicArtifactResponse(context.req.path));
  app.get('/artifacts/*', (context) => publicArtifactResponse(context.req.path));

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

  return app;
}
