import { createHash, randomUUID } from 'node:crypto';

const MCP_SESSION_ID_PATTERN = /^[A-Za-z0-9._~-]{8,128}$/;
const MCP_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type StoredMcpSession = {
  principalKey: string;
  expiresAt: number;
};

const sessions = new Map<string, StoredMcpSession>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestMethod(body: string): string | null {
  try {
    const value = JSON.parse(body) as { method?: unknown };
    return typeof value.method === 'string' ? value.method : null;
  } catch {
    return null;
  }
}

function authenticatedPrincipalKey(request: Request): string {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const tokenId = request.headers.get('x-consuelo-token-id')?.trim() ?? '';
  const workspaceId = request.headers.get('x-consuelo-workspace-id')?.trim() ?? '';
  return sha256(`principal\n${tokenId || authorization || 'authenticated'}\n${workspaceId}`);
}

function pruneExpiredSessions(now: number): void {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(sessionId);
  }
}

export type McpRequestSession = {
  callerKey: string;
  responseSessionId?: string;
};

export function resolveMcpRequestSession(
  request: Request,
  body: string,
  now = Date.now(),
): McpRequestSession {
  pruneExpiredSessions(now);
  const principalKey = authenticatedPrincipalKey(request);
  const suppliedSessionId = request.headers.get('mcp-session-id')?.trim() ?? '';

  if (requestMethod(body) === 'initialize') {
    const sessionId = randomUUID();
    sessions.set(sessionId, {
      principalKey,
      expiresAt: now + MCP_SESSION_TTL_MS,
    });
    return {
      callerKey: sha256(`mcp-session\n${principalKey}\n${sessionId}`),
      responseSessionId: sessionId,
    };
  }

  const storedSession = MCP_SESSION_ID_PATTERN.test(suppliedSessionId)
    ? sessions.get(suppliedSessionId)
    : undefined;
  const trustedSessionId = storedSession?.principalKey === principalKey
    ? suppliedSessionId
    : 'credential';

  return {
    callerKey: sha256(`mcp-session\n${principalKey}\n${trustedSessionId}`),
  };
}
