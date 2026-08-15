import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGatewaySecurityConfig,
  getAgentAppCredentialStatus,
  issueAgentAppToken,
  listAgentAppCredentialStatuses,
  reconcileGatewayWorkspaceEdgeProxyAuth,
  signMachineRequest,
  verifyMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import { createWorkspaceEdgeNodeHeaders } from '../scripts/lib/workspace-edge-node-auth';
import {
  encodeMcpNodeRoutingContext,
  MCP_NODE_CONTEXT_HEADER,
  MCP_ROUTE_SOURCE_HEADER,
  type McpNodeRoutingContext,
} from '../scripts/lib/mcp-node-routing';
import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../scripts/lib/mcp-gateway';
import { handleRequest } from '../scripts/server/app';
import { createMcpRoutes } from '../scripts/server/routes/mcp';
import { resolveMcpRequestSession } from '../scripts/server/services/mcp-session';
import { removeSafeTempDir } from './safe-temp-cleanup';

type JsonObject = Record<string, unknown>;

let tempHome = '';
const originalFetch = globalThis.fetch;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string): JsonObject {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isJsonObject(parsed)) throw new Error(`${path} did not contain a JSON object`);
  return parsed;
}

async function readJsonResponse(response: Response): Promise<JsonObject> {
  const parsed = await response.json() as unknown;
  if (!isJsonObject(parsed)) throw new Error('response did not contain a JSON object');
  return parsed;
}

function storedTokenRecord(config: GatewaySecurityConfig, token: AgentAppToken): JsonObject {
  const stored = readJsonFile(config.generatedAuthPath);
  const tokens = stored.tokens;
  if (!isJsonObject(tokens) || !isJsonObject(tokens[token.tokenId])) {
    throw new Error('stored token was not found');
  }
  return tokens[token.tokenId];
}

function createConfig(): GatewaySecurityConfig {
  return createGatewaySecurityConfig({
    home: tempHome,
    workspaceId: 'workspace_mcp_test',
    workspaceSlug: 'mcp-test',
    workspaceHost: 'mcp-test.consuelohq.com',
  });
}

function issueMcpToken(config: GatewaySecurityConfig, scopes: string[]): AgentAppToken {
  return issueAgentAppToken({
    config,
    callerId: 'caller_mcp_test',
    appId: 'app_mcp_test',
    subjectId: 'subject_mcp_test',
    deviceId: 'device_mcp_test',
    connectorId: 'connector_mcp_test',
    connectionId: 'connection_mcp_test',
    scopes,
    expiresInSeconds: 300,
  });
}

const MODERN_MCP_VERSION = '2026-07-28';

