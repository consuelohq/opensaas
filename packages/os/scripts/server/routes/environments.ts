import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';

import {
  applyEnvironmentGatewayDelete,
  applyEnvironmentGatewayUpsert,
  readEnvironmentGatewaySnapshot,
  resolveEnvironmentGatewayHome,
} from '../../lib/environment-gateway';
import type { ControlPlaneAuditActor } from '../../lib/control-plane-audit';
import { authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';

const SNAPSHOT_PATH = '/gateway/environments/snapshot';
const UPSERT_PATH = '/gateway/environments/upsert';
const DELETE_PATH = '/gateway/environments/delete';
const READ_SCOPE = 'route:/gateway/environments:read';
const WRITE_SCOPE = 'route:/gateway/environments:write';

function requireEnvironmentHome(): string | Response {
  const home = resolveEnvironmentGatewayHome();
  if (home) return home;
  return jsonResponse({
    ok: false,
    error: { code: 'OS_HOME_REQUIRED', message: 'Consuelo OS home is required for environments.' },
  }, 500);
}

function workspaceIdFromRequest(request: Request): string | Response {
  const workspaceId = request.headers.get('x-consuelo-workspace-id')?.trim();
  if (workspaceId) return workspaceId;
  return jsonResponse({
    ok: false,
    error: { code: 'WORKSPACE_ID_REQUIRED', message: 'Signed workspace identity is required.' },
  }, 403);
}

function actorFromRequest(request: Request, workspaceId: string): ControlPlaneAuditActor {
  return {
    actorType: 'user',
    actorId: request.headers.get('x-consuelo-caller-id')?.trim() || 'signed-caller',
    workspaceId,
    correlationId: request.headers.get('x-consuelo-request-id')?.trim() || randomUUID(),
    ...(request.headers.get('x-consuelo-device-id')?.trim()
      ? { nodeId: request.headers.get('x-consuelo-device-id')!.trim() }
      : {}),
    ...(request.headers.get('x-consuelo-application-id')?.trim()
      ? { applicationId: request.headers.get('x-consuelo-application-id')!.trim() }
      : {}),
  };
}

export function createEnvironmentRoutes(): Hono {
  const app = new Hono();

  app.get(SNAPSHOT_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeSignedRequest({
        request,
        path: SNAPSHOT_PATH,
        body: '',
        requiredScope: READ_SCOPE,
      });
      if (denied) return denied;
      const home = requireEnvironmentHome();
      if (home instanceof Response) return home;
      const workspaceId = workspaceIdFromRequest(request);
      if (workspaceId instanceof Response) return workspaceId;
      const result = await readEnvironmentGatewaySnapshot(home, workspaceId);
      if (!result.ok) return jsonResponse({ ok: false, error: result.error }, result.status);
      return jsonResponse({ ok: true, snapshot: result.snapshot });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  for (const route of [
    { path: UPSERT_PATH, operation: 'upsert' as const },
    { path: DELETE_PATH, operation: 'delete' as const },
  ]) {
    app.post(route.path, async (context) => {
      const request = context.req.raw;
      try {
        const body = await request.clone().text();
        const denied = await authorizeSignedRequest({
          request,
          path: route.path,
          body,
          requiredScope: WRITE_SCOPE,
        });
        if (denied) return denied;
        const home = requireEnvironmentHome();
        if (home instanceof Response) return home;
        const workspaceId = workspaceIdFromRequest(request);
        if (workspaceId instanceof Response) return workspaceId;
        const actor = actorFromRequest(request, workspaceId);
        const result = route.operation === 'upsert'
          ? await applyEnvironmentGatewayUpsert(home, workspaceId, body, actor)
          : await applyEnvironmentGatewayDelete(home, workspaceId, body, actor);
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, result.status);
        return jsonResponse({
          ok: true,
          snapshot: result.snapshot,
          ...(result.environment ? { environment: result.environment, created: result.created } : {}),
          ...(result.deletedEnvironmentId ? { deletedEnvironmentId: result.deletedEnvironmentId } : {}),
        });
      } catch (error: unknown) {
        return internalError(error);
      }
    });
  }

  return app;
}
