import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGatewaySecurityConfig,
  getAgentAppCredentialStatus,
  issueAgentAppToken,
  listAgentAppCredentialStatuses,
  signMachineRequest,
  verifyMachineRequest,
  type AgentAppToken,
  type GatewaySecurityConfig,
} from '../scripts/lib/security-gateway';
import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../scripts/lib/mcp-gateway';
import { handleRequest } from '../scripts/server.ts';
import { removeSafeTempDir } from './safe-temp-cleanup';

type JsonObject = Record<string, unknown>;

let tempHome = '';

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

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-mcp-gateway-'));
  process.env.CONSUELO_OS_HOME = tempHome;
  process.env.CONSUELO_HOME = tempHome;
  process.env.CONSUELO_OS_AUTH_CONFIG = join(tempHome, 'security', 'generated', 'auth.json');
});

afterEach(() => {
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  if (tempHome) removeSafeTempDir(tempHome, 'consuelo-os-mcp-gateway-');
  tempHome = '';
});

describe('MCP gateway credential lifecycle', () => {
  it('stores scoped credential metadata without raw credential material', () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:get_raw_steering:read']);
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
        upstream: { host: '127.0.0.1', port: 8960 },
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
  it('resolves manifest-backed scopes and fails closed for unknown tools', () => {
    const listScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    }));
    const callScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'get_raw_steering', arguments: {} },
    }));
    const unknownScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'missing_tool', arguments: {} },
    }));

    expect(listScope).toMatchObject({ ok: true, requiredScope: 'route:/mcp:read' });
    expect(callScope).toMatchObject({
      ok: true,
      toolName: 'get_raw_steering',
      requiredScope: 'tool:get_raw_steering:read',
    });
    expect(unknownScope).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNKNOWN_TOOL_SCOPE' },
    });
  });

  it('accepts bearer-only MCP requests and lets the gateway handle internal auth', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read', 'tool:*:read']);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });

    const response = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
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
    const denied = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${missingScopeToken.bearerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call',
        method: 'tools/call',
        params: { name: 'get_raw_steering', arguments: {} },
      }),
    }));
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: 'MISSING_SCOPE' },
    });
  });


  it('advertises OAuth discovery when MCP auth is missing and accepts active Consuelo OAuth tokens', async () => {
    const config = createConfig();
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' });

    const missing = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-consuelo-hostname': config.workspaceHost },
      body,
    }));
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toContain(
      `https://${config.workspaceHost}/.well-known/oauth-protected-resource`,
    );

    const fetchCalls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({ url, body: String(init?.body ?? '') });
      return new Response(JSON.stringify({
        active: true,
        workspace_host: config.workspaceHost,
        scopes: ['route:/mcp:read', 'tool:*:read'],
        sub: 'google:123',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const accepted = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
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
    expect(fetchCalls[0].body).toContain('resource=https%3A%2F%2Fmcp-test.consuelohq.com%2Fmcp');
  });

  it('filters non-callable facade tools out of the MCP surface', async () => {
    const listResponse = await handleMcpGatewayJsonRpc(JSON.stringify({
      jsonrpc: '2.0',
      id: 'tools',
      method: 'tools/list',
    }), {
      executeCall: async () => ({
        ok: false,
        name: 'unused',
        permission: 'read',
        error: { code: 'UNUSED', message: 'unused' },
      }),
    });
    const facadeToolScope = resolveMcpGatewayRequiredScope(JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'code.call', arguments: {} },
    }));

    expect(JSON.stringify(listResponse)).toContain('get_raw_steering');
    expect(JSON.stringify(listResponse)).not.toContain('code.call');
    expect(facadeToolScope).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNSUPPORTED_MCP_TOOL' },
    });
  });

  it('adapts tools/call output into MCP content without echoing request metadata', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'call-1',
      method: 'tools/call',
      params: { name: 'get_raw_steering', arguments: { reason: 'unit-test' } },
    });

    const response = await handleMcpGatewayJsonRpc(body, {
      executeCall: async (input) => ({
        ok: true,
        name: input.name,
        permission: 'read',
        result: { acceptedInput: input.input },
      }),
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

describe('MCP gateway server route', () => {
  it('serves tools/list through the signed /mcp compatibility endpoint', async () => {
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
    const response = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
      method: 'POST',
      headers: signed.headers,
      body,
    }));
    const json = await readJsonResponse(response);

    expect(response.status).toBe(200);
    expect(JSON.stringify(json)).toContain('get_raw_steering');
    expect(JSON.stringify(json)).not.toContain(token.secret);
  });

  it('denies tools/call when the signed credential lacks the tool scope', async () => {
    const config = createConfig();
    const token = issueMcpToken(config, ['route:/mcp:read']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'get_raw_steering', arguments: {} },
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
    const response = await handleRequest(new Request('http://127.0.0.1:8960/mcp', {
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
