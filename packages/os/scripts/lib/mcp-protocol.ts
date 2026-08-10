type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number | null;

export const MODERN_MCP_PROTOCOL_VERSION = '2026-07-28';
export const LEGACY_MCP_PROTOCOL_VERSION = '2024-11-05';

const PROTOCOL_VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_INFO_KEY = 'io.modelcontextprotocol/clientInfo';
const CLIENT_CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities';
const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';
const SERVER_INFO = { name: 'consuelo-os-gateway', version: '1.0.0' };

export type ModernMcpRouting = {
  protocolVersion: string;
  method: string;
  name?: string;
};

export type ModernMcpHttpValidation =
  | { ok: true; modern: false }
  | { ok: true; modern: true; routing: ModernMcpRouting }
  | { ok: false; status: 400; response: JsonObject };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(body: string): JsonObject | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function requestId(request: JsonObject | null): JsonRpcId {
  const id = request?.id;
  return typeof id === 'string' || typeof id === 'number' || id === null ? id : null;
}

function requestMeta(request: JsonObject): JsonObject | null {
  if (!isJsonObject(request.params)) return null;
  return isJsonObject(request.params._meta) ? request.params._meta : null;
}

function requestName(request: JsonObject): string | undefined {
  if (
    request.method !== 'tools/call'
    || !isJsonObject(request.params)
    || typeof request.params.name !== 'string'
    || request.params.name.trim().length === 0
  ) return undefined;
  return request.params.name.trim();
}

function jsonRpcError(id: JsonRpcId, code: number, message: string): JsonObject {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function modernMcpRoutingFromBody(body: string): ModernMcpRouting | null {
  const request = parseBody(body);
  if (!request || typeof request.method !== 'string') return null;
  const meta = requestMeta(request);
  const protocolVersion = meta?.[PROTOCOL_VERSION_KEY];
  const modern = request.method === 'server/discover'
    || protocolVersion === MODERN_MCP_PROTOCOL_VERSION;
  if (!modern) return null;
  const name = requestName(request);
  return {
    protocolVersion: MODERN_MCP_PROTOCOL_VERSION,
    method: request.method,
    ...(name ? { name } : {}),
  };
}

export function modernMcpRoutingHeaders(body: string): Record<string, string> | null {
  const routing = modernMcpRoutingFromBody(body);
  if (!routing) return null;
  return {
    'mcp-protocol-version': routing.protocolVersion,
    'mcp-method': routing.method,
    ...(routing.name ? { 'mcp-name': routing.name } : {}),
  };
}

export function validateModernMcpHttpRequest(
  body: string,
  headers: Headers,
): ModernMcpHttpValidation {
  const routing = modernMcpRoutingFromBody(body);
  const request = parseBody(body);
  const id = requestId(request);
  const headerVersion = headers.get('mcp-protocol-version');
  const headerMethod = headers.get('mcp-method');
  const headerName = headers.get('mcp-name');
  if (!routing) {
    if (headerVersion === null && headerMethod === null && headerName === null) {
      return { ok: true, modern: false };
    }
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(id, -32020, 'MCP routing headers do not match the request body.'),
    };
  }
  const meta = request ? requestMeta(request) : null;
  const clientInfo = meta?.[CLIENT_INFO_KEY];
  const capabilities = meta?.[CLIENT_CAPABILITIES_KEY];
  if (
    meta?.[PROTOCOL_VERSION_KEY] !== MODERN_MCP_PROTOCOL_VERSION
    || !isJsonObject(clientInfo)
    || typeof clientInfo.name !== 'string'
    || clientInfo.name.trim().length === 0
    || typeof clientInfo.version !== 'string'
    || clientInfo.version.trim().length === 0
    || !isJsonObject(capabilities)
  ) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(id, -32602, 'Invalid MCP 2026 request metadata.'),
    };
  }

  if (
    headerVersion !== routing.protocolVersion
    || headerMethod !== routing.method
    || (headerName ?? undefined) !== routing.name
  ) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(id, -32020, 'MCP routing headers do not match the request body.'),
    };
  }
  return { ok: true, modern: true, routing };
}

export function stampModernMcpResult(result: JsonObject): JsonObject {
  const existingMeta = isJsonObject(result._meta) ? result._meta : {};
  return {
    ...result,
    resultType: 'complete',
    _meta: {
      ...existingMeta,
      [SERVER_INFO_KEY]: SERVER_INFO,
    },
  };
}

export function modernMcpClientMeta(clientName: string): JsonObject {
  return {
    [PROTOCOL_VERSION_KEY]: MODERN_MCP_PROTOCOL_VERSION,
    [CLIENT_INFO_KEY]: { name: clientName, version: '1.0.0' },
    [CLIENT_CAPABILITIES_KEY]: {},
  };
}
