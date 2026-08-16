import type { Hono } from 'hono';

import {
  MANAGED_CLOUD_ENROLLMENT_TTL_MS,
  MANAGED_CLOUD_PROVISIONING_LEASE_MS,
  publicManagedCloudProvisioningJob,
} from '../../../../scripts/lib/managed-cloud-provisioning';
import { createWorkspaceReleaseManagedSiteRefreshSql } from '../../../../scripts/lib/workspace-edge-route-seed';
import { json } from '../http';
import type { DeviceAuthorityRuntime, Grant } from '../types';
import {
  devicePublicKeyThumbprint,
  hashHex,
  hmac,
  rand,
} from '../utils';
import { registerApprovedWorkspaceRoute } from '../services/connectors';
import {
  approvedJson,
  commitGrantApproval,
  failGrantWorkspaceRouteSetup,
  prepareGrantApproval,
} from '../services/grants';

const jsonHeaders = { 'cache-control': 'no-store' } as const;

const unauthorized = (): Response =>
  json(
    { error: { code: 'MANAGED_CLOUD_PROVISIONER_UNAUTHORIZED', message: 'Provisioner authorization is required.' } },
    { status: 401, headers: jsonHeaders },
  );

const bearerToken = (request: Request): string | undefined => {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  return authorization.match(/^Bearer ([A-Za-z0-9_-]{16,512})$/)?.[1];
};

async function sameSecret(actual: string | undefined, expected: string | undefined): Promise<boolean> {
  if (!actual || !expected?.trim()) return false;
  const [left, right] = await Promise.all([hashHex(actual), hashHex(expected.trim())]);
  return left === right;
}

const enrollmentTokenFor = async (
  runtime: DeviceAuthorityRuntime,
  jobId: string,
  nonce: string,
): Promise<string> => {
  const secret = runtime.managedCloudEnrollmentSecret?.trim();
  if (!secret) throw new Error('managed cloud enrollment secret is not configured');
  return hmac(secret, `${jobId}:${nonce}`);
};

