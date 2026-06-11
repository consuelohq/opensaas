import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type ProvisionAgent = {
  name: string;
  path: string;
};

type ProvisionResult = {
  home: string;
  configPath: string;
  dbPath: string;
  agents: ProvisionAgent[];
  actions: Array<{ type: string; path: string; status: string; message: string }>;
};

type InstallStateContract = {
  provisionLocalOs: (options?: Record<string, unknown>) => ProvisionResult;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadInstallStateContract(): Promise<InstallStateContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'install-state.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<InstallStateContract>;

  if (typeof module.provisionLocalOs !== 'function') {
    throw new Error('install-state contract module is missing export: provisionLocalOs');
  }

  return module as InstallStateContract;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

contractDescribe('installed OS workspace bootstrap contract', () => {
  it('should provision installed security config with the approved workspace identity instead of local placeholders', async () => {
    const { provisionLocalOs } = await loadInstallStateContract();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-workspace-bootstrap-'));

    const result = provisionLocalOs({
      home,
      mode: 'local',
      port: 8999,
      workspaceBootstrap: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        connectorId: 'connector_123',
        connectorTransport: 'cloudflare-tunnel',
      },
    });

    const config = readJson<Record<string, unknown>>(result.configPath);
    const generatedAuthPath = join(home, 'security', 'generated', 'auth.json');
    const auth = readJson<Record<string, unknown>>(generatedAuthPath);

    expect(config.workspace).toMatchObject({
      id: 'workspace_123',
      slug: 'kokayi',
      host: 'kokayi.consuelohq.com',
    });
    expect(config.connector).toMatchObject({
      id: 'connector_123',
      transport: 'cloudflare-tunnel',
      status: 'configured',
    });
    expect(config.security).toMatchObject({
      gateway: expect.objectContaining({
        workspaceHost: 'kokayi.consuelohq.com',
      }),
    });
    expect(auth).toMatchObject({
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      workspaceHost: 'kokayi.consuelohq.com',
    });
    expect(JSON.stringify(config)).not.toMatch(/local-consuelo-os|local\.consuelohq\.com/);
    expect(JSON.stringify(auth)).not.toMatch(/local-consuelo-os|local\.consuelohq\.com/);
  });

  it('should keep connector bootstrap secrets out of config, auth, and Caddy files', async () => {
    const { provisionLocalOs } = await loadInstallStateContract();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-workspace-bootstrap-secrets-'));

    const result = provisionLocalOs({
      home,
      mode: 'local',
      workspaceBootstrap: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        connectorId: 'connector_123',
        connectorTransport: 'cloudflare-tunnel',
        connectorBootstrapToken: 'installer_bootstrap_token_fixture',
        cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
      },
    });

    const config = fs.readFileSync(result.configPath, 'utf8');
    const auth = fs.readFileSync(join(home, 'security', 'generated', 'auth.json'), 'utf8');
    const caddyfile = fs.readFileSync(join(home, 'security', 'generated', 'Caddyfile'), 'utf8');

    for (const content of [config, auth, caddyfile]) {
      expect(content).not.toContain('installer_bootstrap_token_fixture');
      expect(content).not.toContain('cloudflared_tunnel_token_fixture');
    }
  });

  it('should plan a cloudflared launchd service and gateway auth smoke command when connector bootstrap is present', async () => {
    const { provisionLocalOs } = await loadInstallStateContract();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-workspace-bootstrap-launchd-'));

    const result = provisionLocalOs({
      home,
      mode: 'local',
      workspaceBootstrap: {
        workspaceId: 'workspace_123',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        connectorId: 'connector_123',
        connectorTransport: 'cloudflare-tunnel',
        cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
      },
    });

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create_file',
          path: expect.stringContaining('com.consuelo.os.cloudflared.plist'),
          message: expect.stringMatching(/cloudflared/i),
        }),
        expect.objectContaining({
          type: 'create_file',
          path: expect.stringContaining('smoke-gateway-auth'),
          message: expect.stringMatching(/gateway auth smoke/i),
        }),
      ]),
    );
  });
});
