import type {
  WorkspaceAgentName,
  WorkspaceAgentStatus,
  WorkspaceNode,
} from '../types';
import {
  workspaceNodePresence,
  type WorkspaceNodePresence,
} from './nodes';

export const WORKSPACE_AGENT_LABELS = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
  factory: 'Factory',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  pi: 'Pi',
} as const satisfies Record<WorkspaceAgentName, string>;

const WORKSPACE_AGENT_NAMES = new Set<WorkspaceAgentName>(
  Object.keys(WORKSPACE_AGENT_LABELS) as WorkspaceAgentName[],
);

export type WorkspaceAgentPresenceState =
  | 'online'
  | 'stale'
  | 'offline'
  | 'never_reported';

export function normalizeWorkspaceAgentNames(
  value: unknown,
): WorkspaceAgentName[] | undefined {
  if (!Array.isArray(value) || value.length > WORKSPACE_AGENT_NAMES.size) {
    return undefined;
  }
  const names: WorkspaceAgentName[] = [];
  for (const candidate of value) {
    if (
      typeof candidate !== 'string' ||
      !WORKSPACE_AGENT_NAMES.has(candidate as WorkspaceAgentName)
    ) {
      return undefined;
    }
    names.push(candidate as WorkspaceAgentName);
  }
  return [...new Set(names)].sort();
}

type AgentReport = {
  agents: WorkspaceAgentName[];
  presence: WorkspaceNodePresence;
  updatedAt: number;
};

function reportForNode(input: {
  node: WorkspaceNode;
  legacyStatus?: WorkspaceAgentStatus;
  nowMs: number;
}): AgentReport | undefined {
  const legacy = input.legacyStatus?.nodes[input.node.nodeId];
  const agents = input.node.agents ?? legacy?.agents;
  if (agents === undefined) return undefined;
  return {
    agents: [...agents],
    presence: workspaceNodePresence(input.node, input.nowMs),
    updatedAt:
      input.node.agents !== undefined
        ? input.node.lastSeenAt ?? input.node.updatedAt
        : legacy?.updatedAt ?? input.node.updatedAt,
  };
}

export function publicWorkspaceAgentStatus(input: {
  workspaceHost: string;
  nodes: WorkspaceNode[];
  legacyStatus?: WorkspaceAgentStatus;
  nowMs: number;
}): Record<string, unknown> {
  const reports: AgentReport[] = input.nodes
    .filter((node) => node.workspaceHost === input.workspaceHost)
    .map((node) => reportForNode({
      node,
      legacyStatus: input.legacyStatus,
      nowMs: input.nowMs,
    }))
    .filter((report): report is AgentReport => Boolean(report));

  const knownNodeIds = new Set(input.nodes.map((node) => node.nodeId));
  for (const [nodeId, legacy] of Object.entries(input.legacyStatus?.nodes ?? {})) {
    if (knownNodeIds.has(nodeId)) continue;
    reports.push({
      agents: [...legacy.agents],
      presence: 'offline',
      updatedAt: legacy.updatedAt,
    });
  }

  const state: WorkspaceAgentPresenceState = reports.some(
    (report) => report.presence === 'online',
  )
    ? 'online'
    : reports.some((report) => report.presence === 'stale')
      ? 'stale'
      : reports.length > 0
        ? 'offline'
        : 'never_reported';
  const selected =
    state === 'never_reported'
      ? []
      : reports.filter((report) => report.presence === state);
  const agentNames = [
    ...new Set(selected.flatMap((report) => report.agents)),
  ].sort();
  const updatedAt = selected.length > 0
    ? Math.max(...selected.map((report) => report.updatedAt))
    : undefined;

  return {
    ok: true,
    workspaceHost: input.workspaceHost,
    state,
    connectedAgentCount: agentNames.length,
    agents: agentNames.map((name) => ({
      name,
      label: WORKSPACE_AGENT_LABELS[name],
    })),
    updatedAt: updatedAt === undefined ? null : new Date(updatedAt).toISOString(),
  };
}
