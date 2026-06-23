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
        cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
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
    expect(fs.existsSync(join(home, 'sites', 'index.html'))).toBe(true);
    expect(fs.existsSync(join(home, 'sites', 'pages', 'index.html'))).toBe(true);
    expect(fs.existsSync(join(home, 'sites', 'office', 'data', 'artifacts.json'))).toBe(true);
    expect(fs.existsSync(join(home, 'sites', 'traces', 'index.html'))).toBe(true);
    expect(fs.existsSync(join(home, 'sites', 'diffs', 'index.html'))).toBe(true);
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
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-workspace-bootstrap-launchd-&-'));

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

    const plistPath = join(
      home,
      'security',
      'generated',
      'com.consuelo.os.cloudflared.connector-123.plist',
    );
    const plist = fs.readFileSync(plistPath, 'utf8');

    expect(plist).toContain('consuelo-os-workspace-bootstrap-launchd-&amp;-');
    expect(plist).not.toContain('consuelo-os-workspace-bootstrap-launchd-&-');
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create_file',
          path: expect.stringContaining('com.consuelo.os.cloudflared.connector-123.plist'),
          message: expect.stringMatching(/cloudflared/i),
        }),
        expect.objectContaining({
          type: 'create_file',
          path: expect.stringContaining('smoke-gateway-auth'),
          message: expect.stringMatching(/gateway auth smoke/i),
        }),
      ]),
    );
    expect(
      fs.existsSync(join(home, 'security', 'generated', 'com.consuelo.os.cloudflared.plist')),
    ).toBe(false);
  });

  it('should keep repeated cloudflared daemon generation label-derived and idempotent', async () => {
    const { provisionLocalOs } = await loadInstallStateContract();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-workspace-bootstrap-idempotent-'));
    const workspaceBootstrap = {
      workspaceId: 'workspace_123',
      workspaceSlug: 'kokayi',
      workspaceHost: 'kokayi.consuelohq.com',
      connectorId: 'connector_123',
      connectorTransport: 'cloudflare-tunnel',
      cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
    };

    provisionLocalOs({ home, mode: 'local', workspaceBootstrap });
    provisionLocalOs({ home, mode: 'local', workspaceBootstrap });

    const generatedFiles = fs
      .readdirSync(join(home, 'security', 'generated'))
      .filter((fileName) => fileName.startsWith('com.consuelo.os.cloudflared'));

    expect(generatedFiles).toEqual([
      'com.consuelo.os.cloudflared.connector-123.plist',
    ]);
  });

  it('should leave platform provisioning to Consuelo control plane before reporting install success', () => {
    const installSource = fs.readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );

    const provisionIndex = installSource.indexOf('const result = provisionLocalOs');
    const platformProvisioningIndex = installSource.indexOf('const platformProvisioning =');
    const payloadIndex = installSource.indexOf('const payload = {');
    const successIndex = installSource.indexOf('spin?.succeed');

    expect(provisionIndex).toBeGreaterThan(-1);
    expect(platformProvisioningIndex).toBeGreaterThan(provisionIndex);
    expect(payloadIndex).toBeGreaterThan(platformProvisioningIndex);
    expect(successIndex).toBeGreaterThan(payloadIndex);
    expect(installSource).toContain('platformProvisioning,');
    expect(installSource).toContain('Consuelo platform provisioning');
    expect(installSource).not.toMatch(/publishWorkspaceEdgeSnapshot|edgePublish|wrangler/);
    expect(installSource).not.toMatch(/CLOUDFLARE_(?:ACCOUNT_ID|API_TOKEN|ZONE_ID|CUSTOM_RULESET_ID)/);
  });


  it('should show workspace progress and slug workspace names before device authorization', () => {
    const installSource = fs.readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );
    const cliUiSource = fs.readFileSync(
      join(process.cwd(), 'scripts', 'lib', 'cli-ui.ts'),
      'utf8',
    );

    expect(installSource).toContain("{ label: 'dependencies', state: 'complete' }");
    expect(installSource).toContain("{ label: 'workspace', state: 'active' }");
    expect(installSource).toContain("message: 'enter workspace name'");
    expect(installSource).not.toContain('spaces become hyphens');
    expect(installSource).toContain('const workspaceName = normalizeWorkspaceName(rawWorkspaceName);');
    expect(installSource).not.toContain('workspace slug:');
    expect(installSource.indexOf('const workspaceName = normalizeWorkspaceName(rawWorkspaceName);')).toBeLessThan(
      installSource.indexOf('const workspaceHost = workspaceHostFromSlug(workspaceSlug);'),
    );
    expect(cliUiSource).toContain("state?: 'pending' | 'active' | 'complete'");
    expect(cliUiSource).toContain("if (step.state === 'active' || step.state === 'complete') return chalk.white('●');");
  });


  it('should honor preselected daemon flags without reprompting during interactive setup', () => {
    const installSource = fs.readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );

    expect(installSource).toContain('if (options.installDaemons) {');
    expect(installSource).toContain('installDaemons = true;');
    expect(installSource).toContain('} else if (options.skipDaemons) {');
    expect(installSource).toContain('installDaemons = false;');
    expect(installSource.indexOf('if (options.installDaemons) {')).toBeLessThan(
      installSource.indexOf("message: 'install local background service?'"),
    );
  });

  it('should resolve OS home silently instead of prompting for it in interactive setup', () => {
    const installSource = fs.readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );

    expect(installSource).not.toContain("message: 'OS home'");
    expect(installSource).not.toContain("'workspace', 'home', 'skills'");
    expect(installSource).not.toContain("stepComplete('home')");
    expect(installSource).toContain('const home = resolveOsHome(options.home);');
    expect(installSource).toContain('home,');
  });
});
