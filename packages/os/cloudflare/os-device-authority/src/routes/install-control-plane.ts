import type { Hono } from 'hono';

import { projectAuthorityWorkspaceNodeToDashboardDevice } from '../../../../scripts/lib/install-control-plane';
import {
  INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
  INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH,
  createInstallDiagnosticUploadHandler,
  createInstallEvidenceIngestHandler,
  createInstallObservabilityConfigHandler,
  createInstallTelemetryIngestHandler,
} from '../../../../scripts/lib/install-control-plane-http';
import { isInstallId } from '../../../../scripts/lib/install-telemetry-contract';
import { json } from '../http';
import type { DeviceAuthorityRuntime } from '../types';

export const INSTALL_CONTROL_PLANE_DEVICE_DIRECTORY_PATH =
  '/internal/install-control-plane/devices' as const;
export const INSTALL_CONTROL_PLANE_USER_DIRECTORY_PATH =
  '/internal/install-control-plane/users' as const;
export const INSTALL_CONTROL_PLANE_DIAGNOSTIC_READ_PREFIX =
  '/internal/install-control-plane/diagnostics' as const;

const USER_DIRECTORY_ASSERTION_HEADER =
  'x-consuelo-user-directory-assertion' as const;
const USER_DIRECTORY_ASSERTION_PURPOSE =
  'install-control-plane-user-sync' as const;
const USER_DIRECTORY_ASSERTION_MAX_TTL_MS = 5 * 60 * 1000;

type UserDirectoryAssertionPayload = {
  purpose: typeof USER_DIRECTORY_ASSERTION_PURPOSE;
  user_id: string;
  email?: string;
  display_name?: string;
  workspace_id?: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyUserDirectoryAssertion(
  assertion: string | null,
  secret: string | undefined,
  nowMs: number,
): Promise<UserDirectoryAssertionPayload | undefined> {
  const sharedSecret = secret?.trim();
  if (!assertion || !sharedSecret) return undefined;
  const [encodedPayload, encodedSignature, ...extra] = assertion.split('.');
  if (!encodedPayload || !encodedSignature || extra.length > 0) return undefined;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(sharedSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!verified) return undefined;
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as Partial<UserDirectoryAssertionPayload>;
    const expiresAtMs = Date.parse(payload.expires_at ?? '');
    const createdAtMs = Date.parse(payload.created_at ?? '');
    const updatedAtMs = Date.parse(payload.updated_at ?? '');
    if (
      payload.purpose !== USER_DIRECTORY_ASSERTION_PURPOSE ||
      typeof payload.user_id !== 'string' ||
      !payload.user_id.trim() ||
      payload.user_id.length > 256 ||
      payload.user_id.startsWith('google:') ||
      !Number.isFinite(createdAtMs) ||
      !Number.isFinite(updatedAtMs) ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= nowMs ||
      expiresAtMs > nowMs + USER_DIRECTORY_ASSERTION_MAX_TTL_MS ||
      (payload.email !== undefined &&
        (typeof payload.email !== 'string' ||
          payload.email.length > 320 ||
          !payload.email.includes('@'))) ||
      (payload.display_name !== undefined &&
        (typeof payload.display_name !== 'string' || payload.display_name.length > 256)) ||
      (payload.workspace_id !== undefined &&
        (typeof payload.workspace_id !== 'string' ||
          !payload.workspace_id.trim() ||
          payload.workspace_id.length > 256))
    ) {
      return undefined;
    }
    return payload as UserDirectoryAssertionPayload;
  } catch {
    return undefined;
  }
}

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
  app.get(INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH, (c) =>
    createInstallObservabilityConfigHandler({
      sentryDsn: runtime.installSentryDsn,
    })(c.req.raw),
  );

  app.post(INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, (c) => {
    const repository = runtime.installControlPlaneRepository;
    const installTelemetryObserver = runtime.installTelemetryObserver;
    if (!repository) {
      return json({ error: 'install_control_plane_unavailable' }, { status: 503 });
    }
    const handler = createInstallTelemetryIngestHandler({
      repository,
      now: runtime.now,
      onAccepted: installTelemetryObserver
        ? (event, metadata) => {
            const cloudflareRayId = metadata.request.headers.get('cf-ray')?.trim();
            return installTelemetryObserver.observe(event, {
              ...(cloudflareRayId
                ? { cloudflareRayId }
                : {}),
            });
          }
        : undefined,
    });
    return handler(c.req.raw);
  });

  app.post(INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH, (c) => {
    const repository = runtime.installControlPlaneRepository;
    if (!repository) {
      return json({ error: 'install_control_plane_unavailable' }, { status: 503 });
    }
    return createInstallEvidenceIngestHandler({
      repository,
      now: runtime.now,
    })(c.req.raw);
  });

  app.post(INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH, (c) => {
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

  app.get(`${INSTALL_CONTROL_PLANE_DIAGNOSTIC_READ_PREFIX}/:installId`, async (c) => {
    if (!internalEdgeAuthorized(c.req.raw, runtime)) {
      return json({ error: 'forbidden' }, { status: 403 });
    }
    const installId = c.req.param('installId');
    if (!isInstallId(installId)) {
      return json({ error: 'invalid_install_id' }, { status: 400 });
    }
    const store = runtime.installDiagnosticBundleStore;
    if (!store) {
      return json({ error: 'install_diagnostic_store_unavailable' }, { status: 503 });
    }
    try {
      const diagnostic = await store.get(installId);
      if (!diagnostic) return json({ error: 'not_found' }, { status: 404 });
      return new Response(diagnostic.body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${installId}-diagnostic.json"`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch {
      return json({ error: 'install_diagnostic_read_failed' }, { status: 503 });
    }
  });

  app.post(INSTALL_CONTROL_PLANE_USER_DIRECTORY_PATH, async (c) => {
    const repository = runtime.installControlPlaneRepository;
    if (!repository) {
      return json({ error: 'install_control_plane_unavailable' }, { status: 503 });
    }
    const payload = await verifyUserDirectoryAssertion(
      c.req.raw.headers.get(USER_DIRECTORY_ASSERTION_HEADER),
      runtime.approvalAssertionSecret,
      runtime.now(),
    );
    if (!payload) {
      return json({ error: 'invalid_user_directory_assertion' }, { status: 400 });
    }
    try {
      await repository.upsertUser({
        userId: payload.user_id,
        ...(payload.email ? { email: payload.email } : {}),
        ...(payload.display_name ? { displayName: payload.display_name } : {}),
        workspaceIds: payload.workspace_id ? [payload.workspace_id] : [],
        createdAt: payload.created_at,
        updatedAt: payload.updated_at,
      });
      return new Response(null, {
        status: 204,
        headers: { 'cache-control': 'no-store' },
      });
    } catch {
      return json({ error: 'user_directory_sync_failed' }, { status: 503 });
    }
  });
}
