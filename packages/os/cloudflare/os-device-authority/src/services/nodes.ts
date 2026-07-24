import type { AccountWorkspace, WorkspaceNode } from '../types';
import { workspaceIdFromSlug } from '../utils';

export const WORKSPACE_NODE_HEARTBEAT_TTL_MS = 60_000;
export const WORKSPACE_NODE_HEARTBEAT_STALE_MULTIPLIER = 3;
export const WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS = 5 * 60_000;

export type WorkspaceNodePresence = 'online' | 'stale' | 'offline';

export function workspaceNodeId(node: WorkspaceNode): string {
  return node.workspaceId ?? workspaceIdFromSlug(node.workspaceSlug);
}

export function workspaceDefaultNodeId(
  workspace: AccountWorkspace,
): string | undefined {
  return workspace.defaultNodeId ?? workspace.homeNodeId;
}

export function workspaceNodePresence(
  node: WorkspaceNode,
  nowMs: number,
  ttlMs = WORKSPACE_NODE_HEARTBEAT_TTL_MS,
): WorkspaceNodePresence {
  if ((node.state ?? 'active') === 'revoked') return 'offline';
  const lastSeenAt = node.lastSeenAt ?? node.updatedAt;
  const ageMs = Math.max(0, nowMs - lastSeenAt);
  if (ageMs <= ttlMs && (node.connectorStatus ?? 'connected') === 'connected') {
    return 'online';
  }
  if (ageMs <= ttlMs * WORKSPACE_NODE_HEARTBEAT_STALE_MULTIPLIER) {
    return 'stale';
  }
  return 'offline';
}

export function safeWorkspaceNode(
  node: WorkspaceNode,
  nowMs: number,
): Record<string, unknown> {
  return {
    workspaceId: workspaceNodeId(node),
    nodeId: node.nodeId,
    displayName: node.displayName ?? node.nodeName,
    role: node.role,
    platform: node.platform ?? 'unknown',
    architecture: node.architecture ?? 'unknown',
    channel: node.channel ?? 'stable',
    connectorId: node.connectorId ?? null,
    capabilities: [...(node.capabilities ?? [])].sort(),
    createdAt: new Date(node.createdAt).toISOString(),
    lastSeenAt: new Date(node.lastSeenAt ?? node.updatedAt).toISOString(),
    presence: workspaceNodePresence(node, nowMs),
    state: node.state ?? 'active',
    publicKeyThumbprint: node.devicePublicKeyThumbprint,
  };
}

export function workspaceNodeListPayload(input: {
  workspace: AccountWorkspace;
  nodes: WorkspaceNode[];
  nowMs: number;
  currentNodeId?: string;
}): Record<string, unknown> {
  const nodes = input.nodes
    .filter((node) => node.workspaceHost === input.workspace.workspaceHost)
    .sort((left, right) => left.createdAt - right.createdAt)
    .map((node) => safeWorkspaceNode(node, input.nowMs));
  const presence = { online: 0, stale: 0, offline: 0 };
  for (const node of nodes) {
    const state = node.presence as WorkspaceNodePresence;
    presence[state] += 1;
  }
  const defaultNodeId = workspaceDefaultNodeId(input.workspace) ?? null;
  const currentNode = input.currentNodeId
    ? nodes.find((node) => node.nodeId === input.currentNodeId) ?? null
    : null;
  return {
    workspaceId:
      input.workspace.workspaceId ??
      workspaceIdFromSlug(input.workspace.workspaceSlug),
    workspaceHost: input.workspace.workspaceHost,
    currentNodeId: input.currentNodeId ?? null,
    currentNode,
    defaultNodeId,
    nodeCount: nodes.length,
    presence,
    nodes,
  };
}
