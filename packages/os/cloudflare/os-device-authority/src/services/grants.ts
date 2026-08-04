import {
  BOOTSTRAP_TTL_MS,
  CLOUDFLARE_TUNNEL_TOKEN_KEY,
  CONNECTOR_TOKEN_KEY,
  TOKEN_KEY,
  WORKSPACE_ROUTE_SETUP_FAILURE_CODE,
} from '../constants';
import { redactWorkspaceRouteSetupFailure } from '../security/redaction';
import type { Grant, Store, StrongerAuthMethod } from '../types';
import {
  connectorIdFromNodeId,
  hashHex,
  host,
  optionalNodeId,
  rand,
  slug,
  workspaceIdFromSlug,
} from '../utils';

export function grantWorkspace(grant: Grant): {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
} {
  if (!grant.workspaceSlug || !grant.workspaceHost) {
    throw new Error('workspace is required before bootstrap can be issued');
  }
  return {
    workspaceId: grant.workspaceId ?? workspaceIdFromSlug(grant.workspaceSlug),
    workspaceSlug: grant.workspaceSlug,
    workspaceHost: grant.workspaceHost,
  };
}

export function assignGrantWorkspace(input: {
  grant: Grant;
  workspaceId?: string;
  workspaceSlug: string;
  workspaceHost: string;
}): void {
  const workspaceSlug = slug(input.workspaceSlug);
  input.grant.workspaceId =
    input.workspaceId ??
    input.grant.workspaceId ??
    workspaceIdFromSlug(workspaceSlug);
  input.grant.workspaceSlug = workspaceSlug;
  input.grant.workspaceHost = host(input.workspaceHost);
}