function modernMcpMeta(): JsonObject {
  return {
    'io.modelcontextprotocol/protocolVersion': MODERN_MCP_VERSION,
    'io.modelcontextprotocol/clientInfo': { name: 'consuelo-test-client', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

function blockedPolicyFixture(): string {
  return [
    ['r', 'm'].join(''),
    '-' + ['r', 'f'].join(''),
    String.fromCharCode(47),
  ].join(' ');
}

function modernMcpHeaders(method: string, name?: string): Record<string, string> {
  return {
    'mcp-protocol-version': MODERN_MCP_VERSION,
    'mcp-method': method,
    ...(name ? { 'mcp-name': name } : {}),
  };
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-mcp-gateway-'));
  process.env.CONSUELO_OS_HOME = tempHome;
  process.env.CONSUELO_HOME = tempHome;
  process.env.CONSUELO_OS_AUTH_CONFIG = join(tempHome, 'security', 'generated', 'auth.json');
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (tempHome) removeSafeTempDir(tempHome, 'consuelo-os-mcp-gateway-');
  tempHome = '';
});

describe('MCP gateway credential lifecycle', () => {
  it('stores scoped credential metadata without raw credential material', () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:status:read']);
    const storedToken = storedTokenRecord(config, token);
    const [status] = listAgentAppCredentialStatuses({ config });
    const directStatus = getAgentAppCredentialStatus({ config, tokenId: token.tokenId });
    const statusRecord = status as unknown as JsonObject;

    expect(storedToken.subjectId).toBe('subject_mcp_test');
    expect(storedToken.deviceId).toBe('device_mcp_test');
    expect(storedToken.connectorId).toBe('connector_mcp_test');
    expect(storedToken.connectionId).toBe('connection_mcp_test');
    expect(storedToken.secret).toBeUndefined();
    expect(storedToken.privateKey).toBeUndefined();
    expect(storedToken.bearerToken).toBeUndefined();
    expect(storedToken.bearerTokenHash).toMatch(/^sha256:/);
    expect(token.bearerToken).toMatch(/^cst_/);
    expect(typeof storedToken.publicKey).toBe('string');
    expect(status.subjectId).toBe('subject_mcp_test');
    expect(directStatus?.connectionId).toBe('connection_mcp_test');
    expect(statusRecord.secret).toBeUndefined();
  });

  it('binds signed use to credential identity and audits without raw request material', () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });
    const timestamp = new Date().toISOString();
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp,
      nonce: 'nonce-mcp-use',
    });

    expect(signed.headers['x-consuelo-subject-id']).toBe('subject_mcp_test');
    expect(signed.headers['x-consuelo-device-id']).toBe('device_mcp_test');
    expect(signed.headers['x-consuelo-credential-connector-id']).toBe('connector_mcp_test');
    expect(signed.headers['x-consuelo-connection-id']).toBe('connection_mcp_test');

    const accepted = verifyMachineRequest({
      config,
      method: 'POST',
      path: '/mcp',
      body,
      headers: signed.headers,
      workspaceId: config.workspaceId,
      requiredScope: 'route:/mcp:read',
      now: timestamp,
    });

    expect(accepted).toMatchObject({
      ok: true,
      caller: {
        workspaceId: config.workspaceId,
        subjectId: 'subject_mcp_test',
        deviceId: 'device_mcp_test',
        connectorId: 'connector_mcp_test',
        connectionId: 'connection_mcp_test',
        callerId: 'caller_mcp_test',
        appId: 'app_mcp_test',
      },
    });

    const rejected = verifyMachineRequest({
      config,
      method: 'POST',
      path: '/mcp',
      body,
      headers: { ...signed.headers, 'x-consuelo-device-id': 'device_other' },
      workspaceId: config.workspaceId,
      requiredScope: 'route:/mcp:read',
      now: timestamp,
    });

    expect(rejected).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'DEVICE_MISMATCH' },
    });

    const auditLogPath = join(tempHome, 'logs', 'gateway-audit.jsonl');
    expect(existsSync(auditLogPath)).toBe(true);
    const auditLog = readFileSync(auditLogPath, 'utf8');
    expect(auditLog).toContain('gateway.credential.used');
    expect(auditLog).toContain('verified');
    expect(auditLog).toContain('device_mismatch');
    expect(auditLog).not.toContain(token.secret);
    expect(auditLog).not.toContain('nonce-mcp-use');
    expect(auditLog).not.toContain(body);
  });

  it('fails closed on legacy secret-backed auth without rewriting credentials', () => {
    const generatedAuthPath = join(tempHome, 'security', 'generated', 'auth.json');
    const legacyAuth = {
      version: 1,
      kind: 'consuelo-generated',
      workspaceId: 'workspace_mcp_test',
      workspaceSlug: 'mcp-test',
      workspaceHost: 'mcp-test.consuelohq.com',
      tokenIssuer: 'consuelo-os-gateway',
      signingKeyId: 'csg_legacy',
      publicRoutes: ['/mcp'],
      publicGateway: {
        provider: 'cloudflare',
        routeMode: 'workspace-subdomain',
        connectorMode: 'outbound-os-connector',
        hostname: 'mcp-test.consuelohq.com',
        upstream: { host: '127.0.0.1', port: 46321 },
      },
      tokens: {
        tok_legacy: {
          tokenId: 'tok_legacy',
          workspaceId: 'workspace_mcp_test',
          callerId: 'caller_mcp_test',
          appId: 'app_mcp_test',
          scopes: ['route:/mcp:read'],
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          secret: 'legacy-secret-material',
          status: 'active',
        },
      },
      seenNonces: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(generatedAuthPath), { recursive: true });
    writeFileSync(generatedAuthPath, `${JSON.stringify(legacyAuth, null, 2)}\n`);

    expect(() => createConfig()).toThrow(/requires credential rotation/);
    expect(readFileSync(generatedAuthPath, 'utf8')).toContain('legacy-secret-material');
  });
});

