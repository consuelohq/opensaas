export type WorkspaceNodeCommand =
  | { action: 'list'; currentNodeId?: string }
  | { action: 'default'; nodeId: string }
  | { action: 'rename'; nodeId: string; displayName: string }
  | { action: 'revoke'; nodeId: string };

export const WORKSPACE_NODES_USAGE = [
  'usage: workspace:nodes list [--current-node <node-id>]',
  '       workspace:nodes default <node-id>',
  '       workspace:nodes rename <node-id> <display-name>',
  '       workspace:nodes revoke <node-id>',
  '',
  'credentials:',
  '  CONSUELO_OS_WORKSPACE_TOKEN    OAuth workspace bearer token',
  '  CONSUELO_OS_AUTHORITY_ORIGIN   authority origin (default: https://os.consuelohq.com)',
].join('\n');

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`${label} is required\n\n${WORKSPACE_NODES_USAGE}`);
  return normalized;
}

export function parseWorkspaceNodeCommand(args: string[]): WorkspaceNodeCommand {
  const [action, ...rest] = args;
  if (action === 'list') {
    if (rest.length === 0) return { action: 'list' };
    if (rest.length === 2 && rest[0] === '--current-node') {
      return { action: 'list', currentNodeId: required(rest[1], 'current node ID') };
    }
    throw new Error(WORKSPACE_NODES_USAGE);
  }
  if (action === 'default') {
    if (rest.length !== 1) throw new Error(WORKSPACE_NODES_USAGE);
    return { action: 'default', nodeId: required(rest[0], 'node ID') };
  }
  if (action === 'rename') {
    if (rest.length < 2) throw new Error(WORKSPACE_NODES_USAGE);
    return {
      action: 'rename',
      nodeId: required(rest[0], 'node ID'),
      displayName: required(rest.slice(1).join(' '), 'display name'),
    };
  }
  if (action === 'revoke') {
    if (rest.length !== 1) throw new Error(WORKSPACE_NODES_USAGE);
    return { action: 'revoke', nodeId: required(rest[0], 'node ID') };
  }
  throw new Error(WORKSPACE_NODES_USAGE);
}

export type WorkspaceNodeClient = {
  execute: (command: WorkspaceNodeCommand) => Promise<Record<string, unknown>>;
};

const MAX_OUTPUT_NODES = 50;
const MAX_OUTPUT_CAPABILITIES = 8;
const MAX_OUTPUT_AGENTS = 7;
const MAX_OUTPUT_STRING_LENGTH = 80;

function boundedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, MAX_OUTPUT_STRING_LENGTH);
}

function boundedStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, limit)
    .map((item) => item.slice(0, MAX_OUTPUT_STRING_LENGTH));
}

function boundedCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function safeNodeOutput(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const node = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const field of [
    'workspaceId',
    'nodeId',
    'displayName',
    'role',
    'platform',
    'architecture',
    'channel',
    'connectorId',
    'createdAt',
    'lastSeenAt',
    'presence',
    'state',
    'publicKeyThumbprint',
  ]) {
    const normalized = boundedString(node[field]);
    if (normalized !== undefined) output[field] = normalized;
    else if (node[field] === null && (field === 'connectorId' || field === 'lastSeenAt')) {
      output[field] = null;
    }
  }
  output.capabilities = boundedStringArray(
    node.capabilities,
    MAX_OUTPUT_CAPABILITIES,
  );
  output.agents = boundedStringArray(node.agents, MAX_OUTPUT_AGENTS);
  return output;
}

function safePresence(value: unknown): Record<string, number> {
  const presence = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    online: boundedCount(presence.online),
    stale: boundedCount(presence.stale),
    offline: boundedCount(presence.offline),
  };
}

export function formatWorkspaceNodeCommandResult(
  command: WorkspaceNodeCommand,
  result: Record<string, unknown>,
): string {
  if (command.action === 'list') {
    const sourceNodes = Array.isArray(result.nodes) ? result.nodes : [];
    const nodes = sourceNodes
      .slice(0, MAX_OUTPUT_NODES)
      .map(safeNodeOutput)
      .filter((node): node is Record<string, unknown> => Boolean(node));
    const nodeCount = boundedCount(result.nodeCount);
    return JSON.stringify({
      workspaceId: boundedString(result.workspaceId) ?? null,
      workspaceHost: boundedString(result.workspaceHost) ?? null,
      currentNodeId: boundedString(result.currentNodeId) ?? null,
      defaultNodeId: boundedString(result.defaultNodeId) ?? null,
      nodeCount,
      presence: safePresence(result.presence),
      nodes,
      truncated: sourceNodes.length > MAX_OUTPUT_NODES || nodeCount > nodes.length,
    });
  }
  if (command.action === 'default') {
    return JSON.stringify({
      defaultNodeId:
        boundedString(result.defaultNodeId) ?? command.nodeId.slice(0, MAX_OUTPUT_STRING_LENGTH),
    });
  }
  return JSON.stringify({
    node:
      safeNodeOutput(result.node) ??
      {
        nodeId: command.nodeId.slice(0, MAX_OUTPUT_STRING_LENGTH),
        capabilities: [],
        agents: [],
      },
  });
}

function normalizeOrigin(value: string): string {
  const origin = new URL(value);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('workspace node authority origin must use HTTPS');
  }
  return origin.origin;
}

function commandRequest(
  origin: string,
  command: WorkspaceNodeCommand,
): { url: URL; init: RequestInit } {
  const headers = new Headers({ accept: 'application/json' });
  if (command.action === 'list') {
    const url = new URL('/workspace/nodes', origin);
    if (command.currentNodeId) {
      url.searchParams.set('current_node_id', command.currentNodeId);
    }
    return { url, init: { method: 'GET', headers } };
  }
  if (command.action === 'default') {
    headers.set('content-type', 'application/json');
    return {
      url: new URL('/workspace/nodes/default', origin),
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ nodeId: command.nodeId }),
      },
    };
  }
  if (command.action === 'rename') {
    headers.set('content-type', 'application/json');
    return {
      url: new URL(`/workspace/nodes/${encodeURIComponent(command.nodeId)}`, origin),
      init: {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ displayName: command.displayName }),
      },
    };
  }
  return {
    url: new URL(
      `/workspace/nodes/${encodeURIComponent(command.nodeId)}/revoke`,
      origin,
    ),
    init: { method: 'POST', headers },
  };
}

function safeServerError(status: number, payload: unknown): Error {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === 'object') {
      const code = (error as { code?: unknown }).code;
      const message = (error as { message?: unknown }).message;
      if (typeof code === 'string' && typeof message === 'string') {
        return new Error(`${code}: ${message}`);
      }
    }
  }
  return new Error(`workspace node request failed with HTTP ${status}`);
}

export function createWorkspaceNodeClient(input: {
  origin: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): WorkspaceNodeClient {
  const origin = normalizeOrigin(input.origin);
  const accessToken = required(input.accessToken, 'workspace access token');
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  return {
    async execute(command) {
      const spec = commandRequest(origin, command);
      const headers = new Headers(spec.init.headers);
      headers.set('authorization', `Bearer ${accessToken}`);
      const response = await fetchImpl(
        new Request(spec.url, { ...spec.init, headers }),
      );
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }
      if (!response.ok) throw safeServerError(response.status, payload);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('workspace node authority returned an invalid JSON response');
      }
      return payload as Record<string, unknown>;
    },
  };
}
