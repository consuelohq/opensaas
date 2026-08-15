import { Hono } from 'hono';

import { resolveConsueloHome } from '../../lib/consuelo-home';
import { listSealedCredentials } from '../../lib/node-sealed-credential-store';
import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';

const BINDINGS_PATH = '/gateway/secrets/bindings';
const READ_SCOPE = 'route:/gateway/secrets:read';

function requiredHeader(
  request: Request,
  names: string[],
  code: string,
  message: string,
): string | Response {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return jsonResponse({ ok: false, error: { code, message } }, 403);
}

export function createSecretRoutes(): Hono {
  const app = new Hono();

  app.get(BINDINGS_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeSignedRequest({
        request,
        path: BINDINGS_PATH,
        body: '',
        requiredScope: READ_SCOPE,
      });
      if (denied) return denied;

      const workspaceId = requiredHeader(
        request,
        ['x-consuelo-workspace-id'],
        'WORKSPACE_ID_REQUIRED',
        'Signed workspace identity is required.',
      );
      if (workspaceId instanceof Response) return workspaceId;
      const nodeId = requiredHeader(
        request,
        ['x-consuelo-node-id', 'x-consuelo-device-id'],
        'NODE_ID_REQUIRED',
        'Signed node identity is required.',
      );
      if (nodeId instanceof Response) return nodeId;

      return jsonResponse({
        ok: true,
        bindings: listSealedCredentials({
          home: resolveConsueloHome(),
          workspaceId,
          nodeId,
        }),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  return app;
}