async function readObject(request: Request): Promise<Record<string, unknown> | undefined> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return undefined;
  }
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function handleReleaseSiteSnapshotRefresh(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  if (!(await sameSecret(bearerToken(request), runtime.managedCloudProvisionerSecret))) {
    return unauthorized();
  }
  if (!runtime.workspaceRouteRegistry?.exec) {
    return json(
      { error: { code: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE', message: 'Workspace route registry is unavailable.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
  const body = await readObject(request);
  const siteContentHashes = body?.siteContentHashes;
  if (
    typeof body?.versionId !== 'string'
    || typeof body.snapshotWorkspaceId !== 'string'
    || !siteContentHashes
    || typeof siteContentHashes !== 'object'
    || Array.isArray(siteContentHashes)
  ) {
    return json(
      { error: { code: 'INVALID_RELEASE_SITE_SNAPSHOT_REFRESH', message: 'Release site snapshot refresh payload is invalid.' } },
      { status: 400, headers: jsonHeaders },
    );
  }
  let sql: string;
  try {
    sql = createWorkspaceReleaseManagedSiteRefreshSql({
      versionId: body.versionId,
      snapshotWorkspaceId: body.snapshotWorkspaceId,
      siteContentHashes: siteContentHashes as Record<string, string>,
    });
  } catch {
    return json(
      { error: { code: 'INVALID_RELEASE_SITE_SNAPSHOT_REFRESH', message: 'Release site snapshot refresh payload is invalid.' } },
      { status: 400, headers: jsonHeaders },
    );
  }
  try {
    await runtime.workspaceRouteRegistry.exec(sql);
    return json(
      { ok: true, updated: true, versionId: body.versionId },
      { headers: jsonHeaders },
    );
  } catch {
    return json(
      { error: { code: 'WORKSPACE_ROUTE_REFRESH_FAILED', message: 'Workspace site routes could not be refreshed.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
}

async function handleClaim(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  if (!(await sameSecret(bearerToken(request), runtime.managedCloudProvisionerSecret))) {
    return unauthorized();
  }
  try {
    const nowMs = runtime.now();
    const claimed = await runtime.store.claimNextManagedCloudProvisioningJob({
      leaseId: rand('lease', 24),
      nowMs,
      leaseExpiresAt: nowMs + MANAGED_CLOUD_PROVISIONING_LEASE_MS,
      enrollmentNonce: rand('enr', 32),
      enrollmentExpiresAt: nowMs + MANAGED_CLOUD_ENROLLMENT_TTL_MS,
    });
    if (claimed.status === 'empty') return new Response(null, { status: 204 });
    const nonce = claimed.job.enrollmentNonce;
    if (!nonce) throw new Error('claimed provisioning job is missing enrollment nonce');
    return json(
      {
        job: publicManagedCloudProvisioningJob(claimed.job),
        workspace: {
          workspaceId: claimed.job.workspaceId,
          workspaceSlug: claimed.job.workspaceSlug,
          workspaceHost: claimed.job.workspaceHost,
        },
        leaseId: claimed.job.leaseId,
        enrollmentToken: await enrollmentTokenFor(runtime, claimed.job.jobId, nonce),
      },
      { headers: jsonHeaders },
    );
  } catch {
    return json(
      { error: { code: 'MANAGED_CLOUD_PROVISIONER_UNAVAILABLE', message: 'Provisioning queue is temporarily unavailable.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
}

async function handleState(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
  if (!(await sameSecret(bearerToken(request), runtime.managedCloudProvisionerSecret))) {
    return unauthorized();
  }
  const body = await readObject(request);
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const leaseId = typeof body?.leaseId === 'string' ? body.leaseId.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : '';
  if (!jobId || !leaseId || !['provisioning', 'booting', 'failed'].includes(status)) {
    return json(
      { error: { code: 'MANAGED_CLOUD_PROVISIONER_STATE_INVALID', message: 'A valid provisioning state update is required.' } },
      { status: 400, headers: jsonHeaders },
    );
  }
  const updated = await runtime.store.updateManagedCloudProvisioningJob({
    jobId,
    leaseId,
    status: status as 'provisioning' | 'booting' | 'failed',
    nowMs: runtime.now(),
    ...(typeof body?.errorCode === 'string' ? { errorCode: body.errorCode.slice(0, 80) } : {}),
    ...(typeof body?.errorMessage === 'string' ? { errorMessage: body.errorMessage.slice(0, 240) } : {}),
  });
  if (!updated) {
    return json(
      { error: { code: 'MANAGED_CLOUD_PROVISIONER_LEASE_INVALID', message: 'The provisioning lease is no longer valid.' } },
      { status: 409, headers: jsonHeaders },
    );
  }
  return json({ job: publicManagedCloudProvisioningJob(updated) }, { headers: jsonHeaders });
  } catch (error: unknown) {
    return json(
      { error: { code: 'MANAGED_CLOUD_PROVISIONER_UNAVAILABLE', message: 'Provisioning state could not be updated.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
}

async function handleEnroll(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
  const body = await readObject(request);
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const enrollmentToken =
    typeof body?.enrollmentToken === 'string' ? body.enrollmentToken.trim() : '';
  const publicKeyJwk =
    typeof body?.devicePublicKeyJwk === 'string' ? body.devicePublicKeyJwk.trim() : '';
  if (!jobId || !enrollmentToken || !publicKeyJwk) {
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_INVALID', message: 'Provisioning enrollment credentials are required.' } },
      { status: 400, headers: jsonHeaders },
    );
  }

  const job = await runtime.store.byManagedCloudProvisioningJob(jobId);
  const nonce = job?.enrollmentNonce;
  if (!job || !nonce || !job.enrollmentExpiresAt || job.enrollmentExpiresAt < runtime.now()) {
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_EXPIRED', message: 'This provisioning enrollment is no longer valid.' } },
      { status: 409, headers: jsonHeaders },
    );
  }
  const expectedToken = await enrollmentTokenFor(runtime, job.jobId, nonce);
  if (!(await sameSecret(enrollmentToken, expectedToken))) {
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_DENIED', message: 'This provisioning enrollment is not valid.' } },
      { status: 401, headers: jsonHeaders },
    );
  }

  let thumbprint: string;
  try {
    const parsed = JSON.parse(publicKeyJwk) as Record<string, unknown>;
    if (parsed.kty !== 'OKP' || parsed.crv !== 'Ed25519' || typeof parsed.x !== 'string') {
      throw new Error('unsupported device public key');
    }
    thumbprint = await devicePublicKeyThumbprint(publicKeyJwk);
  } catch {
    return json(
      { error: { code: 'MANAGED_CLOUD_DEVICE_KEY_INVALID', message: 'The node device key is invalid.' } },
      { status: 400, headers: jsonHeaders },
    );
  }

  const consumed = await runtime.store.consumeManagedCloudProvisioningEnrollment({
    jobId,
    nowMs: runtime.now(),
  });
  if (!consumed) {
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_ALREADY_USED', message: 'This provisioning enrollment has already been used.' } },
      { status: 409, headers: jsonHeaders },
    );
  }

  const grant: Grant = {
    hash: rand('mcg', 32),
    userCode: 'managed-cloud-provisioning',
    status: 'pending',
    expiresAt: runtime.now() + MANAGED_CLOUD_ENROLLMENT_TTL_MS,
    interval: 5,
    devicePublicKeyJwk: publicKeyJwk,
    deviceKeyAlgorithm: 'Ed25519',
    devicePublicKeyThumbprint: thumbprint,
    workspaceId: consumed.workspaceId,
    canonicalWorkspaceId: consumed.workspaceId,
    workspaceSlug: consumed.workspaceSlug,
    workspaceHost: consumed.workspaceHost,
    nodeId: consumed.nodeId,
    nodeName: consumed.nodeName,
    nodePlatform: typeof body?.platform === 'string' ? body.platform.slice(0, 40) : 'linux',
    nodeArchitecture:
      typeof body?.architecture === 'string' ? body.architecture.slice(0, 40) : undefined,
    nodeChannel: typeof body?.channel === 'string' ? body.channel.slice(0, 40) : 'stable',
    nodeCapabilities: Array.isArray(body?.capabilities)
      ? body.capabilities.filter((value): value is string => typeof value === 'string').slice(0, 32)
      : ['mcp', 'tools'],
    nodeLastSeenAt: undefined,
  };

  try {
    await prepareGrantApproval({
      store: runtime.store,
      grant,
      accountId: consumed.accountId,
      authMethod: 'managed_cloud_provisioning',
      nowMs: runtime.now(),
    });
    await registerApprovedWorkspaceRoute({
      routeRegistry: runtime.workspaceRouteRegistry,
      workspaceConnectorProvisioner: runtime.workspaceConnectorProvisioner,
      grant,
      defaultSiteSnapshot: runtime.defaultSiteSnapshot,
    });
    await commitGrantApproval({
      store: runtime.store,
      grant,
      accountId: consumed.accountId,
      nowMs: runtime.now(),
    });
    return json(approvedJson(grant, runtime.workspaceEdgeInternalSigningSecret), {
      headers: jsonHeaders,
    });
  } catch (error: unknown) {
    try {
      await failGrantWorkspaceRouteSetup({ store: runtime.store, grant, error });
    } catch {
      // The provisioning job remains the customer-facing source of truth below.
    }
    await runtime.store.updateManagedCloudProvisioningJob({
      jobId,
      status: 'failed',
      nowMs: runtime.now(),
      errorCode: 'NODE_ENROLLMENT_FAILED',
      errorMessage: 'The node could not finish its secure workspace connection.',
    });
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_FAILED', message: 'The cloud node could not finish connecting.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
  } catch (error: unknown) {
    return json(
      { error: { code: 'MANAGED_CLOUD_ENROLLMENT_UNAVAILABLE', message: 'The cloud node could not finish connecting.' } },
      { status: 503, headers: jsonHeaders },
    );
  }
}

export function registerManagedCloudProvisioningRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.post('/internal/release/site-snapshots/refresh', (context) =>
    handleReleaseSiteSnapshotRefresh(context.req.raw, runtime),
  );
  app.post('/internal/managed-cloud/provisioning/claim', (context) =>
    handleClaim(context.req.raw, runtime),
  );
  app.post('/internal/managed-cloud/provisioning/state', (context) =>
    handleState(context.req.raw, runtime),
  );
  app.post('/managed-cloud/provisioning/enroll', (context) =>
    handleEnroll(context.req.raw, runtime),
  );
}
