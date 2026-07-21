import type { Hono } from 'hono';

import { json } from '../http';
import type {
  DeviceAuthorityRuntime,
  NodeBootstrapCredential,
  WorkspaceAgentName,
  WorkspaceAgentStatus,
} from '../types';
import { hashHex } from '../utils';

const AGENT_LABELS = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
  factory: 'Factory',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  pi: 'Pi',
} as const satisfies Record<WorkspaceAgentName, string>;

const AGENT_NAMES = new Set<WorkspaceAgentName>(
  Object.keys(AGENT_LABELS) as WorkspaceAgentName[],
);

const publicHeaders = {
  'access-control-allow-origin': '*',
  'cache-control': 'no-store',
} as const;

function errorResponse(
  code: string,
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return json({ error: { code, message } }, { status, headers });
}

function normalizeWorkspaceHost(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      normalized,
    ) ||
    !normalized.endsWith('.consuelohq.com')
  ) {
    return undefined;
  }
  return normalized;
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{16,512})$/);
  return match?.[1];
}

function normalizeAgentNames(value: unknown): WorkspaceAgentName[] | undefined {
  if (!Array.isArray(value) || value.length > AGENT_NAMES.size) return undefined;
  const names: WorkspaceAgentName[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !AGENT_NAMES.has(candidate as WorkspaceAgentName)) {
      return undefined;
    }
    names.push(candidate as WorkspaceAgentName);
  }
  return [...new Set(names)].sort();
}

function publicWorkspaceAgentStatus(
  workspaceHost: string,
  status: WorkspaceAgentStatus | undefined,
): Record<string, unknown> {
  const agentNames = status
    ? [...new Set(Object.values(status.nodes).flatMap((node) => node.agents))].sort()
    : [];
  return {
    ok: true,
    workspaceHost,
    connectedAgentCount: agentNames.length,
    agents: agentNames.map((name) => ({ name, label: AGENT_LABELS[name] })),
    updatedAt: status ? new Date(status.updatedAt).toISOString() : null,
  };
}

async function authenticateNode(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<NodeBootstrapCredential | undefined> {
  const token = bearerToken(request);
  if (!token) return undefined;
  const tokenHash = await hashHex(token);
  const credential = await runtime.store.byNodeBootstrapCredential(tokenHash);
  if (!credential) return undefined;
  if (runtime.now() >= credential.expiresAt) {
    await runtime.store.delNodeBootstrapCredential(tokenHash);
    return undefined;
  }
  return credential;
}

async function readAgentNames(request: Request): Promise<WorkspaceAgentName[] | undefined> {
  try {
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return undefined;
    }
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const record = body as Record<string, unknown>;
    if (Object.keys(record).length !== 1 || !Object.hasOwn(record, 'agents')) return undefined;
    return normalizeAgentNames(record.agents);
  } catch {
    return undefined;
  }
}

async function handleWorkspaceAgentWrite(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const credential = await authenticateNode(request, runtime);
    if (!credential) {
      return errorResponse(
        'INVALID_NODE_BOOTSTRAP_CREDENTIAL',
        'The node bootstrap credential is invalid or expired.',
        401,
      );
    }
    const agents = await readAgentNames(request);
    if (!agents) {
      return errorResponse(
        'INVALID_AGENT_STATUS',
        'Agent status must contain only known agent identifiers.',
        400,
      );
    }

    const existing = await runtime.store.byWorkspaceAgentStatus(
      credential.workspaceHost,
    );
    if (
      existing &&
      (existing.workspaceId !== credential.workspaceId ||
        existing.workspaceHost !== credential.workspaceHost)
    ) {
      return errorResponse(
        'WORKSPACE_AGENT_STATUS_CONFLICT',
        'The node credential does not match the stored workspace status.',
        409,
      );
    }

    const updatedAt = runtime.now();
    const status: WorkspaceAgentStatus = {
      workspaceId: credential.workspaceId,
      workspaceHost: credential.workspaceHost,
      nodes: {
        ...(existing?.nodes ?? {}),
        [credential.nodeId]: {
          workspaceId: credential.workspaceId,
          workspaceHost: credential.workspaceHost,
          nodeId: credential.nodeId,
          agents,
          updatedAt,
        },
      },
      updatedAt,
    };
    await runtime.store.putWorkspaceAgentStatus(status);
    return json(publicWorkspaceAgentStatus(credential.workspaceHost, status));
  } catch {
    return errorResponse(
      'WORKSPACE_AGENT_STATUS_WRITE_FAILED',
      'Workspace agent status could not be updated.',
      500,
    );
  }
}

async function handleWorkspaceAgentRead(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const workspaceHost = normalizeWorkspaceHost(
      new URL(request.url).searchParams.get('workspace_host') ?? '',
    );
    if (!workspaceHost) {
      return errorResponse(
        'INVALID_WORKSPACE_HOST',
        'A valid Consuelo workspace host is required.',
        400,
        publicHeaders,
      );
    }
    const status = await runtime.store.byWorkspaceAgentStatus(workspaceHost);
    return json(publicWorkspaceAgentStatus(workspaceHost, status), {
      headers: publicHeaders,
    });
  } catch {
    return errorResponse(
      'WORKSPACE_AGENT_STATUS_READ_FAILED',
      'Workspace agent status could not be read.',
      500,
      publicHeaders,
    );
  }
}

export function registerWorkspaceAgentRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.get('/workspace/agents', (context) =>
    handleWorkspaceAgentRead(context.req.raw, runtime),
  );
  app.post('/workspace/agents', (context) =>
    handleWorkspaceAgentWrite(context.req.raw, runtime),
  );
}