describe('MCP gateway adapter', () => {
  it('should resolve nested facade scopes and fail closed when the MCP call is malformed or unknown', () => {
    const listScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    }));
    const callScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: { tool: 'explore', input: { query: 'status' } },
      },
    }));
    const unknownScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'call', arguments: { tool: 'missing_tool' } },
    }));
    const missingNestedTool = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'call', arguments: {} },
    }));
    const directFacadeCall = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'explore', arguments: {} },
    }));

    expect(listScope).toMatchObject({ ok: true, requiredScope: 'route:/mcp:read' });
    expect(callScope).toMatchObject({
      ok: true,
      toolName: 'explore',
      requiredScope: 'tool:explore:read',
    });
    expect(unknownScope).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNKNOWN_TOOL_SCOPE' },
    });
    expect(missingNestedTool).toMatchObject({
      ok: false,
      status: 400,
      error: { code: 'INVALID_MCP_TOOL_CALL' },
    });
    expect(directFacadeCall).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNSUPPORTED_MCP_TOOL' },
    });
  });

  it('accepts bearer-only MCP requests and lets the gateway handle internal auth', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:*:read']);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.bearerToken}`,
        'content-type': 'application/json',
      },
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(json.result).toBeDefined();

    const missingScopeToken = issueMcpToken(config, ['route:/mcp:read']);
    const denied = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${missingScopeToken.bearerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call',
        method: 'tools/call',
        params: { name: 'call', arguments: { tool: 'explore', input: {} } },
      }),
    }));
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });

  it('rejects an explicit untrusted Origin at the MCP route before execution', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const executeFacadeTool = vi.fn();
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool,
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.bearerToken}`,
        'content-type': 'application/json',
        origin: 'https://attacker.example',
      },
      body,
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_MCP_ORIGIN' },
    });
    expect(executeFacadeTool).not.toHaveBeenCalled();
  });


  it('rejects an Origin that only matches the inbound Host-derived request origin', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(),
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    });

    const response = await app.request(new Request('http://rebind.attacker.example/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token.bearerToken,
        'content-type': 'application/json',
        origin: 'http://rebind.attacker.example',
      },
      body,
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_MCP_ORIGIN' },
    });
  });

  it('should accept an active Consuelo OAuth token when a public MCP request targets the central resource', async () => {
    const config = createConfig();
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });

    const missing = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-consuelo-hostname': config.workspaceHost },
      body,
    }));
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toContain(
      `https://${config.workspaceHost}/.well-known/oauth-protected-resource`,
    );

    const fetchCalls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, body: String(init?.body ?? '') });
      return new Response(JSON.stringify({
        active: true,
        client_id: 'chatgpt-consuelo-os',
        workspace_host: config.workspaceHost,
        scopes: ['route:/mcp:read', 'tool:*:read'],
        sub: 'google:123',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const accepted = await handleRequest(new Request('https://c-test-connector.consuelohq.com/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer coa_test_oauth_access_token',
        'content-type': 'application/json',
        'x-consuelo-hostname': config.workspaceHost,
      },
      body,
    }));
    const json = await readJsonResponse(accepted);

    expect(accepted.status).toBe(200);
    expect(json.result).toBeDefined();
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('https://os.consuelohq.com/oauth/introspect');
    expect(fetchCalls[0].body).toContain('resource=https%3A%2F%2Fos.consuelohq.com%2Fmcp');
  });

  it('should reject a node-local bearer when it is presented through the public connector', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:*:read']);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });

    const loopback = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.bearerToken}`,
        'content-type': 'application/json',
      },
      body,
    }));
    expect(loopback.status).toBe(200);

    globalThis.fetch = async () => new Response(JSON.stringify({ active: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const publicConnector = await handleRequest(new Request('https://c-test-connector.consuelohq.com/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.bearerToken}`,
        'content-type': 'application/json',
        'x-consuelo-hostname': config.workspaceHost,
      },
      body,
    }));

    expect(publicConnector.status).toBe(401);
    await expect(publicConnector.json()).resolves.toMatchObject({
      error: { code: 'UNKNOWN_TOKEN' },
    });

    const deceptiveHostname = await handleRequest(new Request('https://127.attacker.example/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token.bearerToken}`,
        'content-type': 'application/json',
      },
      body,
    }));
    expect(deceptiveHostname.status).toBe(401);
  });

  it('advertises OAuth discovery for non-POST MCP probes on dynamic workspace hosts', async () => {
    createConfig();
    const dynamicHost = 'probe-' + crypto.randomUUID().slice(0, 8) + '.consuelohq.com';

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'GET',
      headers: { 'x-consuelo-hostname': dynamicHost },
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ error: { code: 'MISSING_BEARER' } });
    expect(response.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://' + dynamicHost + '/.well-known/oauth-protected-resource"',
    );
  });

  it('should expose exactly the annotated OS facade tools when ChatGPT lists tools', async () => {
    const listResponse = await handleMcpGatewayJsonRpc(JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    }), {
      getSteering: async () => 'unused',
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const result = isJsonObject(listResponse.result) ? listResponse.result : {};
    const tools = Array.isArray(result.tools) ? result.tools : [];

    expect(tools.map((tool) => isJsonObject(tool) ? tool.name : null)).toEqual([
      'get_steering',
      'call',
    ]);
    const callTool = tools.find((tool) => isJsonObject(tool) && tool.name === 'call');
    expect(callTool).toMatchObject({
      inputSchema: {
        properties: {
          nodeId: {
            type: 'string',
            description: expect.stringContaining('top-level'),
          },
        },
      },
    });

    for (const tool of tools) {
      expect(tool).toMatchObject({
        inputSchema: { type: 'object' },
        annotations: {
          readOnlyHint: true,
          openWorldHint: false,
          destructiveHint: false,
        },
      });
      const toolRecord = isJsonObject(tool) ? tool : {};
      const annotations = isJsonObject(toolRecord.annotations) ? toolRecord.annotations : {};
      expect(Object.keys(annotations).sort()).toEqual([
        'destructiveHint',
        'openWorldHint',
        'readOnlyHint',
      ]);
    }
  });

  it('should return guarded steering when ChatGPT calls get_steering', async () => {
    const getSteering = vi.fn(async () => '# OS steering');
    const executeFacadeTool = vi.fn();

    const response = await handleMcpGatewayJsonRpc(JSON.stringify({
      jsonrpc: '2.0',
      id: 'steering-1',
      method: 'tools/call',
      params: { name: 'get_steering', arguments: {} },
    }), { getSteering, executeFacadeTool });

    expect(getSteering).toHaveBeenCalledOnce();
    expect(executeFacadeTool).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'steering-1',
      result: {
        isError: false,
        content: [{ type: 'text', text: '# OS steering' }],
      },
    });
  });

  it('should dispatch nested facade calls without echoing request metadata', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'call-1',
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool: 'explore',
          input: { query: 'status' },
          taskSession: 'tsk_test',
          nodeId: 'node_cloud_test',
          timeout: 12_000,
        },
      },
    });
    const executeFacadeTool = vi.fn(async (input) => ({
      ok: true,
      code: 'OK',
      data: { acceptedInput: input },
    }));

    const response = await handleMcpGatewayJsonRpc(body, {
      getSteering: async () => 'unused',
      executeFacadeTool,
    });

    expect(executeFacadeTool).toHaveBeenCalledWith('explore', {
      query: 'status',
      taskSession: 'tsk_test',
      timeout: 12_000,
    });
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-1',
      result: { isError: false },
    });
    expect(JSON.stringify(response)).toContain('acceptedInput');
    expect(JSON.stringify(response)).not.toContain('x-consuelo-signature');
  });

});

