type JsonObject = Record<string, unknown>;

export const MCP_NODE_CONTEXT_HEADER = 'x-consuelo-node-context';
export const MCP_ROUTE_SOURCE_HEADER = 'x-consuelo-route-source';

export type McpNodeRouteSource = 'default' | 'explicit' | 'task';

export type McpNodeSummary = {
  nodeId: string;
  displayName: string;
  role?: 'home' | 'member';
  platform?: string;
  presence?: 'online' | 'stale' | 'offline';
  state?: string;
};

export type McpNodeRoutingContext = {
  version: 1;
  workspaceId: string;
  currentNodeId: string;
  defaultNodeId?: string;
  routeSource: McpNodeRouteSource;
  nodes: McpNodeSummary[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeBoundedIdentifier(
  value: unknown,
  maximumLength: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const identifier = value.trim();
  return identifier.length > 0 && identifier.length <= maximumLength
    ? identifier
    : null;
}

export function normalizeMcpNodeId(value: unknown): string | undefined | null {
  return normalizeBoundedIdentifier(value, 160);
}

export function normalizeMcpTaskSession(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const taskSession = value.trim();
  return taskSession.length > 0 && taskSession.length <= 240 ? taskSession : null;
}

export type McpNodeRoutingInspection =
  | {
      ok: true;
      nodeId?: string;
      taskSession?: string;
      facadeTool?: string;
      getSteering: boolean;
    }
  | { ok: false; code: 'INVALID_NODE_ROUTE'; message: string };

export function inspectMcpNodeRoutingBody(body: string): McpNodeRoutingInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return { ok: true, getSteering: false };
  }
  if (!isJsonObject(parsed) || parsed.method !== 'tools/call') {
    return { ok: true, getSteering: false };
  }
  const params = parsed.params;
  if (!isJsonObject(params)) return { ok: true, getSteering: false };
  if (params.name === 'get_steering') return { ok: true, getSteering: true };
  if (params.name !== 'call') return { ok: true, getSteering: false };
  const args = params.arguments;
  if (!isJsonObject(args)) return { ok: true, getSteering: false };
  const nodeId = normalizeMcpNodeId(args.nodeId);
  if (nodeId === null) {
    return {
      ok: false,
      code: 'INVALID_NODE_ROUTE',
      message: 'call nodeId must be a non-empty node identifier.',
    };
  }
  const taskSession = normalizeMcpTaskSession(args.taskSession);
  if (taskSession === null) {
    return {
      ok: false,
      code: 'INVALID_NODE_ROUTE',
      message: 'call taskSession must be a non-empty task session identifier.',
    };
  }
  const facadeTool = typeof args.tool === 'string' && args.tool.trim()
    ? args.tool.trim()
    : undefined;
  return {
    ok: true,
    getSteering: false,
    ...(nodeId ? { nodeId } : {}),
    ...(taskSession ? { taskSession } : {}),
    ...(facadeTool ? { facadeTool } : {}),
  };
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeMcpNodeRoutingContext(context: McpNodeRoutingContext): string {
  return encodeBase64Url(JSON.stringify(context));
}

export function decodeMcpNodeRoutingContext(value: string | null): McpNodeRoutingContext | null {
  if (!value || value.length > 16_000) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as unknown;
    if (!isJsonObject(parsed) || parsed.version !== 1) return null;
    const workspaceId = normalizeBoundedIdentifier(parsed.workspaceId, 160);
    const currentNodeId = normalizeMcpNodeId(parsed.currentNodeId);
    const defaultNodeId = normalizeMcpNodeId(parsed.defaultNodeId);
    if (!workspaceId || !currentNodeId || defaultNodeId === null) return null;
    if (
      parsed.routeSource !== 'default' &&
      parsed.routeSource !== 'explicit' &&
      parsed.routeSource !== 'task'
    ) return null;
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length > 32) return null;
    const nodes: McpNodeSummary[] = [];
    for (const raw of parsed.nodes) {
      if (!isJsonObject(raw)) return null;
      const nodeId = normalizeMcpNodeId(raw.nodeId);
      if (!nodeId || typeof raw.displayName !== 'string' || !raw.displayName.trim()) return null;
      nodes.push({
        nodeId,
        displayName: raw.displayName.trim().slice(0, 120),
        ...(raw.role === 'home' || raw.role === 'member' ? { role: raw.role } : {}),
        ...(typeof raw.platform === 'string' ? { platform: raw.platform.slice(0, 40) } : {}),
        ...(raw.presence === 'online' || raw.presence === 'stale' || raw.presence === 'offline'
          ? { presence: raw.presence }
          : {}),
        ...(typeof raw.state === 'string' ? { state: raw.state.slice(0, 40) } : {}),
      });
    }
    return {
      version: 1,
      workspaceId,
      currentNodeId,
      ...(defaultNodeId ? { defaultNodeId } : {}),
      routeSource: parsed.routeSource,
      nodes,
    };
  } catch {
    return null;
  }
}
