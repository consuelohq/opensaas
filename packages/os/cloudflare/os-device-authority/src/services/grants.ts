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
  host,
  optionalNodeId,
  rand,
  slug,
} from '../utils';

export function grantWorkspace(grant: Grant): {
  workspaceSlug: string;
  workspaceHost: string;
} {
  if (!grant.workspaceSlug || !grant.workspaceHost) {
    throw new Error('workspace is required before bootstrap can be issued');
  }
  return {
    workspaceSlug: grant.workspaceSlug,
    workspaceHost: grant.workspaceHost,
  };
}

export function assignGrantWorkspace(input: {
  grant: Grant;
  workspaceSlug: string;
  workspaceHost: string;
}): void {
  input.grant.workspaceSlug = slug(input.workspaceSlug);
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
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      homeNodeId: existing?.homeNodeId ?? input.grant.nodeId,
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
    const role =
      existingNode?.role ?? (existingWorkspace?.homeNodeId ? 'member' : 'home');
    const nodeName =
      input.grant.nodeName?.trim() || existingNode?.nodeName || 'local';
    input.grant.nodeId = nodeId;
    input.grant.nodeName = nodeName;
    input.grant.nodeRole = role;
    input.grant.nodeStatus = existingNode ? 'reconnected' : 'created';
    await input.store.putWorkspaceNode({
      accountId: input.accountId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      nodeId,
      nodeName,
      role,
      devicePublicKeyThumbprint: input.grant.devicePublicKeyThumbprint,
      createdAt: existingNode?.createdAt ?? input.nowMs,
      updatedAt: input.nowMs,
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
    input.grant.connectorToken = rand('cbt', 32);
    input.grant.connectorExpiresAt = input.nowMs + BOOTSTRAP_TTL_MS;
    return input.grant;
  } catch (error: unknown) {
    throw new Error(
      `grant approval preparation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function commitGrantApproval(input: {
  store: Store;
  grant: Grant;
  accountId: string;
  nowMs: number;
}): Promise<Grant> {
  try {
    input.grant.status = 'approved';
    await input.store.put(input.grant);
    await rememberAccountWorkspace({
      store: input.store,
      grant: input.grant,
      accountId: input.accountId,
      nowMs: input.nowMs,
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
  return failureMessage;
}

export function approvedJson(g: Grant): Record<string, unknown> {
  const workspace = grantWorkspace(g);
  const nodeId = g.nodeId ?? workspace.workspaceSlug;
  return {
    [TOKEN_KEY]: rand('osat', 32),
    token_type: 'bearer',
    workspace_id: `workspace_${workspace.workspaceSlug.replace(/-/g, '_')}`,
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
