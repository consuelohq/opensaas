import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

type LocalAgentCredential = {
  tokenId: string;
  bearerToken: string;
};

export type LocalAgentMcpBridge = {
  forward: (body: string) => Promise<JsonObject[]>;
};

const NODE_UNAVAILABLE_CODE = 'CONSUELO_NODE_UNAVAILABLE';

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestId(body: string): unknown {
  try {
    const parsed = JSON.parse(body) as unknown;
    return isJsonObject(parsed) ? (parsed.id ?? null) : null;
  } catch {
    return null;
  }
}

function isJsonRpcNotification(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as unknown;
    return (
      isJsonObject(parsed) &&
      typeof parsed.method === 'string' &&
      !Object.hasOwn(parsed, 'id')
    );
  } catch {
    return false;
  }
}

function unavailableResponse(body: string, retryable = true): JsonObject {
  return {
    jsonrpc: '2.0',
    id: requestId(body),
    error: {
      code: -32001,
      message: retryable
        ? 'Consuelo node is temporarily unavailable.'
        : 'Consuelo node rejected the local MCP request.',
      data: {
        code: NODE_UNAVAILABLE_CODE,
        retryable,
        ...(retryable ? { retryAfterSeconds: 2 } : {}),
      },
    },
  };
}

export function validateLocalMcpUrl(value: string): URL {
  const url = new URL(value);
  const port = Number.parseInt(url.port, 10);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/mcp' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    !Number.isInteger(port) ||
    port <= 0 ||
    port > 65_535
  ) {
    throw new Error(
      'Consuelo local MCP URL must be http://127.0.0.1:<port>/mcp.',
    );
  }
  return url;
}

export function loadLocalAgentCredential(input: {
  home: string;
  agentId: string;
}): { localUrl: URL; credential: LocalAgentCredential } {
  const credentialPath = path.join(
    input.home,
    'node',
    'security',
    'generated',
    'local-agent-mcp.json',
  );
  const stat = fs.statSync(credentialPath);
  if ((stat.mode & 0o077) !== 0) {
    throw new Error('Consuelo local agent credentials must have mode 0600.');
  }
  const parsed = JSON.parse(fs.readFileSync(credentialPath, 'utf8')) as unknown;
  if (
    !isJsonObject(parsed) ||
    parsed.version !== 1 ||
    parsed.kind !== 'consuelo-local-agent-mcp-credentials' ||
    typeof parsed.localUrl !== 'string' ||
    !isJsonObject(parsed.agents)
  ) {
    throw new Error('Consuelo local agent credentials are invalid.');
  }
  const candidate = parsed.agents[input.agentId];
  if (
    !isJsonObject(candidate) ||
    typeof candidate.tokenId !== 'string' ||
    typeof candidate.bearerToken !== 'string' ||
    candidate.bearerToken.length === 0
  ) {
    throw new Error(
      `No Consuelo local MCP credential exists for ${input.agentId}.`,
    );
  }
  return {
    localUrl: validateLocalMcpUrl(parsed.localUrl),
    credential: {
      tokenId: candidate.tokenId,
      bearerToken: candidate.bearerToken,
    },
  };
}

function parseSseMessages(body: string): JsonObject[] {
  const messages: JsonObject[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload.length === 0 || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (isJsonObject(parsed)) messages.push(parsed);
    } catch {
      // A malformed SSE frame must not discard adjacent valid MCP messages.
    }
  }
  return messages;
}

export function createLocalAgentMcpBridge(input: {
  home: string;
  agentId: string;
  fetchImpl?: typeof fetch;
}): LocalAgentMcpBridge {
  const { localUrl, credential } = loadLocalAgentCredential(input);
  const fetchImpl = input.fetchImpl ?? fetch;
  let mcpSessionId: string | undefined;

  return {
    async forward(body: string): Promise<JsonObject[]> {
      const notification = isJsonRpcNotification(body);
      try {
        const response = await fetchImpl(localUrl, {
          method: 'POST',
          headers: {
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${credential.bearerToken}`,
            'content-type': 'application/json',
            'x-consuelo-agent-id': input.agentId,
            ...(mcpSessionId ? { 'mcp-session-id': mcpSessionId } : {}),
          },
          body,
          signal: AbortSignal.timeout(30_000),
        });
        const nextSessionId = response.headers.get('mcp-session-id');
        if (nextSessionId) mcpSessionId = nextSessionId;
        if (notification) return [];
        if (response.status === 204) return [];
        if (!response.ok) {
          const retryable =
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500;
          return [unavailableResponse(body, retryable)];
        }
        const responseBody = await response.text();
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/event-stream')) {
          return parseSseMessages(responseBody);
        }
        const parsed = JSON.parse(responseBody) as unknown;
        return isJsonObject(parsed) ? [parsed] : [unavailableResponse(body)];
      } catch {
        return notification ? [] : [unavailableResponse(body)];
      }
    },
  };
}
