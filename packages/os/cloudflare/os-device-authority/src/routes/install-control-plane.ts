import type { Hono } from 'hono';

import { projectAuthorityWorkspaceNodeToDashboardDevice } from '../../../../scripts/lib/install-control-plane';
import {
  INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
  createInstallDiagnosticUploadHandler,
  createInstallTelemetryIngestHandler,
} from '../../../../scripts/lib/install-control-plane-http';
import { json } from '../http';
import type { DeviceAuthorityRuntime } from '../types';

export const INSTALL_CONTROL_PLANE_DEVICE_DIRECTORY_PATH =
  '/internal/install-control-plane/devices' as const;

function internalEdgeAuthorized(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): boolean {
  const expected = runtime.workspaceEdgeInternalSigningSecret?.trim();
  const actual = request.headers.get('x-consuelo-internal-auth-secret')?.trim();
  return Boolean(expected && actual && actual === expected);
}

export function registerInstallControlPlaneRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.post(INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, async (c) => {
    const repository = runtime.installControlPlaneRepository;
    if (!repository) {
      return json({ error: 'install_control_plane_unavailable' }, { status: 503 });
    }
    const handler = createInstallTelemetryIngestHandler({
      repository,
      now: runtime.now,
    });
    return handler(c.req.raw);
  });

  app.post(INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH, async (c) => {
    const store = runtime.installDiagnosticBundleStore;
    if (!store) {
      return json({ error: 'install_diagnostic_store_unavailable' }, { status: 503 });
    }
    return createInstallDiagnosticUploadHandler({ store })(c.req.raw);
  });

  app.get(INSTALL_CONTROL_PLANE_DEVICE_DIRECTORY_PATH, async (c) => {
    if (!internalEdgeAuthorized(c.req.raw, runtime)) {
      return json({ error: 'forbidden' }, { status: 403 });
    }
    try {
      const nodes = await runtime.store.listAllWorkspaceNodes();
      return json({
        devices: nodes
          .map((node) =>
            projectAuthorityWorkspaceNodeToDashboardDevice(node, {
              nowMs: runtime.now(),
            }),
          )
          .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
      });
    } catch {
      return json({ error: 'device_directory_unavailable' }, { status: 503 });
    }
  });
}
