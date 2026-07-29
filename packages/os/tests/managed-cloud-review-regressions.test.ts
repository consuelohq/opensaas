import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  planManagedCloudNode,
  planManagedCloudNodeFoundation,
} from '../scripts/lib/managed-cloud-node';
import { createLifecycleOnboardingCommand } from '../scripts/lifecycle';
import { parseManagedCloudNodeArgs } from '../scripts/managed-cloud-node';

const release = {
  channel: 'dev' as const,
  baseUrl: 'https://storage.googleapis.com/consuelo-os-releases-dev',
  bootstrapBundleUrl:
    'https://storage.googleapis.com/consuelo-os-releases-dev/bundles/linux-x64/runtime.tar.gz',
  bootstrapBundleDigest: 'sha256:' + '1'.repeat(64),
  bootstrapBundleId: 'sha256:' + '2'.repeat(64),
  bootstrapBundleVersion: '1.2.3',
  cloudflaredBinaryUrl:
    'https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-linux-amd64',
  cloudflaredBinaryDigest: 'sha256:' + '3'.repeat(64),
  cloudflaredVersion: '2026.7.3',
  trustedPublicKeys: {
    release: [
      '-----BEGIN PUBLIC KEY-----',
      'fixture',
      '-----END PUBLIC KEY-----',
    ].join('\n'),
  },
};

const nodeInput = {
  projectId: 'consuelo-cloud-dev',
  workspaceId: 'workspace_kokayi',
  workspaceSlug: 'kokayi',
  workspaceHost: 'HTTPS://KoKayi.ConsueloHQ.com/path',
  nodeId: 'Node_ABC',
  nodeName: 'Cloud node',
  release,
};

describe('managed cloud review regressions', () => {
  it('preserves authority node identity while deriving GCP-safe names and canonical host', () => {
    const plan = planManagedCloudNode(nodeInput);
    expect(plan.nodeId).toBe('Node_ABC');
    expect(plan.instance.name).toBe('consuelo-node-abc');
    expect(plan.labels['consuelo-node-id']).toBe('node-abc');
    expect(plan.workspaceHost).toBe('kokayi.consuelohq.com');
    expect(plan.dataDisk.snapshotPolicies).toEqual([
      'consuelo-os-data-daily-90d',
    ]);
  });

  it('fails closed for unsafe release channels, origins, and private key material', () => {
    expect(() =>
      planManagedCloudNode({
        ...nodeInput,
        release: { ...release, channel: 'nightly' as 'dev' },
      }),
    ).toThrow(/channel/i);
    expect(() =>
      planManagedCloudNode({
        ...nodeInput,
        release: {
          ...release,
          baseUrl: 'https://attacker.example/releases',
        },
      }),
    ).toThrow(/Google Cloud Storage/i);
    expect(() =>
      planManagedCloudNode({
        ...nodeInput,
        release: {
          ...release,
          trustedPublicKeys: {
            release:
              '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
          },
        },
      }),
    ).toThrow(/private key/i);
  });

  it('renders replacement-safe retained-disk bootstrap and actual user-manager paths', () => {
    const script = planManagedCloudNode(nodeInput).bootstrap.startupScript;
    expect(script).toContain("ALLOW_DATA_DISK_FORMAT='false'");
    expect(script).toContain('BOOT_DISK_FORMAT_MARKER');
    expect(script).toContain('HOME="$CONSUELO_USER_HOME"');
    expect(script).toContain('XDG_CONFIG_HOME="$CONSUELO_USER_HOME/.config"');
    expect(script).not.toContain('chown -R');
  });

  it('allocates distinct private subnet ranges for supported regions with NAT', () => {
    const east = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev',
      billingAccountId: 'billing',
      region: 'us-east1',
    });
    const west = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev',
      billingAccountId: 'billing',
      region: 'us-west1',
    });
    expect(east.subnet.cidr).not.toBe(west.subnet.cidr);
    expect(east.nat.sourceSubnetworkIpRangesToNat).toBe(
      'ALL_SUBNETWORKS_ALL_IP_RANGES',
    );
  });

  it('does not seed placeholder workspace identity before authority enrollment', () => {
    const directory = mkdtempSync(join(tmpdir(), 'consuelo-onboarding-'));
    const onboardingFile = join(directory, 'onboarding.json');
    writeFileSync(
      onboardingFile,
      JSON.stringify({
        schemaVersion: 1,
        projectId: nodeInput.projectId,
        workspaceId: nodeInput.workspaceId,
        workspaceSlug: 'kokayi',
        workspaceHost: 'kokayi.consuelohq.com',
        nodeId: nodeInput.nodeId,
        nodeName: nodeInput.nodeName,
      }),
    );
    try {
      const command = createLifecycleOnboardingCommand({
        osRoot: process.cwd(),
        home: '/var/lib/consuelo',
        onboardingFile,
      });
      expect(command.args).not.toContain('--workspace-url');
      expect(command.args).not.toContain('--workspace-slug');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('supports quiet output for node plan and apply commands', () => {
    expect(
      parseManagedCloudNodeArgs([
        'node-plan',
        '--config',
        'node.json',
        '--quiet',
      ]),
    ).toMatchObject({ command: 'node-plan', quiet: true });
  });
});
