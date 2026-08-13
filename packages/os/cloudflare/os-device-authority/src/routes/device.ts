import type { Hono } from 'hono';

import { CONSUELO_DEVICE_VERIFICATION_URL } from '../../../../scripts/lib/workspace-device-authorization';
import {
  INSTALL_ID_HEADER,
  INSTALL_TELEMETRY_SCHEMA_VERSION,
  createInstallEventId,
  isInstallId,
} from '../../../../scripts/lib/install-telemetry-contract';
import {
  ALLOWED_AUTH_METHODS,
  DEVICE_PROOF_KEY,
  DEVICE_PROOF_PAYLOAD_KEY,
  GRANT_TYPE,
  INTERVAL,
  TTL_MS,
  WORKSPACE_ROUTE_SETUP_FAILURE_CODE,
} from '../constants';
import { json, methodNotAllowed, page, text } from '../http';
import {
  approvalAuth,
  verifyDevicePublicKeyProof,
} from '../security/device-auth';
import { registerApprovedWorkspaceRoute } from '../services/connectors';
import {
  approvedJson,
  assignGrantWorkspace,
  commitGrantApproval,
  failGrantWorkspaceRouteSetup,
  prepareGrantApproval,
} from '../services/grants';
import type { DeviceAuthorityRuntime, Grant } from '../types';
import {
  devicePublicKeyThumbprint,
  hash,
  host,
  optionalNodeId,
  params,
  rand,
  slug,
  userCode,
  verifyUrl,
} from '../utils';

function correlatedInstallId(request: Request) {
  const value = request.headers.get(INSTALL_ID_HEADER)?.trim() ?? '';
  return value && isInstallId(value) ? value : undefined;
}

async function recordCanonicalInstallIdentity(
  runtime: DeviceAuthorityRuntime,
  grant: Grant,
): Promise<void> {
  if (
    !runtime.installControlPlaneRepository ||
    !grant.installId ||
    !grant.installIdentityEventId ||
    !grant.canonicalUserId ||
    !grant.canonicalWorkspaceId
  ) {
    return;
  }
  const occurredAt = new Date(runtime.now()).toISOString();
  try {
    await runtime.installControlPlaneRepository.ingestEvent(
      {
        schemaVersion: INSTALL_TELEMETRY_SCHEMA_VERSION,
        eventId: grant.installIdentityEventId,
        installId: grant.installId,
        producer: 'device_authority',
        name: 'install.identity.bound',
        stage: 'node_registration',
        outcome: 'succeeded',
        occurredAt,
        sequence: 1,
        identity: {
          state: 'canonical',
          userId: grant.canonicalUserId,
          workspaceId: grant.canonicalWorkspaceId,
          ...(grant.nodeId ? { nodeId: grant.nodeId } : {}),
        },
        context: {
          ...(grant.nodeRole ? { nodeRole: grant.nodeRole } : {}),
          ...(grant.nodeStatus ? { nodeStatus: grant.nodeStatus } : {}),
        },
      },
      { trust: 'trusted', ingestedAt: occurredAt },
    );
  } catch {
    // Correlation/telemetry must never change device authorization control flow.
  }
}

