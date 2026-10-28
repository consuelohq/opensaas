import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

type InstallStateContract = {
  provisionLocalOs: (options: Record<string, unknown>) => {
    actions: Array<{ path: string; message: string }>;
  };
};

afterEach(() => vi.unstubAllEnvs());

async function loadContract(): Promise<InstallStateContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'install-state.ts'),
  ).href;
  return (await import(modulePath)) as InstallStateContract;
}

describe('managed cloud node Linux heartbeat materialization', () => {
  it('materializes a websocket-relay heartbeat config and durable systemd timer', async () => {
    const { provisionLocalOs } = await loadContract();
    const home = fs.mkdtempSync(join(os.tmpdir(), 'consuelo-cloud-heartbeat-'));
    const userHome = fs.mkdtempSync(join(os.tmpdir(), 'consuelo-cloud-user-'));
    const xdgConfigHome = fs.mkdtempSync(join(os.tmpdir(), 'consuelo-cloud-xdg-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfigHome);

    const result = provisionLocalOs({
      home,
      userHome,
      mode: 'cloud',
      platform: 'linux',
      workspaceBootstrap: {
        workspaceId: 'workspace_kokayi',
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        nodeId: 'ko-cloud-1',
        nodeName: "Ko's cloud node",
        nodeRole: 'member',
        nodeStatus: 'created',
        connectorId: 'connector_ko_cloud_1',
        connectorTransport: 'websocket-relay',
        connectorBootstrapToken: 'connector-bootstrap-secret',
        nodePublicKeyJwk:
          '{"kty":"OKP","crv":"Ed25519","x":"public-fixture"}',
        nodeSigningKeyJwk:
          '{"kty":"OKP","crv":"Ed25519","x":"public-fixture","d":"private-fixture"}',
        nodeCapabilities: ['tools', 'mcp'],
      },
    });

    const heartbeatConfigPath = join(
      home,
      'node',
      'security',
      'generated',
      'workspace-node-heartbeat.json',
    );
    const systemdDir = join(xdgConfigHome, 'systemd', 'user');
    const servicePath = join(systemdDir, 'consuelo-node-heartbeat.service');
    const timerPath = join(systemdDir, 'consuelo-node-heartbeat.timer');
    const heartbeatConfig = JSON.parse(
      fs.readFileSync(heartbeatConfigPath, 'utf8'),
    ) as Record<string, unknown>;
    const service = fs.readFileSync(servicePath, 'utf8');
    const timer = fs.readFileSync(timerPath, 'utf8');

    expect(heartbeatConfig).toMatchObject({
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceId: 'workspace_kokayi',
      nodeId: 'ko-cloud-1',
      connectorStatus: 'disconnected',
      capabilities: ['mcp', 'tools'],
    });
    expect(fs.statSync(heartbeatConfigPath).mode & 0o777).toBe(0o600);
    expect(service).toContain('Type=oneshot');
    expect(service).toContain('workspace-node-heartbeat.ts');
    expect(service).toContain(heartbeatConfigPath);
    expect(service).toContain(`Environment="CONSUELO_HOME=${home}"`);
    expect(service).not.toContain('private-fixture');
    expect(service).not.toContain('connector-bootstrap-secret');
    expect(timer).toContain('OnBootSec=5');
    expect(timer).toContain('OnUnitActiveSec=30');
    expect(timer).toContain('Persistent=true');
    expect(timer).toContain('WantedBy=timers.target');
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: heartbeatConfigPath,
          message: expect.stringMatching(/heartbeat config/i),
        }),
        expect.objectContaining({
          path: servicePath,
          message: expect.stringMatching(/heartbeat systemd service/i),
        }),
        expect.objectContaining({
          path: timerPath,
          message: expect.stringMatching(/heartbeat systemd timer/i),
        }),
      ]),
    );
    expect(
      fs.existsSync(
        join(
          home,
          'node',
          'security',
          'generated',
          'com.consuelo.os.cloudflared.connector-ko-cloud-1.plist',
        ),
      ),
    ).toBe(false);
  });
});
