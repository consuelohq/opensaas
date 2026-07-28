import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type ResourceStatus = 'created' | 'unchanged';

type NodeClient = {
  ensureDataDisk: (input: unknown) => Promise<ResourceStatus>;
  ensureSnapshotPolicyAttachment: (input: unknown) => Promise<ResourceStatus>;
  ensureInstance: (input: unknown) => Promise<ResourceStatus>;
};

type NodeConfig = {
  projectId: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  release: {
    channel: 'dev';
    baseUrl: string;
    bootstrapBundleUrl: string;
    bootstrapBundleDigest: string;
    bootstrapBundleId: string;
    bootstrapBundleVersion: string;
    cloudflaredBinaryUrl: string;
    cloudflaredBinaryDigest: string;
    cloudflaredVersion: string;
    trustedPublicKeys: Record<string, string>;
  };
};

type PlatformContract = {
  provisionManagedCloudNode: (input: NodeConfig & {
    dryRun?: boolean;
    client?: NodeClient;
  }) => Promise<{
    status: 'planned' | 'provisioned';
    plan: { nodeId: string; zone: string };
    operations: Array<{ resource: string; status: string }>;
  }>;
};

type CliContract = {
  parseManagedCloudNodeArgs: (
    argv: string[],
    env?: Record<string, string | undefined>,
  ) =>
    | {
        command: 'plan' | 'apply';
        projectId: string;
        billingAccountId: string;
        json: boolean;
      }
    | {
        command: 'node-plan' | 'node-apply';
        configPath: string;
        json: boolean;
      };
};

async function loadPlatform(): Promise<PlatformContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'platform-managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as PlatformContract;
}

async function loadCli(): Promise<CliContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as CliContract;
}

const config: NodeConfig = {
  projectId: 'consuelo-cloud-dev-igg2mr',
  workspaceId: 'workspace_kokayi',
  workspaceSlug: 'kokayi',
  workspaceHost: 'kokayi.consuelohq.com',
  nodeId: 'ko-cloud-1',
  nodeName: "Ko's cloud node",
  release: {
    channel: 'dev',
    baseUrl: 'https://releases.consuelohq.com',
    bootstrapBundleUrl:
      'https://releases.consuelohq.com/bundles/linux-x64/runtime.tar.gz',
    bootstrapBundleDigest: `sha256:${'1'.repeat(64)}`,
    bootstrapBundleId: `sha256:${'2'.repeat(64)}`,
    bootstrapBundleVersion: '1.2.3',
    cloudflaredBinaryUrl:
      'https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-linux-amd64',
    cloudflaredBinaryDigest:
      'sha256:9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17',
    cloudflaredVersion: '2026.7.3',
    trustedPublicKeys: {
      fixture: '-----BEGIN PUBLIC KEY-----\nfixture\n-----END PUBLIC KEY-----',
    },
  },
};

describe('platform managed cloud node instance boundary', () => {
  it('plans without provider authority and applies through the shared service', async () => {
    const { provisionManagedCloudNode } = await loadPlatform();
    const planned = await provisionManagedCloudNode({ ...config, dryRun: true });
    expect(planned).toMatchObject({
      status: 'planned',
      plan: { nodeId: 'ko-cloud-1', zone: 'us-east1-b' },
    });
    expect(planned.operations).toHaveLength(4);

    const calls: string[] = [];
    const client: NodeClient = {
      ensureDataDisk: async () => {
        calls.push('data-disk');
        return 'created';
      },
      ensureSnapshotPolicyAttachment: async () => {
        calls.push('snapshot-policy');
        return 'created';
      },
      ensureInstance: async () => {
        calls.push('instance');
        return 'created';
      },
    };
    const applied = await provisionManagedCloudNode({ ...config, client });
    expect(applied.status).toBe('provisioned');
    expect(calls).toEqual([
      'data-disk',
      'snapshot-policy',
      'snapshot-policy',
      'instance',
    ]);
  });

  it('parses explicit node plan/apply config commands while preserving foundation commands', async () => {
    const { parseManagedCloudNodeArgs } = await loadCli();

    expect(
      parseManagedCloudNodeArgs(
        ['node-plan', '--config', '/tmp/ko-cloud-node.json', '--json'],
        {},
      ),
    ).toEqual({
      command: 'node-plan',
      configPath: '/tmp/ko-cloud-node.json',
      json: true,
    });
    expect(
      parseManagedCloudNodeArgs(
        ['node-apply', '--config', '/tmp/ko-cloud-node.json'],
        {},
      ),
    ).toEqual({
      command: 'node-apply',
      configPath: '/tmp/ko-cloud-node.json',
      json: false,
    });
    expect(
      parseManagedCloudNodeArgs(
        [
          'plan',
          '--project',
          'consuelo-cloud-dev-igg2mr',
          '--billing-account',
          'billing_fixture',
        ],
        {},
      ),
    ).toMatchObject({
      command: 'plan',
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
    });
  });

  it('keeps node provisioning explicit and absent from public install', () => {
    const scriptSource = readFileSync(
      join(process.cwd(), 'scripts', 'managed-cloud-node.ts'),
      'utf8',
    );
    const installSource = readFileSync(
      join(process.cwd(), 'scripts', 'install.ts'),
      'utf8',
    );

    expect(scriptSource).toContain('provisionManagedCloudNode');
    expect(scriptSource).toContain("command === 'node-plan'");
    expect(scriptSource).toContain("command === 'node-apply'");
    expect(scriptSource).toContain('--config');
    expect(installSource).not.toContain('provisionManagedCloudNode');
  });
});
