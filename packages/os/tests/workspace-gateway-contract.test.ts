import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

type GatewayModule = {
  createGatewaySecurityConfig: (input: {
    home: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    upstreamPort?: number;
  }) => {
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    generatedAuthPath: string;
    publicRoutes: string[];
  };
  createPublicRouteRegistry: (input: {
    workspaceId: string;
    workspaceSlug: string;
    upstream: { host: string; port: number };
  }) => {
    workspaceId: string;
    workspaceHost: string;
    routes: Array<{
      path: string;
      upstream: { host: string; port: number };
      auth: 'required';
      workspaceId: string;
      edgeProvider?: string;
      connectorMode?: string;
    }>;
    edgeProvider?: string;
    connectorMode?: string;
    resolve: (input: { host: string; path: string; workspaceId: string }) => {
      route: string;
      upstream: { host: string; port: number };
      auth?: 'required';
      connectorMode?: string;
    };
  };
  createOutboundConnectorConfig: (input: {
    config?: { workspaceId: string; workspaceSlug: string; workspaceHost: string; generatedAuthPath: string; publicRoutes: string[] };
    workspaceId?: string;
    strategy: string;
  }) => {
    mode: 'outbound';
    workspaceId: string;
    strategy: string;
    listeners: Array<{ host: string; port: number }>;
    requires: string[];
    audit: { enabled: boolean; eventName: string };
    cloudflare?: { managedHostname: string; publicRoutes: string[] };
  };
  renderCaddyGatewayConfig: (input: {
    workspaceHost: string;
    upstream: { host: string; port: number };
    mtls?: { enabled: boolean; caFile: string };
  }) => string;
};

type JsonObject = Record<string, unknown>;

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;
let tempHomes: string[] = [];

async function loadGatewayModule(): Promise<GatewayModule> {
  const modulePath = pathToFileURL(join(process.cwd(), 'scripts', 'lib', 'security-gateway.ts')).href;
  return await import(modulePath) as GatewayModule;
}

function createTempHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-os-workspace-gateway-contract-'));
  tempHomes.push(home);
  return home;
}

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

afterEach(() => {
  for (const home of tempHomes) {
    rmSync(home, { force: true, recursive: true });
  }
  tempHomes = [];
});

contractDescribe('Consuelo OS workspace gateway contract', () => {
  it('should persist Cloudflare-managed workspace gateway metadata when generated auth is provisioned', async () => {
    const gateway = await loadGatewayModule();
    const home = createTempHome();

    const config = gateway.createGatewaySecurityConfig({
      home,
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
      upstreamPort: 8850,
    });
    const authConfig = readJson(config.generatedAuthPath);

    expect(config).toMatchObject({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
      publicRoutes: ['/office', '/diffs', '/wiki', '/traces', '/tools', '/api', '/mcp', '/apps/chatgpt'],
    });
    expect(authConfig).toMatchObject({
      kind: 'consuelo-generated',
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      workspaceHost: 'acme.consuelohq.com',
      publicGateway: {
        provider: 'cloudflare',
        routeMode: 'workspace-subdomain',
        connectorMode: 'outbound-os-connector',
        hostname: 'acme.consuelohq.com',
        upstream: { host: '127.0.0.1', port: 8850 },
      },
    });
  });

  it('should expose only approved Cloudflare workspace routes through the OS public route registry', async () => {
    const gateway = await loadGatewayModule();
    const registry = gateway.createPublicRouteRegistry({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      upstream: { host: '127.0.0.1', port: 8850 },
    });

    expect(registry).toMatchObject({
      workspaceId: 'workspace-acme',
      workspaceHost: 'acme.consuelohq.com',
      edgeProvider: 'cloudflare',
      connectorMode: 'outbound-os-connector',
    });
    expect(registry.routes.map((route) => route.path).sort()).toEqual([
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
        auth: 'required',
        workspaceId: 'workspace-acme',
        upstream: { host: '127.0.0.1', port: 8850 },
        edgeProvider: 'cloudflare',
        connectorMode: 'outbound-os-connector',
      });
    }
  });

  it('should fail closed for unknown hosts, unknown paths, and non-private upstreams', async () => {
    const gateway = await loadGatewayModule();
    const registry = gateway.createPublicRouteRegistry({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      upstream: { host: '127.0.0.1', port: 8850 },
    });

    expect(() => registry.resolve({
      host: 'other.consuelohq.com',
      path: '/mcp',
      workspaceId: 'workspace-acme',
    })).toThrow(/workspace|tenant|host/i);
    expect(() => registry.resolve({
      host: 'acme.consuelohq.com',
      path: '/admin/private',
      workspaceId: 'workspace-acme',
    })).toThrow(/route|not found/i);
    expect(() => gateway.createPublicRouteRegistry({
      workspaceId: 'workspace-acme',
      workspaceSlug: 'acme',
      upstream: { host: '0.0.0.0', port: 8850 },
    })).toThrow(/private|localhost/i);
  });

  it('should describe an outbound Cloudflare connector without opening public listeners', async () => {
    const gateway = await loadGatewayModule();
    const home = createTempHome();
    const config = gateway.createGatewaySecurityConfig({
      home,
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
      requires: ['generated-auth', 'workspace-identity', 'cloudflare-managed-host'],
      audit: { enabled: true, eventName: 'gateway.connector.state' },
      cloudflare: {
        managedHostname: 'acme.consuelohq.com',
        publicRoutes: ['/office', '/diffs', '/wiki', '/traces', '/tools', '/api', '/mcp', '/apps/chatgpt'],
      },
    });
  });

  it('should render Cloudflare-facing Caddy config that proxies only to the private Bun server', async () => {
    const gateway = await loadGatewayModule();
    const caddyfile = gateway.renderCaddyGatewayConfig({
      workspaceHost: 'acme.consuelohq.com',
      upstream: { host: '127.0.0.1', port: 8850 },
      mtls: { enabled: true, caFile: '/Users/example/.consuelo/os/security/generated/client-ca.pem' },
    });

    expect(caddyfile).toContain('acme.consuelohq.com');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:8850');
    expect(caddyfile).toContain('request_body');
    expect(caddyfile).toContain('max_size 10MB');
    expect(caddyfile).toContain('header_up -X-Consuelo-Edge-Signature');
    expect(caddyfile).toContain('header_up -X-Consuelo-Connector-Id');
    expect(caddyfile).toContain('client_auth');
    expect(caddyfile).toContain('require_and_verify');
    expect(caddyfile).not.toContain('reverse_proxy 0.0.0.0:8850');
    expect(caddyfile).not.toContain('MCP_BEARER_TOKEN');
    expect(caddyfile).not.toContain('header_up -X-Consuelo-Signature');
  });
});
