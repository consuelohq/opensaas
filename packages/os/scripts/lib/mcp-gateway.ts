import { resolveToolScope } from './security-gateway';
import {
  LEGACY_MCP_PROTOCOL_VERSION,
  MODERN_MCP_PROTOCOL_VERSION,
  modernMcpRoutingFromBody,
  stampModernMcpResult,
} from './mcp-protocol';
import { normalizeMcpNodeId } from './mcp-node-routing';

type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number | null;

type ParsedJsonRpcRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type FacadeCall = {
  tool: string;
  input: JsonObject;
  taskSession?: string;
  nodeId?: string;
  timeout?: number;
};

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
  getSteering: () => Promise<string>;
  executeFacadeTool: (toolName: string, input: JsonObject) => Promise<unknown>;
};

const MCP_READ_METHODS = new Set([
  'server/discover',
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
]);

const MCP_TOOL_DESCRIPTORS: JsonObject[] = [
  {
    name: 'get_steering',
    title: 'Get OS steering',
    description: 'Return Consuelo OS steering and typed tool guidance. Call this once before using call.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'call',
    title: 'Call an OS tool',
    description: 'Run one typed Consuelo OS tool through the authenticated facade described by get_steering.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          minLength: 1,
          description: 'Exact typed tool name from OS steering.',
        },
        input: {
          type: 'object',
          description: 'Typed input object for the selected tool.',
          additionalProperties: true,
        },
        taskSession: {
          type: 'string',
          minLength: 1,
          description: 'Required task session for task-scoped tools.',
        },
        nodeId: {
          type: 'string',
          minLength: 1,
          maxLength: 160,
          description: 'Optional workspace node target. Omit to use the workspace default node.',
        },
        timeout: {
          type: 'integer',
          minimum: 1,
          description: 'Optional tool timeout in milliseconds.',
        },
      },
      required: ['tool'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
];

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

function publicToolNameFromParams(params: unknown): string | null {
  if (!isJsonObject(params) || typeof params.name !== 'string' || params.name.trim().length === 0) {
    return null;
  }
  return params.name.trim();
}

function toolArgumentsFromParams(params: unknown): JsonObject | null {
  if (!isJsonObject(params)) return null;
  if (!Object.hasOwn(params, 'arguments')) return {};
  return isJsonObject(params.arguments) ? params.arguments : null;
}

