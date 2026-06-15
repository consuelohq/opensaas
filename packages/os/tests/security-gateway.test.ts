import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type JsonObject = Record<string, unknown>;

type GatewaySecurityConfig = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  generatedAuthPath: string;
  tokenIssuer: string;
  signingKeyId: string;
  publicRoutes: string[];
};

type AgentAppToken = {
  tokenId: string;
  workspaceId: string;
  callerId: string;
  appId: string;
  scopes: string[];
  expiresAt: string;
  secret: string;
};

type SignedGatewayRequest = {
  headers: Record<string, string>;
  body: string;
  nonce: string;
  timestamp: string;
};

type VerificationResult =
  | { ok: true; caller: { workspaceId: string; callerId: string; scopes: string[] } }
  | { ok: false; status: number; error: { code: string; message: string } };

type PolicyDecision = {
  allowed: boolean;
  category: 'read' | 'write' | 'dangerous';
  requiresApproval: boolean;
  reason: string;
};

type AuditEvent = {
  event: string;
  callerId: string;
  workspaceId: string;
  toolName?: string;
  route?: string;
  decision: string;
  status: 'allowed' | 'denied';
  timestamp: string;
};

type PublicRouteRegistry = {
  workspaceId: string;
  workspaceHost: string;
  routes: Array<{
    path: string;
    upstream: { host: string; port: number };
    auth: 'required';
    workspaceId: string;
  }>;
  resolve: (input: { host: string; path: string; workspaceId: string }) => {
    route: string;
    upstream: { host: string; port: number };
  };
};

type OutboundConnectorConfig = {
  mode: 'outbound';
  workspaceId: string;
  strategy: string;
  listeners: Array<{ host: string; port: number }>;
  requires: string[];
  audit: { enabled: boolean; eventName: string };
};

type GatewayModule = {
  createGatewaySecurityConfig: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
  }) => GatewaySecurityConfig | Promise<GatewaySecurityConfig>;
  issueAgentAppToken: (input: {
    config: GatewaySecurityConfig;
    callerId: string;
    appId: string;
    scopes: string[];
    expiresInSeconds: number;
  }) => AgentAppToken | Promise<AgentAppToken>;
  rotateAgentAppToken: (input: {
    config: GatewaySecurityConfig;
    token: AgentAppToken;
  }) => AgentAppToken | Promise<AgentAppToken>;
  revokeAgentAppToken: (input: {
    config: GatewaySecurityConfig;
    tokenId: string;
  }) => Promise<void> | void;
  signMachineRequest: (input: {
    config: GatewaySecurityConfig;
    token: AgentAppToken;
    method: string;
    path: string;
    body: string;
    timestamp: string;
    nonce: string;
  }) => SignedGatewayRequest | Promise<SignedGatewayRequest>;
  verifyMachineRequest: (input: {
    config: GatewaySecurityConfig;
    method: string;
    path: string;
    body: string;
    headers: Record<string, string>;
    workspaceId: string;
    requiredScope: string;
    now: string;
  }) => VerificationResult | Promise<VerificationResult>;
  renderCaddyGatewayConfig: (input: {
    workspaceHost: string;
    upstream: { host: string; port: number };
    mtls?: { enabled: boolean; caFile: string };
  }) => string;
  createPublicRouteRegistry: (input: {
    workspaceId: string;
    workspaceSlug: string;
    upstream: { host: string; port: number };
  }) => PublicRouteRegistry;
  createOutboundConnectorConfig: (input: {
    config?: GatewaySecurityConfig;
    workspaceId?: string;
    strategy: string;
  }) => OutboundConnectorConfig;
  evaluateToolPolicy: (input: {
    token: AgentAppToken;
    toolName: string;
    category: 'read' | 'write' | 'dangerous';
    requestedScope: string;
    approvalGranted?: boolean;
  }) => PolicyDecision;
  recordGatewayAuditEvent: (input: {
    home: string;
    event: AuditEvent;
  }) => { path: string; event: AuditEvent };
};

type SubprocessHttpResult = {
  status: number;
  text: string;
  json: JsonObject | null;
};

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-security-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-user-security-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempUserHome, { recursive: true, force: true });
});