export async function rememberAccountWorkspace(input: {
  store: Store;
  grant: Grant;
  accountId: string;
  nowMs: number;
}): Promise<void> {
  try {
    const workspace = grantWorkspace(input.grant);
    const existing = await input.store.byAccountWorkspace(input.accountId);
    await input.store.putAccountWorkspace({
      accountId: input.accountId,
      workspaceId: workspace.workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      homeNodeId: existing?.homeNodeId ?? input.grant.nodeId,
      defaultNodeId:
        existing?.defaultNodeId ?? existing?.homeNodeId ?? input.grant.nodeId,
      updatedAt: input.nowMs,
    });
    await input.store.putWorkspaceMembership({
      accountId: input.accountId,
      workspaceId: workspace.workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      status: 'active',
      createdAt: existing?.updatedAt ?? input.nowMs,
      updatedAt: input.nowMs,
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'account workspace persistence failed',
    );
  }
}

export async function registerGrantNode(input: {
  store: Store;
  grant: Grant;
  accountId: string;
  nowMs: number;
}): Promise<void> {
  try {
    const workspace = grantWorkspace(input.grant);
    const existingWorkspace = await input.store.byAccountWorkspace(
      input.accountId,
    );
    const requestedNodeId = input.grant.nodeId
      ? optionalNodeId(input.grant.nodeId)
      : undefined;
    const nodeId =
      requestedNodeId ??
      (existingWorkspace
        ? (optionalNodeId(rand('node', 12)) ?? workspace.workspaceSlug)
        : workspace.workspaceSlug);
    const existingNode = await input.store.byWorkspaceNode(
      input.accountId,
      nodeId,
    );
    const identityChanged =
      existingNode !== undefined &&
      existingNode.devicePublicKeyThumbprint !==
        input.grant.devicePublicKeyThumbprint;
    if (identityChanged && input.grant.nodeIdentityReplacement !== true) {
      // Default stays fail-closed: a mismatched key on an existing node id is a hijack attempt
      // unless the operator explicitly declared a replacement.
      throw new Error('node identity key does not match the registered node');
    }
    // Revocation is checked after the identity rule so a revoked node reports as revoked rather
    // than as a key mismatch, and so a replacement can never resurrect a revoked node.
    if (existingNode?.state === 'revoked') {
      throw new Error('workspace node has been revoked');
    }
    if (identityChanged) {
      // Reaching here means the account owner completed an interactive authorization for a node
      // they already own and asked to replace its identity, which is exactly what reinstalling a
      // machine produces. Recording the rotation keeps it visible in the node registry.
      input.grant.nodeIdentityRotatedAt = input.nowMs;
      // Retained so the rollback path can put the working key back if route provisioning fails.
      input.grant.nodeReplacedPublicKeyJwk = existingNode!.devicePublicKeyJwk;
      input.grant.nodeReplacedThumbprint =
        existingNode!.devicePublicKeyThumbprint;
    }
    const role =
      existingNode?.role ?? (existingWorkspace?.homeNodeId ? 'member' : 'home');
    const nodeName =
      input.grant.nodeName?.trim() || existingNode?.nodeName || 'local';
    input.grant.nodeId = nodeId;
    input.grant.nodeName = nodeName;
    input.grant.nodeRole = role;
    input.grant.nodeStatus = existingNode ? 'reconnected' : 'created';
    if (existingNode) delete input.grant.nodeRegistrationVersion;
    else input.grant.nodeRegistrationVersion = input.nowMs;
    if (existingNode?.lastSeenAt !== undefined) {
      input.grant.nodeLastSeenAt = existingNode.lastSeenAt;
    } else {
      delete input.grant.nodeLastSeenAt;
    }
    await input.store.putWorkspaceNode({
      accountId: input.accountId,
      workspaceId: workspace.workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      nodeId,
      nodeName,
      displayName: nodeName,
      role,
      platform: input.grant.nodePlatform ?? existingNode?.platform ?? 'unknown',
      architecture:
        input.grant.nodeArchitecture ?? existingNode?.architecture ?? 'unknown',
      channel: input.grant.nodeChannel ?? existingNode?.channel ?? 'stable',
      connectorId: connectorIdFromNodeId(nodeId),
      capabilities:
        input.grant.nodeCapabilities ?? existingNode?.capabilities ?? [],
      connectorStatus:
        existingNode?.connectorStatus ??
        (existingNode?.lastSeenAt === undefined ? 'disconnected' : 'connected'),
      state: existingNode?.state ?? 'active',
      // On an accepted replacement the grant's key is the new identity. Preferring the existing
      // JWK here would store the new thumbprint beside the old key, and heartbeat verification
      // reads the stored JWK — so the rotated node would authenticate against a key it no longer
      // holds and fail every heartbeat.
      devicePublicKeyJwk: identityChanged
        ? input.grant.devicePublicKeyJwk
        : (existingNode?.devicePublicKeyJwk ?? input.grant.devicePublicKeyJwk),
      devicePublicKeyThumbprint: input.grant.devicePublicKeyThumbprint,
      createdAt: existingNode?.createdAt ?? input.nowMs,
      updatedAt: input.nowMs,
      ...(existingNode?.lastSeenAt !== undefined
        ? { lastSeenAt: existingNode.lastSeenAt }
        : {}),
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'workspace node registration failed',
    );
  }
}

export async function prepareGrantApproval(input: {
  store: Store;
  grant: Grant;
  accountId: string;
  authMethod: StrongerAuthMethod;
  nowMs: number;
  connectorToken?: string;
}): Promise<Grant> {
  try {
    grantWorkspace(input.grant);
    await registerGrantNode({
      store: input.store,
      grant: input.grant,
      accountId: input.accountId,
      nowMs: input.nowMs,
    });
    input.grant.accountId = input.accountId;
    input.grant.accountAuthMethod = input.authMethod;
    input.grant.connectorToken = input.connectorToken ?? rand('cbt', 32);
    input.grant.connectorExpiresAt = input.nowMs + BOOTSTRAP_TTL_MS;
    return input.grant;
  } catch (error: unknown) {
    throw new Error(
      `grant approval preparation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Clears the retained previous identity once the approval has committed. */
export function clearRetainedReplacedIdentity(grant: Grant): void {
  delete grant.nodeReplacedPublicKeyJwk;
  delete grant.nodeReplacedThumbprint;
}

export async function commitGrantApproval(input: {
  store: Store;
  grant: Grant;
  accountId: string;
  nowMs: number;
}): Promise<Grant> {
  try {
    const workspace = grantWorkspace(input.grant);
    const connectorToken = input.grant.connectorToken;
    const connectorExpiresAt = input.grant.connectorExpiresAt;
    const nodeId = input.grant.nodeId;
    if (!connectorToken || !connectorExpiresAt || !nodeId) {
      throw new Error('approved grant is missing node bootstrap material');
    }
    input.grant.status = 'approved';
    await input.store.put(input.grant);
    await rememberAccountWorkspace({
      store: input.store,
      grant: input.grant,
      accountId: input.accountId,
      nowMs: input.nowMs,
    });
    await input.store.putNodeBootstrapCredential({
      tokenHash: await hashHex(connectorToken),
      accountId: input.accountId,
      workspaceId: workspace.workspaceId,
      workspaceHost: workspace.workspaceHost,
      nodeId,
      expiresAt: connectorExpiresAt,
    });
    return input.grant;
  } catch (error: unknown) {
    throw new Error(
      `grant approval commit failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function failGrantWorkspaceRouteSetup(input: {
  store: Store;
  grant: Grant;
  error: unknown;
}): Promise<string> {
  const failureMessage = redactWorkspaceRouteSetupFailure(input.error);
  input.grant.status = 'failed';
  input.grant.failureCode = WORKSPACE_ROUTE_SETUP_FAILURE_CODE;
  input.grant.failureMessage = failureMessage;
  delete input.grant.connectorToken;
  delete input.grant.connectorExpiresAt;
  delete input.grant.cloudflareTunnelToken;
  delete input.grant.accessToken;
  try {
    await input.store.put(input.grant);
  } catch (error: unknown) {
    throw new Error(
      `grant failure persistence failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // A replaced identity must be put back before anything else. The installer that triggered this
  // gets no bootstrap material either way, but the existing installation keeps working with the
  // key it still holds instead of being locked out by a half-applied rotation.
  if (
    input.grant.nodeReplacedPublicKeyJwk &&
    input.grant.nodeReplacedThumbprint &&
    input.grant.accountId &&
    input.grant.nodeId
  ) {
    try {
      const current = await input.store.byWorkspaceNode(
        input.grant.accountId,
        input.grant.nodeId,
      );
      if (current) {
        await input.store.putWorkspaceNode({
          ...current,
          devicePublicKeyJwk: input.grant.nodeReplacedPublicKeyJwk,
          devicePublicKeyThumbprint: input.grant.nodeReplacedThumbprint,
        });
      }
    } catch {
      // The durable failed grant is authoritative even when rollback cleanup fails.
    }
  }
  if (
    input.grant.nodeStatus === 'created' &&
    input.grant.accountId &&
    input.grant.nodeId &&
    input.grant.nodeRegistrationVersion !== undefined
  ) {
    try {
      await input.store.delWorkspaceNodeIfMatch({
        accountId: input.grant.accountId,
        nodeId: input.grant.nodeId,
        updatedAt: input.grant.nodeRegistrationVersion,
        devicePublicKeyThumbprint: input.grant.devicePublicKeyThumbprint,
      });
    } catch {
      // The durable failed grant is authoritative even when rollback cleanup fails.
    }
  }
  return failureMessage;
}

export function approvedJson(g: Grant): Record<string, unknown> {
  const workspace = grantWorkspace(g);
  const nodeId = g.nodeId ?? workspace.workspaceSlug;
  return {
    [TOKEN_KEY]: rand('osat', 32),
    token_type: 'bearer',
    workspace_id: workspace.workspaceId,
    workspace_slug: workspace.workspaceSlug,
    workspace_host: workspace.workspaceHost,
    node_id: nodeId,
    node_name: g.nodeName ?? 'local',
    node_role: g.nodeRole ?? 'home',
    node_status: g.nodeStatus ?? 'created',
    connector_id: connectorIdFromNodeId(nodeId),
    [CONNECTOR_TOKEN_KEY]: g.connectorToken ?? rand('cbt', 32),
    ...(g.cloudflareTunnelToken
      ? { [CLOUDFLARE_TUNNEL_TOKEN_KEY]: g.cloudflareTunnelToken }
      : {}),
    connector_bootstrap_expires_at: new Date(
      g.connectorExpiresAt ?? Date.now(),
    ).toISOString(),
    device_public_key_thumbprint: g.devicePublicKeyThumbprint,
    device_public_key_bound: true,
  };
}