describe('MCP admission error contract', () => {
  it('returns a traceable JSON-RPC safety denial instead of a transport-shaped HTTP error', async () => {
    createConfig();
    const executeFacadeTool = vi.fn();
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool,
    });
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const fixture = blockedPolicyFixture();
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'blocked-policy-call',
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool: 'status',
          input: { reason: fixture },
        },
      },
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));
    const json = await readJsonResponse(response);
    const requestId = response.headers.get('x-consuelo-request-id');

    expect(response.status).toBe(200);
    expect(requestId).toMatch(/^[a-zA-Z0-9._:-]{8,128}$/);
    expect(json).toMatchObject({
      jsonrpc: '2.0',
      id: 'blocked-policy-call',
      error: {
        code: -32040,
        message: 'Request blocked by Consuelo safety policy.',
        data: {
          code: 'DANGEROUS_MATERIAL_BLOCKED',
          requestId,
        },
      },
    });
    expect(executeFacadeTool).not.toHaveBeenCalled();
    const log = writes.join('');
    expect(log).toContain('local_os.mcp_request_received');
    expect(log).toContain('security.dangerous_material.denied');
    expect(log).toContain(requestId!);
    expect(log).not.toContain(fixture);
  });

  it('keeps ordinary missing-bearer authentication failures as HTTP 401 with the receipt id', async () => {
    createConfig();
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: vi.fn(),
    });
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'safe-tools', method: 'tools/list' });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('x-consuelo-request-id')).toMatch(
      /^[a-zA-Z0-9._:-]{8,128}$/,
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'MISSING_BEARER' },
    });
  });
});