function runBunEval(code: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      CONSUELO_OS_HOME: tempHome,
      HOME: tempUserHome,
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
      CONSUELO_OS_BEARER_TOKEN: '',
      CONSUELO_OS_AUTH_CONFIG: '',
      CONSUELO_OS_GATEWAY_MODE: '',
      MCP_BEARER_TOKEN: '',
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

function readJsonFromBun<T>(code: string, extraEnv: Record<string, string> = {}): T {
  return JSON.parse(runBunEval(code, extraEnv)) as T;
}

async function loadGatewayModule(): Promise<GatewayModule> {
  const modulePath = pathToFileURL(join(process.cwd(), 'scripts', 'lib', 'security-gateway.ts')).href;
  const module = await import(modulePath) as unknown as Partial<GatewayModule>;
  const requiredExports: Array<keyof GatewayModule> = [
    'createGatewaySecurityConfig',
    'issueAgentAppToken',
    'rotateAgentAppToken',
    'revokeAgentAppToken',
    'signMachineRequest',
    'verifyMachineRequest',
    'renderCaddyGatewayConfig',
    'createPublicRouteRegistry',
    'createOutboundConnectorConfig',
    'evaluateToolPolicy',
    'recordGatewayAuditEvent',
  ];
  const missingExports = requiredExports.filter((name) => typeof module[name] !== 'function');
  if (missingExports.length > 0) {
    throw new Error(`security gateway contract module is missing exports: ${missingExports.join(', ')}`);
  }
  return module as GatewayModule;
}

function serverRequestEval(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): string {
  return `
    const { handleRequest } = await import('./scripts/server.ts');
    const response = await handleRequest(new Request('http://127.0.0.1:8850${path}', {
      method: ${JSON.stringify(init.method ?? 'GET')},
      headers: ${JSON.stringify(init.headers ?? {})},
      body: ${init.body === undefined ? 'undefined' : JSON.stringify(init.body)},
    }));
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    process.stdout.write(JSON.stringify({ status: response.status, text, json }));
  `;
}

describe('Consuelo OS public gateway security contract', () => {
  it('keeps health public while avoiding secret material in the response', () => {
    const response = readJsonFromBun<SubprocessHttpResult>(serverRequestEval('/health'));

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ status: 'ok', runtime: 'bun' });
    expect(response.text).not.toMatch(/bearer|token|secret|signing|nonce/i);
  });

  it('rejects protected routes when generated Consuelo auth is missing', () => {
    const response = readJsonFromBun<SubprocessHttpResult>(serverRequestEval('/get_steering'));

    expect([401, 403]).toContain(response.status);
    expect(response.text).toMatch(/CONSUELO_AUTH_REQUIRED|AUTH_CONFIG_REQUIRED|UNAUTHORIZED|FORBIDDEN/i);
    expect(response.text).not.toMatch(/Consuelo OS is the/i);
  });

  it('does not accept the legacy generic MCP_BEARER_TOKEN fallback', () => {
    const response = readJsonFromBun<SubprocessHttpResult>(
      serverRequestEval('/get_steering', {
        headers: { authorization: 'Bearer legacy-token' },
      }),
      { MCP_BEARER_TOKEN: 'legacy-token' },
    );

    expect([401, 403]).toContain(response.status);
    expect(response.text).toMatch(/CONSUELO_AUTH_REQUIRED|AUTH_CONFIG_REQUIRED|UNAUTHORIZED|FORBIDDEN/i);
    expect(response.text).not.toMatch(/Consuelo OS is the/i);
  });

  it('installs generated Consuelo-specific security config into the final OS root', () => {
    readJsonFromBun<JsonObject>(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `);

    const generatedAuthPath = join(tempHome, 'security', 'generated', 'auth.json');
    const generatedCaddyPath = join(tempHome, 'security', 'generated', 'Caddyfile');
    const overridesPath = join(tempHome, 'security', 'overrides');
    const configPath = join(tempHome, 'config.json');

    expect(existsSync(join(tempHome, 'security'))).toBe(true);
    expect(existsSync(join(tempHome, 'security', 'generated'))).toBe(true);
    expect(existsSync(overridesPath)).toBe(true);
    expect(existsSync(generatedAuthPath)).toBe(true);
    expect(existsSync(generatedCaddyPath)).toBe(true);

    const authMode = statSync(generatedAuthPath).mode & 0o777;
    expect(authMode).toBe(0o600);

    const config = JSON.parse(readFileSync(configPath, 'utf8')) as JsonObject;
    expect(config).toMatchObject({
      security: {
        auth: {
          kind: 'consuelo-generated',
          status: 'configured',
        },
      },
    });
    expect(readFileSync(generatedAuthPath, 'utf8')).not.toContain('MCP_BEARER_TOKEN');
    expect(readFileSync(generatedCaddyPath, 'utf8')).toContain('127.0.0.1:8960');
    expect(readFileSync(generatedCaddyPath, 'utf8')).not.toContain('0.0.0.0:8960');
    expect(existsSync(join(tempHome, 'source'))).toBe(false);
  });

  it('blocks public or tunnel mode unless generated auth and workspace identity exist', async () => {
    const gateway = await loadGatewayModule();

    expect(() => gateway.createOutboundConnectorConfig({ strategy: 'cloudflare-tunnel' })).toThrow(/auth|workspace/i);

    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const connector = gateway.createOutboundConnectorConfig({
      config,
      workspaceId: 'workspace-acme',
      strategy: 'cloudflare-tunnel',
    });

    expect(connector).toMatchObject({
      mode: 'outbound',
      workspaceId: 'workspace-acme',
      strategy: 'cloudflare-tunnel',
      listeners: [],
      audit: { enabled: true, eventName: 'gateway.connector.state' },
    });
    expect(connector.requires).toEqual(expect.arrayContaining(['generated-auth', 'workspace-identity']));
  });

  it('verifies signed machine requests and rejects replay, stale timestamps, tampered bodies, and tenant mismatch', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const token = await gateway.issueAgentAppToken({
      config,
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['route:/api:read', 'tool:status:read'],
      expiresInSeconds: 300,
    });
    const body = JSON.stringify({ name: 'status', input: {} });
    const signed = await gateway.signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/api/tools/status',
      body,
      timestamp: '2026-06-09T20:00:00.000Z',
      nonce: 'nonce-status-read-1',
    });

    const first = await gateway.verifyMachineRequest({
      config,
      method: 'POST',
      path: '/api/tools/status',
      body,
      headers: signed.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'tool:status:read',
      now: '2026-06-09T20:00:03.000Z',
    });
    expect(first).toMatchObject({ ok: true, caller: { workspaceId: 'workspace-acme', callerId: 'chatgpt-app-1' } });

    const replay = await gateway.verifyMachineRequest({
      config,
      method: 'POST',
      path: '/api/tools/status',
      body,
      headers: signed.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'tool:status:read',
      now: '2026-06-09T20:00:04.000Z',
    });
    expect(replay).toMatchObject({ ok: false, status: 401, error: { code: 'REPLAYED_NONCE' } });

    const expiredSigned = await gateway.signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/api/tools/status',
      body,
      timestamp: '2026-06-09T19:49:00.000Z',
      nonce: 'nonce-status-read-expired',
    });
    const expired = await gateway.verifyMachineRequest({
      config,
      method: 'POST',
      path: '/api/tools/status',
      body,
      headers: expiredSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'tool:status:read',
      now: '2026-06-09T20:00:01.000Z',
    });
    expect(expired).toMatchObject({ ok: false, status: 401, error: { code: 'EXPIRED_TIMESTAMP' } });

    const tamperSigned = await gateway.signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/api/tools/status',
      body,
      timestamp: '2026-06-09T20:00:05.000Z',
      nonce: 'nonce-status-read-tampered',
    });
    const tampered = await gateway.verifyMachineRequest({
      config,
      method: 'POST',
      path: '/api/tools/status',
      body: JSON.stringify({ name: 'fs.write', input: {} }),
      headers: tamperSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'tool:status:read',
      now: '2026-06-09T20:00:06.000Z',
    });
    expect(tampered).toMatchObject({ ok: false, status: 401, error: { code: 'BAD_SIGNATURE' } });

    const wrongWorkspaceSigned = await gateway.signMachineRequest({
      config,
      token,
      method: 'POST',
      path: '/api/tools/status',
      body,
      timestamp: '2026-06-09T20:00:07.000Z',
      nonce: 'nonce-status-read-workspace-mismatch',
    });
    const wrongWorkspace = await gateway.verifyMachineRequest({
      config,
      method: 'POST',
      path: '/api/tools/status',
      body,
      headers: wrongWorkspaceSigned.headers,
      workspaceId: 'workspace-other',
      requiredScope: 'tool:status:read',
      now: '2026-06-09T20:00:08.000Z',
    });
    expect(wrongWorkspace).toMatchObject({ ok: false, status: 403, error: { code: 'WORKSPACE_MISMATCH' } });
    expect(JSON.stringify([replay, expired, tampered, wrongWorkspace])).not.toContain(token.secret);
  });

  it('rotates and revokes scoped app tokens without preserving old credentials', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const originalToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
      expiresInSeconds: 300,
    });
    const oldSigned = await gateway.signMachineRequest({
      config,
      token: originalToken,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp: '2026-06-09T20:00:00.000Z',
      nonce: 'old-token-nonce',
    });
    const rotatedToken = await gateway.rotateAgentAppToken({ config, token: originalToken });

    expect(rotatedToken.tokenId).not.toBe(originalToken.tokenId);
    expect(rotatedToken.secret).not.toBe(originalToken.secret);
    expect(rotatedToken).toMatchObject({
      workspaceId: 'workspace-acme',
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
    });

    const oldVerify = await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: oldSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:01.000Z',
    });
    expect(oldVerify).toMatchObject({ ok: false, status: 401, error: { code: 'TOKEN_ROTATED' } });

    const revokedSigned = await gateway.signMachineRequest({
      config,
      token: rotatedToken,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp: '2026-06-09T20:00:02.000Z',
      nonce: 'revoked-token-nonce',
    });
    await gateway.revokeAgentAppToken({ config, tokenId: rotatedToken.tokenId });
    const revokedVerify = await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: revokedSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:03.000Z',
    });
    expect(revokedVerify).toMatchObject({ ok: false, status: 401, error: { code: 'TOKEN_REVOKED' } });
  });

  it('enforces read, write, and dangerous tool policy splits and records safe audit events', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const readOnlyToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['tool:status:read', 'route:/api:read'],
      expiresInSeconds: 300,
    });
    const writeToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'agent-writer-1',
      appId: 'worker',
      scopes: ['tool:fs.write:write', 'route:/api:write'],
      expiresInSeconds: 300,
    });

    expect(gateway.evaluateToolPolicy({
      token: readOnlyToken,
      toolName: 'status',
      category: 'read',
      requestedScope: 'tool:status:read',
    })).toMatchObject({ allowed: true, category: 'read', requiresApproval: false });

    expect(gateway.evaluateToolPolicy({
      token: readOnlyToken,
      toolName: 'fs.write',
      category: 'write',
      requestedScope: 'tool:fs.write:write',
    })).toMatchObject({ allowed: false, category: 'write', requiresApproval: false });

    expect(gateway.evaluateToolPolicy({
      token: writeToken,
      toolName: 'task.merge',
      category: 'dangerous',
      requestedScope: 'tool:task.merge:dangerous',
    })).toMatchObject({ allowed: false, category: 'dangerous', requiresApproval: true });

    const audit = gateway.recordGatewayAuditEvent({
      home: tempHome,
      event: {
        event: 'gateway.tool.denied',
        callerId: 'chatgpt-app-1',
        workspaceId: 'workspace-acme',
        toolName: 'fs.write',
        decision: 'missing_scope',
        status: 'denied',
        timestamp: '2026-06-09T20:00:00.000Z',
      },
    });
    const auditLog = readFileSync(audit.path, 'utf8');
    expect(auditLog).toContain('gateway.tool.denied');
    expect(auditLog).toContain('chatgpt-app-1');
    expect(auditLog).toContain('workspace-acme');
    expect(auditLog).not.toContain(readOnlyToken.secret);
  });

  it('renders deterministic Caddy config that proxies only to the private Bun server', async () => {
    const gateway = await loadGatewayModule();
    const input = {
      workspaceHost: 'acme.consuelohq.com',
      upstream: { host: '127.0.0.1', port: 8850 },
      mtls: { enabled: true, caFile: '/Users/example/.consuelo/os/security/generated/client-ca.pem' },
    };
    const caddyfile = gateway.renderCaddyGatewayConfig(input);

    expect(gateway.renderCaddyGatewayConfig(input)).toBe(caddyfile);
    expect(caddyfile).toContain('acme.consuelohq.com');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:8850');
    expect(caddyfile).toContain('request_body');
    expect(caddyfile).toContain('max_size 10MB');
    expect(caddyfile).toContain('dial_timeout 5s');
    expect(caddyfile).toContain('response_header_timeout 30s');
    expect(caddyfile).toContain('header_up -X-Consuelo-Edge-Signature');
    expect(caddyfile).toContain('header_up -X-Consuelo-Connector-Id');
    expect(caddyfile).toContain('log {');
    expect(caddyfile).toContain('client_auth');
    expect(caddyfile).toContain('require_and_verify');
    expect(caddyfile).not.toContain('reverse_proxy 0.0.0.0:8850');
    expect(caddyfile).not.toContain('reverse_proxy :8850');
    expect(caddyfile).not.toContain('MCP_BEARER_TOKEN');
    expect(caddyfile).not.toContain('header_up -X-Consuelo-Signature');
    expect(caddyfile).not.toContain('header_up -X-Consuelo-Token-Id');
  });

  it('routes public workspace URLs by workspace identity and fails closed for unknown tenants or paths', async () => {
    const gateway = await loadGatewayModule();
    const registry = gateway.createPublicRouteRegistry({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      upstream: { host: '127.0.0.1', port: 8850 },
    });
    const routePaths = registry.routes.map((route) => route.path).sort();

    expect(registry).toMatchObject({
      workspaceId: 'workspace-acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    expect(routePaths).toEqual([
      '/api',
      '/apps/chatgpt',
      '/diffs',
      '/mcp',
      '/office',
      '/tools',
      '/traces',
      '/wiki',
    ]);
    for (const route of registry.routes) {
      expect(route).toMatchObject({
        upstream: { host: '127.0.0.1', port: 8850 },
        auth: 'required',
        workspaceId: 'workspace-acme',
      });
    }
    expect(registry.resolve({
      host: 'acme.consuelohq.com',
      path: '/office',
      workspaceId: 'workspace-acme',
    })).toMatchObject({ route: '/office', upstream: { host: '127.0.0.1', port: 8850 } });
    expect(() => registry.resolve({
      host: 'other.consuelohq.com',
      path: '/office',
      workspaceId: 'workspace-acme',
    })).toThrow(/workspace|tenant|host/i);
    expect(() => registry.resolve({
      host: 'acme.consuelohq.com',
      path: '/admin/private',
      workspaceId: 'workspace-acme',
    })).toThrow(/route|not found/i);
  });


  it('authorizes protected /call requests with generated signed scoped app tokens only', () => {
    const authPath = join(tempHome, 'security', 'generated', 'auth.json');
    const body = JSON.stringify({ name: 'get_raw_steering' });
    const result = readJsonFromBun<JsonObject>(`
      const { createGatewaySecurityConfig, issueAgentAppToken, signMachineRequest } = await import('./scripts/lib/security-gateway.ts');
      const home = process.env.CONSUELO_OS_HOME;
      const config = createGatewaySecurityConfig({
        home,
        workspaceId: 'workspace-acme',
        workspaceSlug: 'acme',
        workspaceHost: 'acme.consuelohq.com',
      });
      const token = issueAgentAppToken({
        config,
        callerId: 'chatgpt-app-1',
        appId: 'chatgpt',
        scopes: ['tool:get_raw_steering:read'],
        expiresInSeconds: 300,
      });
      const body = ${JSON.stringify(body)};
      const signed = signMachineRequest({
        config,
        token,
        method: 'POST',
        path: '/call',
        body,
        timestamp: new Date().toISOString(),
        nonce: 'server-call-signed-nonce',
      });
      const { handleRequest } = await import('./scripts/server.ts');
      async function request(init) {
        const response = await handleRequest(new Request('http://127.0.0.1:8850/call', {
          method: 'POST',
          headers: init.headers,
          body: init.body,
        }));
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        return { status: response.status, text, json };
      }
      const allowed = await request({ headers: signed.headers, body });
      const staticOnly = await request({
        headers: { authorization: 'Bearer static-token' },
        body,
      });
      const missingScopeToken = issueAgentAppToken({
        config,
        callerId: 'chatgpt-app-2',
        appId: 'chatgpt',
        scopes: ['tool:other:read'],
        expiresInSeconds: 300,
      });
      const missingScopeSigned = signMachineRequest({
        config,
        token: missingScopeToken,
        method: 'POST',
        path: '/call',
        body,
        timestamp: new Date().toISOString(),
        nonce: 'server-call-missing-scope-nonce',
      });
      const missingScope = await request({ headers: missingScopeSigned.headers, body });
      const tamperSigned = signMachineRequest({
        config,
        token,
        method: 'POST',
        path: '/call',
        body,
        timestamp: new Date().toISOString(),
        nonce: 'server-call-tampered-nonce',
      });
      const tampered = await request({
        headers: tamperSigned.headers,
        body: JSON.stringify({ name: 'daily-revenue-brief' }),
      });
      process.stdout.write(JSON.stringify({ allowed, staticOnly, missingScope, tampered }));
    `, {
      CONSUELO_OS_AUTH_CONFIG: authPath,
      CONSUELO_OS_BEARER_TOKEN: 'static-token',
    });

    expect(result.allowed).toMatchObject({ status: 200, json: { ok: true, name: 'get_raw_steering' } });
    expect(result.staticOnly).toMatchObject({ status: 401, json: { error: { code: 'MISSING_SIGNATURE' } } });
    expect(result.missingScope).toMatchObject({ status: 403, json: { error: { code: 'MISSING_SCOPE' } } });
    expect(result.tampered).toMatchObject({ status: 401, json: { error: { code: 'BAD_SIGNATURE' } } });
    expect(JSON.stringify(result)).not.toContain('static-token');
  });

  it('rejects expired app tokens without consuming their nonce or leaking secrets', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const token = await gateway.issueAgentAppToken({
      config,
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
      expiresInSeconds: -60,
    });
    const timestamp = new Date().toISOString();
    const nonce = 'expired-token-fresh-request-nonce';
    const signed = await gateway.signMachineRequest({
      config,
      token,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp,
      nonce,
    });
    const expired = await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: signed.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: timestamp,
    });
    const stored = JSON.parse(readFileSync(config.generatedAuthPath, 'utf8')) as { seenNonces?: Record<string, string> };

    expect(expired).toMatchObject({ ok: false, status: 401, error: { code: 'TOKEN_EXPIRED' } });
    expect(stored.seenNonces?.[nonce]).toBeUndefined();
    expect(JSON.stringify(expired)).not.toContain(token.secret);
  });

  it('preserves generated auth state across repeated provisioning', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const activeToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'active-agent',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
      expiresInSeconds: 300,
    });
    const activeSigned = await gateway.signMachineRequest({
      config,
      token: activeToken,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp: '2026-06-09T20:00:00.000Z',
      nonce: 'idempotent-active-nonce',
    });
    await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: activeSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:01.000Z',
    });
    const revokedToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'revoked-agent',
      appId: 'worker',
      scopes: ['route:/api:read'],
      expiresInSeconds: 300,
    });
    const revokedSigned = await gateway.signMachineRequest({
      config,
      token: revokedToken,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp: '2026-06-09T20:00:02.000Z',
      nonce: 'idempotent-revoked-nonce',
    });
    await gateway.revokeAgentAppToken({ config, tokenId: revokedToken.tokenId });
    const rotatedToken = await gateway.issueAgentAppToken({
      config,
      callerId: 'rotated-agent',
      appId: 'worker',
      scopes: ['route:/api:read'],
      expiresInSeconds: 300,
    });
    const rotatedSigned = await gateway.signMachineRequest({
      config,
      token: rotatedToken,
      method: 'GET',
      path: '/api/status',
      body: '',
      timestamp: '2026-06-09T20:00:03.000Z',
      nonce: 'idempotent-rotated-nonce',
    });
    await gateway.rotateAgentAppToken({ config, token: rotatedToken });
    const before = JSON.parse(readFileSync(config.generatedAuthPath, 'utf8')) as { signingKeyId: string };

    const reprovisioned = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
    });
    const after = JSON.parse(readFileSync(config.generatedAuthPath, 'utf8')) as { signingKeyId: string; tokens: Record<string, { status: string }>; seenNonces: Record<string, string> };

    expect(reprovisioned.signingKeyId).toBe(before.signingKeyId);
    expect(after.signingKeyId).toBe(before.signingKeyId);
    expect(after.seenNonces['idempotent-active-nonce']).toMatchObject({ tokenId: activeToken.tokenId });
    expect(after.tokens[revokedToken.tokenId]?.status).toBe('revoked');
    expect(after.tokens[rotatedToken.tokenId]?.status).toBe('rotated');
    expect(gateway.verifyMachineRequest({
      config: reprovisioned,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: activeSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:04.000Z',
    })).toMatchObject({ ok: false, status: 401, error: { code: 'REPLAYED_NONCE' } });
    expect(gateway.verifyMachineRequest({
      config: reprovisioned,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: revokedSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:05.000Z',
    })).toMatchObject({ ok: false, status: 401, error: { code: 'TOKEN_REVOKED' } });
    expect(gateway.verifyMachineRequest({
      config: reprovisioned,
      method: 'GET',
      path: '/api/status',
      body: '',
      headers: rotatedSigned.headers,
      workspaceId: 'workspace-acme',
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:06.000Z',
    })).toMatchObject({ ok: false, status: 401, error: { code: 'TOKEN_ROTATED' } });
  });

  it('uses the resolved OS port in generated Caddy config', () => {
    readJsonFromBun<JsonObject>(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', port: 8999 });
      process.stdout.write(JSON.stringify(result));
    `);

    const caddyfile = readFileSync(join(tempHome, 'security', 'generated', 'Caddyfile'), 'utf8');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:8999');
    expect(caddyfile).not.toContain('reverse_proxy 127.0.0.1:8850');
  });

  it('discovers generated auth from the installed OS home when explicit auth env is unset', () => {
    const body = JSON.stringify({ name: 'get_raw_steering' });
    const result = readJsonFromBun<JsonObject>(`
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const { issueAgentAppToken, signMachineRequest } = await import('./scripts/lib/security-gateway.ts');
      const home = process.env.CONSUELO_OS_HOME;
      provisionLocalOs({ mode: 'local' });
      const installedConfig = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'));
      const config = installedConfig.security.auth.path;
      const gatewayConfig = {
        workspaceId: 'local-consuelo-os',
        workspaceSlug: 'local',
        workspaceHost: 'local.consuelohq.com',
        generatedAuthPath: config,
        tokenIssuer: 'consuelo-os-gateway',
        signingKeyId: installedConfig.security.auth.signingKeyId,
        publicRoutes: installedConfig.security.gateway.publicRoutes,
      };
      const token = issueAgentAppToken({
        config: gatewayConfig,
        callerId: 'chatgpt-app-1',
        appId: 'chatgpt',
        scopes: ['tool:get_raw_steering:read'],
        expiresInSeconds: 300,
      });
      const body = ${JSON.stringify(body)};
      const signed = signMachineRequest({
        config: gatewayConfig,
        token,
        method: 'POST',
        path: '/call',
        body,
        timestamp: new Date().toISOString(),
        nonce: 'default-installed-home-auth-nonce',
      });
      delete process.env.CONSUELO_OS_AUTH_CONFIG;
      process.env.CONSUELO_HOME = home;
      process.env.CONSUELO_OS_HOME = home;
      const { handleRequest } = await import('./scripts/server.ts');
      const response = await handleRequest(new Request('http://127.0.0.1:8850/call', {
        method: 'POST',
        headers: signed.headers,
        body,
      }));
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      process.stdout.write(JSON.stringify({
        status: response.status,
        text,
        json,
        leakedTokenSecret: text.includes(token.secret),
        leakedNonce: text.includes('default-installed-home-auth-nonce'),
      }));
    `);

    expect(result).toMatchObject({
      status: 200,
      json: { ok: true, name: 'get_raw_steering' },
      leakedTokenSecret: false,
      leakedNonce: false,
    });
  });

  it('reports missing generated gateway artifacts in doctor checks', () => {
    const result = readJsonFromBun<JsonObject>(`
      const { rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { provisionLocalOs, runDoctor } = await import('./scripts/lib/install-state.ts');
      const home = process.env.CONSUELO_OS_HOME;
      provisionLocalOs({ mode: 'local' });
      rmSync(join(home, 'security', 'generated', 'auth.json'), { force: true });
      rmSync(join(home, 'security', 'generated', 'Caddyfile'), { force: true });
      const result = await runDoctor(home);
      const checks = result.checks.filter((check) => check.message.includes('security/generated'));
      process.stdout.write(JSON.stringify({ ok: result.ok, checks }));
    `);

    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).toContain('security/generated/auth.json');
    expect(JSON.stringify(result)).toContain('security/generated/Caddyfile');
    expect(JSON.stringify(result)).toContain('unhealthy');
  });

  it('timestamps and prunes replay nonces outside the verification window', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace_nonce_prune',
      workspaceSlug: 'nonce-prune',
      workspaceHost: 'nonce-prune.consuelohq.com',
    });
    const token = await gateway.issueAgentAppToken({
      config,
      callerId: 'chatgpt-app-1',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
      expiresInSeconds: 3600,
    });

    const oldSigned = await gateway.signMachineRequest({
      config,
      token,
      method: 'GET',
      path: '/api',
      body: '',
      timestamp: '2026-06-09T20:00:00.000Z',
      nonce: 'old-pruned-nonce',
    });
    expect(await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api',
      body: '',
      headers: oldSigned.headers,
      workspaceId: config.workspaceId,
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:00:00.000Z',
    })).toMatchObject({ ok: true });

    const freshSigned = await gateway.signMachineRequest({
      config,
      token,
      method: 'GET',
      path: '/api',
      body: '',
      timestamp: '2026-06-09T20:06:00.000Z',
      nonce: 'fresh-kept-nonce',
    });
    expect(await gateway.verifyMachineRequest({
      config,
      method: 'GET',
      path: '/api',
      body: '',
      headers: freshSigned.headers,
      workspaceId: config.workspaceId,
      requiredScope: 'route:/api:read',
      now: '2026-06-09T20:06:00.000Z',
    })).toMatchObject({ ok: true });

    const stored = JSON.parse(readFileSync(config.generatedAuthPath, 'utf8')) as {
      seenNonces: Record<string, unknown>;
    };
    expect(stored.seenNonces['old-pruned-nonce']).toBeUndefined();
    expect(stored.seenNonces['fresh-kept-nonce']).toMatchObject({
      tokenId: token.tokenId,
      seenAt: '2026-06-09T20:06:00.000Z',
    });
  });

  it('rotates tokens from persisted claims and rejects unknown source tokens', async () => {
    const gateway = await loadGatewayModule();
    const config = await gateway.createGatewaySecurityConfig({
      home: tempHome,
      workspaceId: 'workspace_rotate_persisted',
      workspaceSlug: 'rotate-persisted',
      workspaceHost: 'rotate-persisted.consuelohq.com',
    });
    const token = await gateway.issueAgentAppToken({
      config,
      callerId: 'trusted-caller',
      appId: 'chatgpt',
      scopes: ['route:/api:read'],
      expiresInSeconds: 3600,
    });

    const forgedInput = {
      ...token,
      callerId: 'attacker-caller',
      appId: 'attacker-app',
      scopes: ['tool:task.push:dangerous'],
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
    const rotated = await gateway.rotateAgentAppToken({ config, token: forgedInput });
    expect(rotated).toMatchObject({
      workspaceId: token.workspaceId,
      callerId: token.callerId,
      appId: token.appId,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
    });
    expect(rotated.secret).not.toBe(token.secret);
    expect(() => gateway.rotateAgentAppToken({
      config,
      token: { ...token, tokenId: 'tok_missing_source' },
    })).toThrow(/not recognized/i);
  });

  it('fails closed on malformed unauthenticated /call bodies before JSON parsing', () => {
    const response = readJsonFromBun<SubprocessHttpResult>(serverRequestEval('/call', {
      method: 'POST',
      body: '{',
    }));

    expect(response.status).toBe(401);
    expect(response.text).toMatch(/CONSUELO_AUTH_REQUIRED|MISSING_SIGNATURE|AUTH_CONFIG_REQUIRED/i);
    expect(response.text).not.toMatch(/INVALID_REQUEST/i);
  });
});


