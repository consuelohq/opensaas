import type { AccountWorkspace, WorkspaceAgentName, WorkspaceNode, WorkspaceNodeRole } from '../types';
import { workspaceIdFromSlug } from '../utils';
import { MODERN_MCP_PROTOCOL_VERSION } from '../../../../scripts/lib/mcp-protocol';

export const WORKSPACE_NODE_HEARTBEAT_TTL_MS = 60_000;
export const WORKSPACE_NODE_HEARTBEAT_STALE_MULTIPLIER = 3;
export const WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS = 5 * 60_000;

export type WorkspaceNodePresence = 'online' | 'stale' | 'offline';
export type WorkspaceNodeReadiness = 'ready' | 'not_ready' | 'unknown';
export type WorkspaceNodeCompatibility = 'compatible' | 'incompatible' | 'unknown';

export type SafeWorkspaceNode = {
  workspaceId: string;
  nodeId: string;
  displayName: string;
  role: WorkspaceNodeRole;
  platform: string;
  architecture: string;
  channel: string;
  osVersion: string | null;
  mcpProtocolVersion: string | null;
  readiness: WorkspaceNodeReadiness;
  compatibility: WorkspaceNodeCompatibility;
  connectorId: string | null;
  capabilities: string[];
  agents: WorkspaceAgentName[] | null;
  createdAt: string;
  lastSeenAt: string | null;
  presence: WorkspaceNodePresence;
  state: 'active' | 'revoked';
  publicKeyThumbprint: string;
};

export type WorkspaceNodeListPayload = {
  workspaceId: string;
  workspaceHost: string;
  currentNodeId: string | null;
  currentNode: SafeWorkspaceNode | null;
  defaultNodeId: string | null;
  nodeCount: number;
  presence: Record<WorkspaceNodePresence, number>;
  nodes: SafeWorkspaceNode[];
};

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
  if (node.connectorStatus === 'disconnected') return 'offline';
  const lastSeenAt = node.lastSeenAt;
  if (lastSeenAt === undefined) return 'offline';
  const ageMs = Math.max(0, nowMs - lastSeenAt);
  if (ageMs <= ttlMs) {
    return 'online';
  }
  if (ageMs <= ttlMs * WORKSPACE_NODE_HEARTBEAT_STALE_MULTIPLIER) {
    return 'stale';
  }
  return 'offline';
}

export function workspaceNodeCompatibility(
  node: WorkspaceNode,
): WorkspaceNodeCompatibility {
  const protocol = node.mcpProtocolVersion?.trim();
  if (!protocol) return 'unknown';
  return protocol === MODERN_MCP_PROTOCOL_VERSION ? 'compatible' : 'incompatible';
}

export function workspaceNodeReadiness(
  node: WorkspaceNode,
  nowMs: number,
): WorkspaceNodeReadiness {
  const presence = workspaceNodePresence(node, nowMs);
  if (presence !== 'online' || (node.state ?? 'active') !== 'active') return 'not_ready';
  if (node.mcpReady === false || workspaceNodeCompatibility(node) === 'incompatible') {
    return 'not_ready';
  }
  if (node.mcpReady === true && workspaceNodeCompatibility(node) === 'compatible') {
    return 'ready';
  }
  return 'unknown';
}

export function safeWorkspaceNode(
  node: WorkspaceNode,
  nowMs: number,
): SafeWorkspaceNode {
  return {
    workspaceId: workspaceNodeId(node),
    nodeId: node.nodeId,
    displayName: node.displayName ?? node.nodeName,
    role: node.role,
    platform: node.platform ?? 'unknown',
    architecture: node.architecture ?? 'unknown',
    channel: node.channel ?? 'stable',
    osVersion: node.osVersion?.trim() || null,
    mcpProtocolVersion: node.mcpProtocolVersion?.trim() || null,
    readiness: workspaceNodeReadiness(node, nowMs),
    compatibility: workspaceNodeCompatibility(node),
    connectorId: node.connectorId ?? null,
    capabilities: [...(node.capabilities ?? [])].sort(),
    agents: node.agents === undefined ? null : [...node.agents],
    createdAt: new Date(node.createdAt).toISOString(),
    lastSeenAt:
      node.lastSeenAt === undefined
        ? null
        : new Date(node.lastSeenAt).toISOString(),
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
}): WorkspaceNodeListPayload {
  const defaultNodeId = workspaceDefaultNodeId(input.workspace) ?? null;
  const nodes = input.nodes
    .filter((node) => node.workspaceHost === input.workspace.workspaceHost)
    .map((node) => safeWorkspaceNode(node, input.nowMs))
    .sort((left, right) => {
      const defaultRank = Number(right.nodeId === defaultNodeId) - Number(left.nodeId === defaultNodeId);
      if (defaultRank !== 0) return defaultRank;
      const onlineRank = Number(right.presence === 'online') - Number(left.presence === 'online');
      if (onlineRank !== 0) return onlineRank;
      const leftActivity = left.lastSeenAt ? Date.parse(left.lastSeenAt) : Number.NEGATIVE_INFINITY;
      const rightActivity = right.lastSeenAt ? Date.parse(right.lastSeenAt) : Number.NEGATIVE_INFINITY;
      if (leftActivity !== rightActivity) return rightActivity - leftActivity;
      const createdRank = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      return createdRank !== 0 ? createdRank : left.nodeId.localeCompare(right.nodeId);
    });
  const presence = { online: 0, stale: 0, offline: 0 };
  for (const node of nodes) {
    const state = node.presence as WorkspaceNodePresence;
    presence[state] += 1;
  }
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
