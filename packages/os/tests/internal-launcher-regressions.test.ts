import { describe, expect, it } from 'vitest';

import {
  renderWorkspaceChromeBar,
  workspaceRouteSwitcherStyles,
} from '../scripts/lib/workspace-chrome';
import { renderConfigurationSite } from '../scripts/lib/settings-site';
import { createWorkspaceNodeHeartbeatClient } from '../scripts/lib/workspace-node-heartbeat-client';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import { workspaceNodeListPayload } from '../cloudflare/os-device-authority/src/services/nodes';
import type {
  AccountWorkspace,
  WorkspaceNode,
} from '../cloudflare/os-device-authority/src/types';

const NOW_MS = Date.parse('2026-08-26T04:00:00.000Z');

function workspace(): AccountWorkspace {
  return {
    accountId: 'account_menu_regression',
    workspaceId: 'workspace_menu_regression',
    workspaceSlug: 'internal',
    workspaceHost: 'internal.consuelohq.com',
    defaultNodeId: 'node-default',
    updatedAt: NOW_MS,
  };
}

function node(input: {
  nodeId: string;
  lastSeenAt: number;
  createdAt: number;
}): WorkspaceNode {
  return {
    accountId: 'account_menu_regression',
    workspaceId: 'workspace_menu_regression',
    workspaceSlug: 'internal',
    workspaceHost: 'internal.consuelohq.com',
    nodeId: input.nodeId,
    nodeName: input.nodeId,
    role: 'member',
    connectorStatus: 'connected',
    state: 'active',
    devicePublicKeyThumbprint: 'thumbprint-' + input.nodeId,
    createdAt: input.createdAt,
    updatedAt: input.lastSeenAt,
    lastSeenAt: input.lastSeenAt,
  };
}

describe('internal launcher regression contracts', () => {
  it('keeps the owner route before configure in a title-only responsive menu', () => {
    const html = renderWorkspaceChromeBar('overview', 'Home', {
      extraSections: [
        {
          id: 'internal',
          label: 'Internal',
          links: [
            {
              label: 'Users & installs',
              href: 'https://internal.consuelohq.com/users',
            },
          ],
        },
        {
          id: 'team',
          label: 'Team',
          links: [{ label: 'Runbook', href: 'https://docs.example.com/runbook' }],
        },
      ],
    });
    expect(html.indexOf('data-custom-route-group="internal"'))
      .toBeLessThan(html.indexOf('data-route-group="Configure"'));
    expect(html).not.toContain('<small>');
    expect(html).not.toContain('Workspace health and context.');
    expect(html).not.toContain('Open private admin site.');

    const styles = workspaceRouteSwitcherStyles();
    const menuRule = styles.match(/\.workspace-route-menu\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(menuRule).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(menuRule).toContain('width: min(780px, calc(100vw - 28px))');
    expect(menuRule).toContain('overflow: visible');
    expect(menuRule).not.toMatch(/overflow(?:-x|-y)?:\s*(?:auto|scroll)/);
    expect(styles).toContain('.workspace-route-menu[hidden] { display: none !important; }');
    expect(styles).toContain('@media (min-width: 1600px)');
    expect(styles).toContain('width: min(1040px, calc(100vw - 48px))');
    expect(styles).toContain('.workspace-route-primary-slot { grid-column: 1 / -1; padding-bottom: 0; border-bottom: 0; }');
    expect(styles).toContain('.workspace-route-group { min-width: 0; display: grid; align-content: start; gap: 1px; padding-top: 0; border-top: 0; }');
    expect(styles).not.toContain('border-top: 1px solid var(--workspace-menu-rule)');
    expect(styles).not.toContain('border: 1px solid var(--workspace-menu-rule)');
    expect(styles).toContain('@media (max-height: 760px)');
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(styles).toContain('zoom: .86');
  });

  it('renders the sealed-secret create and replace surface', () => {
    const html = renderConfigurationSite('secrets');

    expect(html).toContain('+ New secret');
    expect(html).toContain('Encrypted in this browser before it is sent.');
    expect(html).toContain('/gateway/secrets/setup');
    expect(html).toContain('/gateway/secrets/install');
    expect(html).toContain("name: 'X25519'");
    expect(html).toContain("name: 'AES-GCM'");
    expect(html).not.toContain('Reveal');
  });

  it('orders the default node first, then online nodes, then remaining nodes by activity', () => {
    const payload = workspaceNodeListPayload({
      workspace: workspace(),
      nowMs: NOW_MS,
      nodes: [
        node({ nodeId: 'node-offline-old', lastSeenAt: NOW_MS - 86_400_000, createdAt: 1 }),
        node({ nodeId: 'node-online-older', lastSeenAt: NOW_MS - 20_000, createdAt: 2 }),
        node({ nodeId: 'node-default', lastSeenAt: NOW_MS - 86_400_000, createdAt: 3 }),
        node({ nodeId: 'node-offline-recent', lastSeenAt: NOW_MS - 3_600_000, createdAt: 4 }),
        node({ nodeId: 'node-online-newer', lastSeenAt: NOW_MS - 5_000, createdAt: 5 }),
      ],
    });

    expect(payload.nodes.map((item) => item.nodeId)).toEqual([
      'node-default',
      'node-online-newer',
      'node-online-older',
      'node-offline-recent',
      'node-offline-old',
    ]);
  });

  it('publishes detected platform metadata in every signed heartbeat', async () => {
    const keyPair = generateWorkspaceDeviceKeyPair();
    let body: Record<string, unknown> | undefined;
    const client = createWorkspaceNodeHeartbeatClient({
      config: {
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceId: 'workspace_menu_regression',
        nodeId: 'node-current',
        connectorStatus: 'connected',
        capabilities: ['mcp'],
        publicKeyJwk: keyPair.publicKeyJwk,
        signingKeyJwk: keyPair.signingKeyJwk,
      },
      createNonce: () => 'platform-heartbeat-nonce',
      now: () => NOW_MS,
      fetchImpl: async (request) => {
        body = JSON.parse(await request.text()) as Record<string, unknown>;
        return Response.json({
          nodeId: 'node-current',
          presence: 'online',
          routeReady: true,
        });
      },
    });

    await client.send();

    expect(body).toMatchObject({
      platform: process.platform,
      architecture: process.arch,
    });
  });
});
