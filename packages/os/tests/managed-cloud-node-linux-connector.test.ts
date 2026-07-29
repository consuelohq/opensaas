import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type InstallStateContract = {
  provisionLocalOs: (options: Record<string, unknown>) => {
    actions: Array<{ path: string; message: string }>;
  };
};

async function loadContract(): Promise<InstallStateContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'install-state.ts'),
  ).href;
  return (await import(modulePath)) as InstallStateContract;
}

describe('managed cloud node Linux connector materialization', () => {
  it('materializes a durable cloudflared user service without embedding the token', async () => {
    const { provisionLocalOs } = await loadContract();
    const home = fs.mkdtempSync(join(os.tmpdir(), 'consuelo-cloud-connector-'));

    const result = provisionLocalOs({
      home,
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
        connectorTransport: 'cloudflare-tunnel',
        connectorBootstrapToken: 'connector-bootstrap-secret',
        cloudflareTunnelToken: 'cloudflare-tunnel-secret',
        nodePublicKeyJwk:
          '{"kty":"OKP","crv":"Ed25519","x":"public-fixture"}',
        nodeSigningKeyJwk:
          '{"kty":"OKP","crv":"Ed25519","x":"public-fixture","d":"private-fixture"}',
        nodeCapabilities: ['tools', 'mcp'],
      },
    });

    const generatedDir = join(home, 'node', 'security', 'generated');
    const tokenPath = join(generatedDir, 'cloudflared-tunnel.token');
    const servicePath = join(
      home,
      '.config',
      'systemd',
      'user',
      'consuelo-cloudflared-connector-ko-cloud-1.service',
    );
    const service = fs.readFileSync(servicePath, 'utf8');

    expect(fs.readFileSync(tokenPath, 'utf8').trim()).toBe(
      'cloudflare-tunnel-secret',
    );
    expect(fs.statSync(tokenPath).mode & 0o777).toBe(0o600);
    expect(service).toContain('Type=simple');
    expect(service).toContain(`${home}/bin/cloudflared`);
    expect(service).toContain('tunnel');
    expect(service).toContain('run');
    expect(service).toContain('--token-file');
    expect(service).toContain(tokenPath);
    expect(service).toContain('--url');
    expect(service).toContain('http://127.0.0.1:46320');
    expect(service).toContain('Restart=always');
    expect(service).toContain('WantedBy=default.target');
    expect(service).not.toContain('cloudflare-tunnel-secret');
    expect(service).not.toContain('connector-bootstrap-secret');
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: servicePath,
          message: expect.stringMatching(/cloudflared systemd service/i),
        }),
      ]),
    );
  });
});
