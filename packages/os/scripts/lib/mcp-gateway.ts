import { readFullToolManifest } from './manifest';
import { resolveToolScope } from './security-gateway';
import type { CallInput, CallOutput } from './types';

type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number | null;

type ParsedJsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type ToolManifestEntry = ReturnType<typeof readFullToolManifest>['tools'][number];

export type McpGatewayScopeResolution =
  | {
      ok: true;
      method: string;
      requiredScope: string;
      toolName?: string;
    }
  | {
      ok: false;
      status: 400 | 403;
      error: { code: string; message: string };
    };

type McpGatewayHandlerInput = {
  executeCall: (input: CallInput) => Promise<CallOutput>;
};

const MCP_READ_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
]);

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRpcId(value: unknown): JsonRpcId {
  if (typeof value === 'string' || typeof value === 'number' || value === null) return value;
  return null;
}

function parseJsonRpcRequest(body: string): ParsedJsonRpcRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return null;
  }

  if (!isJsonObject(parsed) || typeof parsed.method !== 'string') return null;
  return {
    id: parseJsonRpcId(parsed.id),
    method: parsed.method,
    ...(Object.hasOwn(parsed, 'params') ? { params: parsed.params } : {}),
  };
}

function toolNameFromParams(params: unknown): string | null {
  if (!isJsonObject(params) || typeof params.name !== 'string' || params.name.trim().length === 0) {
    return null;
  }
  return params.name.trim();
}

function jsonRpcResult(id: JsonRpcId, result: JsonObject): JsonObject {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string): JsonObject {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
}

function inputSchemaFromDefinition(definition: JsonObject): JsonObject {
  const inputSchema = definition.inputSchema;
  return isJsonObject(inputSchema) ? inputSchema : { type: 'object', additionalProperties: true };
}

function outputTextFromCall(output: CallOutput): string {
  const visibleOutput = output.ok ? output.result ?? { ok: true } : output.error ?? { code: 'CALL_FAILED' };
  return JSON.stringify(visibleOutput, null, 2);
}

function findCallableMcpTool(toolName: string): ToolManifestEntry | null {
  return readFullToolManifest().tools.find((entry) => entry.name === toolName && entry.kind === 'os-skill') ?? null;
}

function listMcpTools(): JsonObject[] {
  return readFullToolManifest().tools.filter((entry) => entry.kind === 'os-skill').map((entry) => {
    const definition = entry.definition;
    const title = typeof definition.title === 'string' ? definition.title : entry.name;
    const description = typeof definition.description === 'string' ? definition.description : '';
    const scope = resolveToolScope(entry.name);

    return {
      name: entry.name,
      title,
      description,
      inputSchema: inputSchemaFromDefinition(definition),
      annotations: {
        consueloKind: entry.kind,
        ...(scope.ok ? { requiredScope: scope.requiredScope, category: scope.category } : {}),
      },
    };
  });
}

export function resolveMcpGatewayRequiredScope(body: string): McpGatewayScopeResolution {
  const request = parseJsonRpcRequest(body);
  if (!request) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_MCP_REQUEST', message: 'MCP request must be a JSON-RPC object.' },
    };
  }

  if (request.method === 'tools/call') {
    const toolName = toolNameFromParams(request.params);
    if (!toolName) {
      return {
        ok: false,
        status: 400,
        error: { code: 'INVALID_MCP_TOOL_CALL', message: 'MCP tools/call requires a tool name.' },
      };
    }

    const callableTool = findCallableMcpTool(toolName);
    if (!callableTool) {
      const toolScope = resolveToolScope(toolName);
      if (!toolScope.ok) {
        return { ok: false, status: toolScope.status, error: toolScope.error };
      }
      return {
        ok: false,
        status: 403,
        error: { code: 'UNSUPPORTED_MCP_TOOL', message: 'MCP gateway only supports callable OS skills.' },
      };
    }

    const toolScope = resolveToolScope(toolName);
    if (!toolScope.ok) {
      return { ok: false, status: toolScope.status, error: toolScope.error };
    }

    return {
      ok: true,
      method: request.method,
      toolName,
      requiredScope: toolScope.requiredScope,
    };
  }

  if (MCP_READ_METHODS.has(request.method)) {
    return {
      ok: true,
      method: request.method,
      requiredScope: 'route:/mcp:read',
    };
  }

  return {
    ok: false,
    status: 400,
    error: { code: 'UNKNOWN_MCP_METHOD', message: 'MCP method is not supported by this gateway.' },
  };
}

export async function handleMcpGatewayJsonRpc(
  body: string,
  input: McpGatewayHandlerInput,
): Promise<JsonObject> {
  const request = parseJsonRpcRequest(body);
  if (!request) return jsonRpcError(null, -32600, 'Invalid JSON-RPC request.');

  if (request.method === 'initialize') {
    return jsonRpcResult(request.id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'consuelo-os-gateway', version: '1.0.0' },
      capabilities: { tools: { listChanged: false }, prompts: {}, resources: {} },
    });
  }

  if (request.method === 'notifications/initialized' || request.method === 'ping') {
    return jsonRpcResult(request.id, {});
  }

  if (request.method === 'tools/list') {
    return jsonRpcResult(request.id, { tools: listMcpTools() });
  }

  if (request.method === 'prompts/list') {
    return jsonRpcResult(request.id, { prompts: [] });
  }

  if (request.method === 'resources/list') {
    return jsonRpcResult(request.id, { resources: [] });
  }

  if (request.method !== 'tools/call') {
    return jsonRpcError(request.id, -32601, 'Method not found.');
  }

  const toolName = toolNameFromParams(request.params);
  if (!toolName) return jsonRpcError(request.id, -32602, 'Invalid tools/call params.');

  const toolArguments = isJsonObject(request.params) && Object.hasOwn(request.params, 'arguments')
    ? request.params.arguments
    : {};
  const output = await input.executeCall({ name: toolName, input: toolArguments });

  return jsonRpcResult(request.id, {
    content: [{ type: 'text', text: outputTextFromCall(output) }],
    isError: !output.ok,
  });
}