function hasOnlyKeys(value: JsonObject, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseFacadeCall(params: unknown): FacadeCall | null {
  const args = toolArgumentsFromParams(params);
  if (!args || !hasOnlyKeys(args, ['tool', 'input', 'taskSession', 'nodeId', 'timeout'])) return null;

  const tool = typeof args.tool === 'string' ? args.tool.trim() : '';
  if (!tool) return null;

  const callInput = Object.hasOwn(args, 'input') ? args.input : {};
  if (!isJsonObject(callInput)) return null;

  const taskSession = args.taskSession;
  if (
    taskSession !== undefined
    && (typeof taskSession !== 'string' || taskSession.trim().length === 0)
  ) {
    return null;
  }

  const nodeId = normalizeMcpNodeId(args.nodeId);
  if (nodeId === null) return null;

  const timeout = args.timeout;
  if (
    timeout !== undefined
    && (typeof timeout !== 'number' || !Number.isSafeInteger(timeout) || timeout < 1)
  ) {
    return null;
  }

  return {
    tool,
    input: callInput,
    ...(typeof taskSession === 'string' ? { taskSession: taskSession.trim() } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(typeof timeout === 'number' ? { timeout } : {}),
  };
}

function isEmptyToolArguments(params: unknown): boolean {
  const args = toolArgumentsFromParams(params);
  return args !== null && Object.keys(args).length === 0;
}

function facadeToolInput(call: FacadeCall): JsonObject {
  return {
    ...call.input,
    ...(call.taskSession ? { taskSession: call.taskSession } : {}),
    ...(call.timeout ? { timeout: call.timeout } : {}),
  };
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

function outputText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
}

function outputIsError(value: unknown): boolean {
  return isJsonObject(value) && value.ok === false;
}

function unsupportedPublicTool(): McpGatewayScopeResolution {
  return {
    ok: false,
    status: 403,
    error: {
      code: 'UNSUPPORTED_MCP_TOOL',
      message: 'MCP gateway only exposes the authenticated OS facade.',
    },
  };
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
    const publicToolName = publicToolNameFromParams(request.params);
    if (!publicToolName) {
      return {
        ok: false,
        status: 400,
        error: { code: 'INVALID_MCP_TOOL_CALL', message: 'MCP tools/call requires a tool name.' },
      };
    }

    if (publicToolName === 'get_steering') {
      if (!isEmptyToolArguments(request.params)) {
        return {
          ok: false,
          status: 400,
          error: {
            code: 'INVALID_MCP_TOOL_CALL',
            message: 'get_steering does not accept arguments.',
          },
        };
      }
      return {
        ok: true,
        method: request.method,
        toolName: publicToolName,
        requiredScope: 'route:/mcp:read',
      };
    }

    if (publicToolName !== 'call') return unsupportedPublicTool();

    const facadeCall = parseFacadeCall(request.params);
    if (!facadeCall) {
      return {
        ok: false,
        status: 400,
        error: {
          code: 'INVALID_MCP_TOOL_CALL',
          message: 'call requires a typed facade tool and an object input.',
        },
      };
    }

    const toolScope = resolveToolScope(facadeCall.tool, facadeCall.input);
    if (!toolScope.ok) {
      return { ok: false, status: toolScope.status, error: toolScope.error };
    }
    if (toolScope.manifestKind !== 'facade-tool') return unsupportedPublicTool();

    return {
      ok: true,
      method: request.method,
      toolName: facadeCall.tool,
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

  if (request.method === 'server/discover') {
    return jsonRpcResult(request.id, stampModernMcpResult({
      supportedVersions: [
        MODERN_MCP_PROTOCOL_VERSION,
        LEGACY_MCP_PROTOCOL_VERSION,
      ],
      capabilities: {
        tools: { listChanged: false },
        prompts: {},
        resources: {},
      },
    }));
  }

  if (request.method === 'initialize') {
    return jsonRpcResult(request.id, {
      protocolVersion: LEGACY_MCP_PROTOCOL_VERSION,
      serverInfo: { name: 'consuelo-os-gateway', version: '1.0.0' },
      capabilities: { tools: { listChanged: false }, prompts: {}, resources: {} },
    });
  }

  const result = (value: JsonObject): JsonObject =>
    jsonRpcResult(
      request.id,
      modernMcpRoutingFromBody(body) ? stampModernMcpResult(value) : value,
    );

  if (request.method === 'notifications/initialized' || request.method === 'ping') {
    return result({});
  }

  if (request.method === 'tools/list') {
    return result({ tools: MCP_TOOL_DESCRIPTORS });
  }

  if (request.method === 'prompts/list') {
    return result({ prompts: [] });
  }

  if (request.method === 'resources/list') {
    return result({ resources: [] });
  }

  if (request.method !== 'tools/call') {
    return jsonRpcError(request.id, -32601, 'Method not found.');
  }

  const publicToolName = publicToolNameFromParams(request.params);
  if (publicToolName === 'get_steering' && isEmptyToolArguments(request.params)) {
    const steering = await input.getSteering();
    return result({
      content: [{ type: 'text', text: steering }],
      isError: false,
    });
  }

  if (publicToolName === 'call') {
    const call = parseFacadeCall(request.params);
    if (!call) return jsonRpcError(request.id, -32602, 'Invalid call arguments.');

    const output = await input.executeFacadeTool(call.tool, facadeToolInput(call));
    return result({
      content: [{ type: 'text', text: outputText(output) }],
      isError: outputIsError(output),
    });
  }

  return jsonRpcError(request.id, -32602, 'Unsupported OS tool.');
}