describe('MCP gateway server route', () => {
  it('should pass matching node routing context when guarded steering is requested', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const nodeRouting: McpNodeRoutingContext = {
      version: 1,
      workspaceId: config.workspaceId,
      currentNodeId: 'node_cloud_test',
      defaultNodeId: 'node_cloud_test',
      routeSource: 'explicit',
      nodes: [
        {
          nodeId: 'node_cloud_test',
          displayName: 'Cloud Node',
          role: 'home',
          platform: 'linux',
          presence: 'online',
          state: 'active',
        },
      ],
    };
    const getSteering = vi.fn(async () => '# OS steering');
    const app = createMcpRoutes({
      getSteering,
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'steering-node-routing',
      method: 'tools/call',
      params: { name: 'get_steering', arguments: {} },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-steering-node-routing',
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        ...signed.headers,
        'x-consuelo-node-id': nodeRouting.currentNodeId,
        [MCP_ROUTE_SOURCE_HEADER]: nodeRouting.routeSource,
        [MCP_NODE_CONTEXT_HEADER]: encodeMcpNodeRoutingContext(nodeRouting),
      },
      body,
    }));

    expect(response.status).toBe(200);
    expect(getSteering).toHaveBeenCalledOnce();
    expect(getSteering.mock.calls[0]?.[1]).toEqual(nodeRouting);
  });

  it('should propagate resolved node routing without leaking nodeId when facade tracing executes', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:explore:read']);
    const nodeRouting: McpNodeRoutingContext = {
      version: 1,
      workspaceId: config.workspaceId,
      currentNodeId: 'node_cloud_test',
      defaultNodeId: 'node_home_test',
      routeSource: 'explicit',
      nodes: [
        {
          nodeId: 'node_cloud_test',
          displayName: 'Cloud Node',
          role: 'member',
          platform: 'linux',
          presence: 'online',
          state: 'active',
        },
      ],
    };
    const executeFacadeTool = vi.fn(async () => ({ ok: true, code: 'OK' }));
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool,
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'node-traced-call',
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool: 'explore',
          nodeId: 'node_cloud_test',
          input: { query: 'status' },
        },
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-node-traced-call',
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        ...signed.headers,
        'x-consuelo-node-id': 'node_cloud_test',
        [MCP_ROUTE_SOURCE_HEADER]: 'explicit',
        [MCP_NODE_CONTEXT_HEADER]: encodeMcpNodeRoutingContext(nodeRouting),
      },
      body,
    }));

    expect(response.status).toBe(200);
    expect(executeFacadeTool).toHaveBeenCalledWith(
      'explore',
      { query: 'status' },
      {
        requestedNodeId: 'node_cloud_test',
        resolvedNodeId: 'node_cloud_test',
        resolvedNodeName: 'Cloud Node',
        defaultNodeId: 'node_home_test',
        routeSource: 'explicit',
      },
    );
  });

  it('should serve modern MCP discovery without creating a transport session', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'discover-modern',
      method: 'server/discover',
      params: { _meta: modernMcpMeta() },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-discovery',
    });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { ...signed.headers, ...modernMcpHeaders('server/discover') },
      body,
    }));
    const json = await readJsonResponse(response);
    const result = isJsonObject(json.result) ? json.result : {};
    const meta = isJsonObject(result._meta) ? result._meta : {};

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(result).toMatchObject({
      resultType: 'complete',
      supportedVersions: expect.arrayContaining([MODERN_MCP_VERSION]),
      capabilities: { tools: expect.any(Object) },
    });
    expect(result.serverInfo).toBeUndefined();
    expect(meta['io.modelcontextprotocol/serverInfo']).toMatchObject({
      name: 'consuelo-os-gateway',
      version: '1.0.0',
    });
  });

  it('should isolate steering guards by OAuth bearer behind the signed workspace edge', async () => {
    const config = createConfig();
    const signingSecret = 'workspace-edge-oauth-isolation-secret';
    reconcileGatewayWorkspaceEdgeProxyAuth({
      authConfigPath: config.generatedAuthPath,
      workspaceId: config.workspaceId,
      nodeId: 'node_mcp_test',
      connectorId: 'connector_mcp_test',
      signingSecret,
    });
    const getSteering = vi.fn(async () => '# OS steering');
    const app = createMcpRoutes({
      getSteering,
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const introspection = vi.fn(async () => new Response(
      JSON.stringify({ active: false }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    globalThis.fetch = introspection as unknown as typeof fetch;

    const sendSteering = async (authorization: string, nonce: string) => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: nonce,
        method: 'tools/call',
        params: {
          name: 'get_steering',
          arguments: {},
          _meta: modernMcpMeta(),
        },
      });
      const edgeHeaders = createWorkspaceEdgeNodeHeaders({
        signingSecret,
        workspaceId: config.workspaceId,
        nodeId: 'node_mcp_test',
        connectorId: 'connector_mcp_test',
        surface: 'os',
        method: 'POST',
        pathWithSearch: '/mcp',
        body,
        timestamp: String(Date.now()),
        nonce,
      });
      const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
        method: 'POST',
        headers: {
          ...edgeHeaders,
          ...modernMcpHeaders('tools/call', 'get_steering'),
          authorization,
          'content-type': 'application/json',
        },
        body,
      }));
      expect(response.status).toBe(200);
    };

    await sendSteering('Bearer coa_oauth_subject_alpha', 'edge-oauth-alpha');
    await sendSteering('bearer   coa_oauth_subject_alpha', 'edge-oauth-alpha-variant');
    await sendSteering('Bearer coa_oauth_subject_beta', 'edge-oauth-beta');

    expect(introspection).not.toHaveBeenCalled();
    expect(getSteering).toHaveBeenCalledTimes(3);
    const callerKeys = getSteering.mock.calls.map(([callerKey]) => callerKey);
    expect(callerKeys[0]).toBe(callerKeys[1]);
    expect(callerKeys[0]).not.toBe(callerKeys[2]);
    expect(callerKeys).toEqual([
      expect.stringMatching(/^prn_[a-f0-9]{32}$/),
      expect.stringMatching(/^prn_[a-f0-9]{32}$/),
      expect.stringMatching(/^prn_[a-f0-9]{32}$/),
    ]);
    expect(callerKeys.join('')).not.toContain('coa_oauth_subject');
  });

  it('should stamp modern list results and ignore legacy transport session headers', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools-modern',
      method: 'tools/list',
      params: { _meta: modernMcpMeta() },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-tools-list',
    });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: {
        ...signed.headers,
        ...modernMcpHeaders('tools/list'),
        'mcp-session-id': 'legacy-session-that-modern-must-ignore',
      },
      body,
    }));
    const json = await readJsonResponse(response);
    const result = isJsonObject(json.result) ? json.result : {};
    const meta = isJsonObject(result._meta) ? result._meta : {};

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(result.resultType).toBe('complete');
    expect(meta['io.modelcontextprotocol/serverInfo']).toMatchObject({
      name: 'consuelo-os-gateway',
      version: '1.0.0',
    });
  });

  it('should reject modern MCP routing headers that disagree with the authenticated body', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const getSteering = vi.fn(async () => '# OS steering');
    const app = createMcpRoutes({
      getSteering,
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'modern-header-mismatch',
      method: 'tools/call',
      params: {
        name: 'get_steering',
        arguments: {},
        _meta: modernMcpMeta(),
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-header-mismatch',
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { ...signed.headers, ...modernMcpHeaders('tools/call', 'call') },
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      jsonrpc: '2.0',
      id: 'modern-header-mismatch',
      error: { code: -32020 },
    });
    expect(getSteering).not.toHaveBeenCalled();
  });

  it('should reject modern routing headers on a legacy request body', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'modern-header-legacy-body',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'legacy-client', version: '1.0.0' },
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-header-legacy-body',
    });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { ...signed.headers, ...modernMcpHeaders('tools/list') },
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(400);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(json).toMatchObject({
      jsonrpc: '2.0',
      id: 'modern-header-legacy-body',
      error: { code: -32020 },
    });
  });

  it('should reject 2026 metadata on the legacy initialize path', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'modern-initialize',
      method: 'initialize',
      params: {
        protocolVersion: '2026-07-28',
        capabilities: {},
        clientInfo: { name: 'modern-client', version: '1.0.0' },
        _meta: modernMcpMeta(),
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-initialize',
    });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { ...signed.headers, ...modernMcpHeaders('initialize') },
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(400);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(json).toMatchObject({
      jsonrpc: '2.0',
      id: 'modern-initialize',
      error: { code: -32602 },
    });
  });

  it('should reject malformed modern request metadata before execution', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'modern-meta-missing-capabilities',
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': MODERN_MCP_VERSION,
          'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
        },
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-modern-meta-invalid',
    });

    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: { ...signed.headers, ...modernMcpHeaders('tools/list') },
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      jsonrpc: '2.0',
      id: 'modern-meta-missing-capabilities',
      error: { code: -32602 },
    });
  });

  it('should keep unissued MCP session ids in the authenticated credential bucket', () => {
    const request = new Request('http://127.0.0.1:46321/mcp', {
      headers: {
        authorization: 'Bearer secret-value',
        'x-consuelo-workspace-id': 'workspace-test',
      },
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'get_steering', arguments: {} },
    });

    const first = resolveMcpRequestSession(new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        'mcp-session-id': 'unissued-session-alpha',
      },
    }), body);
    const second = resolveMcpRequestSession(new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        'mcp-session-id': 'unissued-session-beta',
      },
    }), body);

    expect(first.callerKey).toBe(second.callerKey);
    expect(first.callerKey).not.toContain('secret-value');
  });

  it('should share steering guard identity across legacy sessions for the same authenticated principal', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const callerKeys: string[] = [];
    const app = createMcpRoutes({
      getSteering: async (callerKey) => {
        callerKeys.push(callerKey);
        return '# OS steering';
      },
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });

    const initializeSession = async (nonce: string): Promise<string> => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: nonce,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: nonce, version: '1.0.0' },
        },
      });
      const signed = signMachineRequest({
        config,
        token,
        method: 'POST',
        path: '/mcp',
        body,
        timestamp: new Date().toISOString(),
        nonce,
      });
      const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
        method: 'POST',
        headers: signed.headers,
        body,
      }));
      expect(response.status).toBe(200);
      const sessionId = response.headers.get('mcp-session-id');
      expect(sessionId).toMatch(/^[a-zA-Z0-9._~-]{8,128}$/);
      return sessionId!;
    };

    const callSteering = async (sessionId: string, nonce: string) => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: nonce,
        method: 'tools/call',
        params: { name: 'get_steering', arguments: {} },
      });
      const signed = signMachineRequest({
        config,
        token,
        method: 'POST',
        path: '/mcp',
        body,
        timestamp: new Date().toISOString(),
        nonce,
      });
      const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
        method: 'POST',
        headers: {
          ...signed.headers,
          'mcp-session-id': sessionId,
        },
        body,
      }));
      expect(response.status).toBe(200);
    };

    const sessionAlpha = await initializeSession('nonce-initialize-alpha');
    const sessionBeta = await initializeSession('nonce-initialize-beta');

    await callSteering(sessionAlpha, 'nonce-session-alpha-1');
    await callSteering(sessionBeta, 'nonce-session-beta-1');
    await callSteering(
      sessionAlpha,
      'nonce-session-alpha-2',
    );

    expect(callerKeys).toHaveLength(3);
    expect(new Set(callerKeys).size).toBe(1);
    expect(callerKeys[0]).toMatch(/^prn_[a-f0-9]{32}$/);
    expect(callerKeys.join('')).not.toContain(token.bearerToken);
  });

  it('should issue an MCP session id when an authenticated client initializes', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const app = createMcpRoutes({
      getSteering: async () => '# OS steering',
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'initialize-session',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'session-test', version: '1.0.0' },
      },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-initialize-session',
    });

    const response = await app.request(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toMatch(
      /^[a-zA-Z0-9._~-]{8,128}$/,
    );
  });

  it('should serve the two OS facade tools through the signed MCP endpoint', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-server-tools-list',
    });
    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(JSON.stringify(json)).toContain('get_steering');
    expect(JSON.stringify(json)).toContain('call');
    expect(JSON.stringify(json)).not.toContain(token.secret);
  });

  it('should deny nested facade calls when the signed credential lacks the tool scope', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'call', arguments: { tool: 'explore', input: { query: 'status' } } },
    });
    const signed = signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/mcp',
      body,
      timestamp: new Date().toISOString(),
      nonce: 'nonce-server-missing-scope',
    });
    const response = await handleRequest(new Request('http://127.0.0.1:46321/mcp', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(403);
    expect(json).toMatchObject({ error: { code: 'MISSING_SCOPE' } });
    expect(JSON.stringify(json)).not.toContain(token.secret);
  });
});