async function handleDeviceRequest(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = runtime;
    const origin = runtime.origin;
    const now = runtime.now;

    if (url.pathname === '/login/device') {
      if (request.method !== 'GET')
        return new Response('Not found\n', { status: 404 });
      return text(
        page({ code: url.searchParams.get('user_code') ?? '', origin }),
      );
    }

    if (url.pathname === '/login/device/code') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      const publicKey = (p.get('device_public_key_jwk') ?? '').trim();
      if (!publicKey)
        return json({ error: 'device_public_key_required' }, { status: 400 });
      const requestedWorkspaceSlug =
        p.get('workspace_slug') ?? p.get('workspace_name') ?? '';
      const workspaceSlug = requestedWorkspaceSlug.trim()
        ? slug(requestedWorkspaceSlug)
        : undefined;
      const workspaceHost = workspaceSlug
        ? host(
            p.get('workspace_host')?.trim() ||
              `${workspaceSlug}.consuelohq.com`,
          )
        : undefined;
      const requestedNodeId = optionalNodeId(p.get('node_id') ?? '');
      const requestedNodeName = (p.get('node_name') ?? '').trim();
      const nodeCapabilities = (p.get('node_capabilities') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 32);
      const deviceCode = rand('dev', 24);
      const code = userCode();
      const installId = correlatedInstallId(request);
      const g: Grant = {
        hash: await hash(deviceCode),
        userCode: code,
        ...(installId
          ? {
              installId,
              installIdentityEventId: createInstallEventId(),
            }
          : {}),
        ...(workspaceSlug && workspaceHost
          ? { workspaceSlug, workspaceHost }
          : {}),
        ...(requestedNodeId ? { nodeId: requestedNodeId } : {}),
        ...(requestedNodeName ? { nodeName: requestedNodeName } : {}),
        ...(p.get('node_platform')?.trim()
          ? { nodePlatform: p.get('node_platform')!.trim() }
          : {}),
        ...(p.get('node_architecture')?.trim()
          ? { nodeArchitecture: p.get('node_architecture')!.trim() }
          : {}),
        ...(p.get('node_channel')?.trim()
          ? { nodeChannel: p.get('node_channel')!.trim() }
          : {}),
        ...(nodeCapabilities.length > 0 ? { nodeCapabilities } : {}),
        // A reinstall mints a new device key for an existing node id. The operator declares that
        // intent here; without it registration still fails closed on the thumbprint mismatch, so
        // the flag widens nothing on its own.
        ...(p.get('node_identity_replacement')?.trim() === 'true'
          ? { nodeIdentityReplacement: true }
          : {}),
        status: 'pending',
        expiresAt: now() + TTL_MS,
        interval: INTERVAL,
        devicePublicKeyJwk: publicKey,
        deviceKeyAlgorithm: p.get('device_key_algorithm')?.trim() || 'Ed25519',
        devicePublicKeyThumbprint: await devicePublicKeyThumbprint(publicKey),
      };
      await input.store.put(g);
      return json({
        device_code: deviceCode,
        user_code: code,
        verification_uri: CONSUELO_DEVICE_VERIFICATION_URL,
        verification_uri_complete: verifyUrl(origin, code),
        expires_in: Math.floor(TTL_MS / 1000),
        interval: INTERVAL,
      });
    }
    if (url.pathname === '/login/device/workspace') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      const deviceCode = p.get('device_code') ?? '';
      const g = await input.store.byHash(await hash(deviceCode));
      if (!g) return json({ error: 'access_denied' }, { status: 400 });
      if (now() >= g.expiresAt) {
        await input.store.del(g.hash);
        return json({ error: 'expired_token' }, { status: 400 });
      }
      if (!g.accountId || !g.accountAuthMethod)
        return json({ error: 'account_session_required' }, { status: 401 });
      const clientId = p.get('client_id') ?? '';
      const proofPayload = p.get(DEVICE_PROOF_PAYLOAD_KEY) ?? '';
      const proof = p.get(DEVICE_PROOF_KEY) ?? '';
      if (
        !(await verifyDevicePublicKeyProof(g, {
          clientId,
          deviceCode,
          proofPayload,
          proof,
        }))
      )
        return json(
          { error: 'invalid_device_public_key_proof' },
          { status: 400 },
        );
      const workspaceSlug = slug(
        p.get('workspace_slug') ?? p.get('workspace_name') ?? '',
      );
      const workspaceHost = host(
        p.get('workspace_host')?.trim() || `${workspaceSlug}.consuelohq.com`,
      );
      assignGrantWorkspace({ grant: g, workspaceSlug, workspaceHost });
      try {
        await prepareGrantApproval({
          store: input.store,
          grant: g,
          accountId: g.accountId,
          authMethod: g.accountAuthMethod,
          nowMs: now(),
        });
        await registerApprovedWorkspaceRoute({
          routeRegistry: input.workspaceRouteRegistry,
          workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
          grant: g,
          defaultSiteSnapshot: input.defaultSiteSnapshot,
        });
      } catch (error: unknown) {
        const failureMessage = await failGrantWorkspaceRouteSetup({
          store: input.store,
          grant: g,
          error,
        });
        return json(
          {
            error: WORKSPACE_ROUTE_SETUP_FAILURE_CODE,
            message: failureMessage,
          },
          { status: 502 },
        );
      }
      await commitGrantApproval({
        store: input.store,
        grant: g,
        accountId: g.accountId,
        nowMs: now(),
      });
      await recordCanonicalInstallIdentity(runtime, g);
      await input.store.del(g.hash);
      return json(approvedJson(g, runtime.workspaceEdgeInternalSigningSecret));
    }

    if (url.pathname === '/login/device/approve') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      const code = p.get('user_code') ?? '';
      const g = await input.store.byUserCode(code);
      if (!g) return json({ error: 'device_code_not_found' }, { status: 404 });
      if (now() >= g.expiresAt) {
        await input.store.del(g.hash);
        return json({ error: 'expired_token' }, { status: 410 });
      }
      const auth = await approvalAuth(
        request,
        input.approvalAssertionSecret,
        now(),
      );
      if (auth.status === 'missing')
        return json({ error: 'account_session_required' }, { status: 401 });
      if (auth.status === 'weak')
        return json(
          {
            error: 'stronger_auth_required',
            allowed_auth_methods: [...ALLOWED_AUTH_METHODS],
          },
          { status: 403 },
        );
      const existingWorkspace = await input.store.byAccountWorkspace(
        auth.accountId,
      );
      if (
        auth.workspaceId &&
        !auth.accountId.startsWith('google:')
      ) {
        g.canonicalUserId = auth.accountId;
        g.canonicalWorkspaceId = auth.workspaceId;
        g.workspaceId = auth.workspaceId;
      }
      if (existingWorkspace) {
        assignGrantWorkspace({
          grant: g,
          workspaceId: g.canonicalWorkspaceId ?? existingWorkspace.workspaceId,
          workspaceSlug: existingWorkspace.workspaceSlug,
          workspaceHost: existingWorkspace.workspaceHost,
        });
      }
      if (!g.workspaceSlug || !g.workspaceHost) {
        g.accountId = auth.accountId;
        g.accountAuthMethod = auth.method;
        await input.store.put(g);
        return json({
          status: 'workspace_required',
          account_id: auth.accountId,
          account_auth_method: auth.method,
          device_public_key_thumbprint: g.devicePublicKeyThumbprint,
          device_public_key_bound: true,
        });
      }
      try {
        await prepareGrantApproval({
          store: input.store,
          grant: g,
          accountId: auth.accountId,
          authMethod: auth.method,
          nowMs: now(),
        });
        await registerApprovedWorkspaceRoute({
          routeRegistry: input.workspaceRouteRegistry,
          workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
          grant: g,
          defaultSiteSnapshot: input.defaultSiteSnapshot,
        });
      } catch (error: unknown) {
        const failureMessage = await failGrantWorkspaceRouteSetup({
          store: input.store,
          grant: g,
          error,
        });
        return json(
          {
            error: WORKSPACE_ROUTE_SETUP_FAILURE_CODE,
            message: failureMessage,
          },
          { status: 502 },
        );
      }
      await commitGrantApproval({
        store: input.store,
        grant: g,
        accountId: auth.accountId,
        nowMs: now(),
      });
      await recordCanonicalInstallIdentity(runtime, g);
      return json({
        status: 'approved',
        account_id: auth.accountId,
        account_auth_method: auth.method,
        device_public_key_thumbprint: g.devicePublicKeyThumbprint,
        device_public_key_bound: true,
      });
    }
    if (url.pathname === '/login/oauth/access_token') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      if (p.get('grant_type') !== GRANT_TYPE)
        return json({ error: 'unsupported_grant_type' }, { status: 400 });
      const deviceCode = p.get('device_code') ?? '';
      const g = await input.store.byHash(await hash(deviceCode));
      if (!g) return json({ error: 'access_denied' }, { status: 400 });
      if (now() >= g.expiresAt) {
        await input.store.del(g.hash);
        return json({ error: 'expired_token' }, { status: 400 });
      }
      const clientId = p.get('client_id') ?? '';
      const proofPayload = p.get(DEVICE_PROOF_PAYLOAD_KEY) ?? '';
      const proof = p.get(DEVICE_PROOF_KEY) ?? '';
      if (
        !(await verifyDevicePublicKeyProof(g, {
          clientId,
          deviceCode,
          proofPayload,
          proof,
        }))
      )
        return json(
          { error: 'invalid_device_public_key_proof' },
          { status: 400 },
        );
      if (g.status === 'failed') {
        return json(
          {
            error: g.failureCode ?? WORKSPACE_ROUTE_SETUP_FAILURE_CODE,
            error_description:
              g.failureMessage ?? 'workspace connector provisioning failed',
          },
          { status: 400 },
        );
      }
      if (g.lastPoll && now() - g.lastPoll < g.interval * 1000) {
        g.interval += INTERVAL;
        g.lastPoll = now();
        await input.store.put(g);
        return json(
          { error: 'slow_down', interval: g.interval },
          { status: 400 },
        );
      }
      g.lastPoll = now();
      await input.store.put(g);
      if (g.status !== 'approved') {
        if (g.accountId && (!g.workspaceSlug || !g.workspaceHost)) {
          return json(
            {
              error: 'workspace_required',
              interval: g.interval,
              message:
                'Name this workspace in your terminal to finish device setup.',
            },
            { status: 400 },
          );
        }
        return json(
          { error: 'authorization_pending', interval: g.interval },
          { status: 400 },
        );
      }
      await input.store.del(g.hash);
      return json(approvedJson(g, runtime.workspaceEdgeInternalSigningSecret));
    }
    return new Response('Not found\n', { status: 404 });
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('device request failed');
  }
}

export function registerDeviceRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  const handle = (request: Request) => handleDeviceRequest(request, runtime);
  app.all('/login/device', (context) => handle(context.req.raw));
  app.all('/login/device/code', (context) => handle(context.req.raw));
  app.all('/login/device/workspace', (context) => handle(context.req.raw));
  app.all('/login/device/approve', (context) => handle(context.req.raw));
  app.all('/login/oauth/access_token', (context) => handle(context.req.raw));
}
