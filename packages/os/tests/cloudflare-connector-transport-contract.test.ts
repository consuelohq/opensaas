import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceConnectorTransportPlan = {
  connectorId: string;
  workspaceHost: string;
  transport: 'cloudflare-tunnel' | 'websocket-relay';
  localServiceUrl: string;
  tokenPath?: string;
  launchd?: {
    label: string;
    programArguments: string[];
    keepAlive: boolean;
    runAtLoad: boolean;
    standardOutPath: string;
    standardErrorPath: string;
  };
  relay?: {
    url: string;
    protocol: 'websocket';
    enabled: boolean;
  };
};

type WorkspaceConnectorTransportContract = {
  planWorkspaceConnectorTransport: (input: {
    home: string;
    connectorId: string;
    workspaceHost: string;
    localPort: number;
    transport: 'cloudflare-tunnel' | 'websocket-relay';
    cloudflareTunnelToken?: string;
    cloudflaredBin?: string | null;
    relayUrl?: string;
  }) => WorkspaceConnectorTransportPlan;
};

const runContract =
  process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

async function loadWorkspaceConnectorTransportContract(): Promise<WorkspaceConnectorTransportContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-connector-transport.ts'),
  ).href;
  const module = (await import(
    modulePath
  )) as Partial<WorkspaceConnectorTransportContract>;

  if (typeof module.planWorkspaceConnectorTransport !== 'function') {
    throw new Error(
      'workspace connector transport contract module is missing export: planWorkspaceConnectorTransport',
    );
  }

  return module as WorkspaceConnectorTransportContract;
}

contractDescribe('workspace connector transport contract', () => {
  it('should plan a Cloudflare Tunnel connector when no user Cloudflare login is required', async () => {
    const { planWorkspaceConnectorTransport } =
      await loadWorkspaceConnectorTransportContract();

    const plan = planWorkspaceConnectorTransport({
      home: '/tmp/consuelo-os-smoke/os',
      connectorId: 'connector_123',
      workspaceHost: 'kokayi.consuelohq.com',
      localPort: 8850,
      transport: 'cloudflare-tunnel',
      cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
      cloudflaredBin: '/tmp/consuelo-os-smoke/os/bin/cloudflared',
    });

    expect(plan).toMatchObject({
      connectorId: 'connector_123',
      workspaceHost: 'kokayi.consuelohq.com',
      transport: 'cloudflare-tunnel',
      localServiceUrl: 'http://127.0.0.1:8850',
      tokenPath: '/tmp/consuelo-os-smoke/os/security/generated/cloudflared-tunnel.token',
      launchd: expect.objectContaining({
        label: 'com.consuelo.os.cloudflared.connector-123',
        keepAlive: true,
        runAtLoad: true,
      }),
    });
    expect(plan.launchd?.programArguments[0]).toBe(
      '/tmp/consuelo-os-smoke/os/bin/cloudflared',
    );
    expect(plan.launchd?.programArguments.join(' ')).toMatch(/cloudflared/);
    expect(plan.launchd?.programArguments.join(' ')).not.toContain(
      '/usr/local/bin/cloudflared',
    );
    expect(plan.launchd?.programArguments.join(' ')).toMatch(/tunnel\s+run/);
    expect(plan.launchd?.programArguments.join(' ')).toMatch(/--token-file/);
    expect(plan.launchd?.programArguments.join(' ')).not.toMatch(/login|cert\.pem|cloudflare account/i);
    expect(JSON.stringify(plan)).not.toContain('cloudflared_tunnel_token_fixture');
  });

  it('should treat blank cloudflared executable input as unset', async () => {
    const { planWorkspaceConnectorTransport } =
      await loadWorkspaceConnectorTransportContract();
    const home = '/tmp/consuelo-os-smoke/os';
    const fallbackBin = join(home, 'bin', 'cloudflared');

    for (const cloudflaredBin of [undefined, null, '', '   '] as const) {
      const plan = planWorkspaceConnectorTransport({
        home,
        connectorId: 'connector_123',
        workspaceHost: 'kokayi.consuelohq.com',
        localPort: 8850,
        transport: 'cloudflare-tunnel',
        cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
        cloudflaredBin,
      });

      expect(plan.launchd?.programArguments[0]).toBe(fallbackBin);
      expect(plan.launchd?.programArguments[0]?.trim()).not.toBe('');
    }
  });

  it('should trim a non-empty cloudflared executable input', async () => {
    const { planWorkspaceConnectorTransport } =
      await loadWorkspaceConnectorTransportContract();

    const plan = planWorkspaceConnectorTransport({
      home: '/tmp/consuelo-os-smoke/os',
      connectorId: 'connector_123',
      workspaceHost: 'kokayi.consuelohq.com',
      localPort: 8850,
      transport: 'cloudflare-tunnel',
      cloudflareTunnelToken: 'cloudflared_tunnel_token_fixture',
      cloudflaredBin: '  /tmp/consuelo-os-smoke/os/bin/cloudflared  ',
    });

    expect(plan.launchd?.programArguments[0]).toBe(
      '/tmp/consuelo-os-smoke/os/bin/cloudflared',
    );
  });

  it('should fail closed when a Cloudflare Tunnel token is missing', async () => {
    const { planWorkspaceConnectorTransport } =
      await loadWorkspaceConnectorTransportContract();

    expect(() =>
      planWorkspaceConnectorTransport({
        home: '/tmp/consuelo-os-smoke/os',
        connectorId: 'connector_123',
        workspaceHost: 'kokayi.consuelohq.com',
        localPort: 8850,
        transport: 'cloudflare-tunnel',
      }),
    ).toThrow(/Cloudflare Tunnel token is required/i);
  });

  it('should preserve a future websocket relay transport boundary when relay transport is explicitly selected', async () => {
    const { planWorkspaceConnectorTransport } =
      await loadWorkspaceConnectorTransportContract();

    const plan = planWorkspaceConnectorTransport({
      home: '/tmp/consuelo-os-smoke/os',
      connectorId: 'connector_123',
      workspaceHost: 'kokayi.consuelohq.com',
      localPort: 8850,
      transport: 'websocket-relay',
      relayUrl: 'wss://relay.consuelohq.com/connectors/connector_123',
    });

    expect(plan).toMatchObject({
      connectorId: 'connector_123',
      workspaceHost: 'kokayi.consuelohq.com',
      transport: 'websocket-relay',
      localServiceUrl: 'http://127.0.0.1:8850',
      relay: {
        url: 'wss://relay.consuelohq.com/connectors/connector_123',
        protocol: 'websocket',
        enabled: false,
      },
    });
    expect(plan.launchd).toBeUndefined();
  });
});
