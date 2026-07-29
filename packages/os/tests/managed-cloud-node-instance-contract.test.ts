import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type ResourceStatus = 'created' | 'unchanged';

type ManagedCloudNodeClient = {
  ensureReleaseBucketAccess: (input: unknown) => Promise<ResourceStatus>;
  ensureDataDisk: (input: unknown) => Promise<ResourceStatus>;
  ensureSnapshotPolicyAttachment: (input: unknown) => Promise<ResourceStatus>;
  ensureInstance: (input: unknown) => Promise<ResourceStatus>;
};

type ManagedCloudNodeContract = {
  PERMANENT_DATA_DELETE_CONFIRMATION: string;
  planManagedCloudNode: (input: {
    projectId: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    nodeId: string;
    nodeName: string;
    region?: string;
    zone?: string;
    machineType?: string;
    release: {
      channel: 'stable' | 'beta' | 'canary' | 'dev';
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
  }) => {
    provider: 'gcp';
    projectId: string;
    workspaceId: string;
    workspaceSlug: string;
    workspaceHost: string;
    nodeId: string;
    nodeName: string;
    region: string;
    zone: string;
    labels: Record<string, string>;
    dataDisk: {
      name: string;
      sizeGb: number;
      type: string;
      deviceName: string;
      autoDelete: false;
      snapshotPolicies: string[];
    };
    instance: {
      name: string;
      machineType: string;
      network: string;
      subnet: string;
      noExternalIp: true;
      serviceAccountEmail: string;
      scopes: string[];
      tags: string[];
      bootDisk: {
        sizeGb: number;
        type: string;
        imageFamily: string;
        imageProject: string;
        autoDelete: true;
      };
      dataDisk: {
        name: string;
        deviceName: string;
        autoDelete: false;
      };
      shielded: {
        secureBoot: true;
        vTPM: true;
        integrityMonitoring: true;
      };
      metadata: Record<string, string>;
    };
    bootstrap: {
      home: string;
      mountPath: string;
      statusPath: string;
      enrollmentStatusPath: string;
      startupScript: string;
    };
  };
  applyManagedCloudNode: (input: {
    client: ManagedCloudNodeClient;
    plan: ReturnType<ManagedCloudNodeContract['planManagedCloudNode']>;
    dryRun?: boolean;
  }) => Promise<{
    status: 'planned' | 'provisioned';
    operations: Array<{
      resource: string;
      status: 'planned' | ResourceStatus;
    }>;
  }>;
  planManagedCloudNodeReplacement: (input: {
    plan: ReturnType<ManagedCloudNodeContract['planManagedCloudNode']>;
  }) => {
    deleteInstance: true;
    deleteBootDisk: true;
    preserveDataDisk: true;
    attachDataDisk: string;
    recreateInstance: string;
  };
  planManagedCloudNodeDeletion: (input: {
    plan: ReturnType<ManagedCloudNodeContract['planManagedCloudNode']>;
    deleteData?: boolean;
    confirmation?: string;
  }) => {
    deleteInstance: true;
    deleteBootDisk: true;
    deleteDataDisk: boolean;
    dataDiskName: string;
  };
};

async function loadContract(): Promise<ManagedCloudNodeContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as ManagedCloudNodeContract;
}

const release = {
  channel: 'dev' as const,
  baseUrl: 'https://storage.googleapis.com/consuelo-os-releases-dev',
  bootstrapBundleUrl:
    'https://storage.googleapis.com/consuelo-os-releases-dev/bundles/linux-x64/runtime.tar.gz',
  bootstrapBundleDigest: `sha256:${'1'.repeat(64)}`,
  bootstrapBundleId: `sha256:${'2'.repeat(64)}`,
  bootstrapBundleVersion: '1.2.3',
  cloudflaredBinaryUrl:
    'https://github.com/cloudflare/cloudflared/releases/download/2026.7.3/cloudflared-linux-amd64',
  cloudflaredBinaryDigest:
    'sha256:9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17',
  cloudflaredVersion: '2026.7.3',
  trustedPublicKeys: {
    'release-key-1': [
      '-----BEGIN PUBLIC KEY-----',
      'MCowBQYDK2VwAyEA111111111111111111111111111111111111111=',
      '-----END PUBLIC KEY-----',
    ].join('\n'),
  },
};

const input = {
  projectId: 'consuelo-cloud-dev-igg2mr',
  workspaceId: 'workspace_kokayi',
  workspaceSlug: 'kokayi',
  workspaceHost: 'kokayi.consuelohq.com',
  nodeId: 'ko-cloud-1',
  nodeName: "Ko's cloud node",
  release,
};

describe('managed cloud node instance contract', () => {
  it('plans a deterministic secure GCP node with a retained data disk', async () => {
    const { planManagedCloudNode } = await loadContract();
    const first = planManagedCloudNode(input);
    const second = planManagedCloudNode(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      provider: 'gcp',
      projectId: 'consuelo-cloud-dev-igg2mr',
      workspaceId: 'workspace_kokayi',
      workspaceSlug: 'kokayi',
      workspaceHost: 'kokayi.consuelohq.com',
      nodeId: 'ko-cloud-1',
      nodeName: "Ko's cloud node",
      region: 'us-east1',
      zone: 'us-east1-b',
      dataDisk: {
        name: 'consuelo-ko-cloud-1-data',
        sizeGb: 100,
        type: 'pd-balanced',
        deviceName: 'consuelo-data',
        autoDelete: false,
        snapshotPolicies: ['consuelo-os-data-daily-90d'],
      },
      instance: {
        name: 'consuelo-ko-cloud-1',
        machineType: 'e2-standard-2',
        network: 'consuelo-os-cloud',
        subnet: 'consuelo-os-cloud-us-east1',
        noExternalIp: true,
        serviceAccountEmail:
          'consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        tags: ['consuelo-os-cloud-admin', 'consuelo-os-cloud-node'],
        bootDisk: {
          sizeGb: 30,
          type: 'pd-balanced',
          imageFamily: 'debian-12',
          imageProject: 'debian-cloud',
          autoDelete: true,
        },
        dataDisk: {
          name: 'consuelo-ko-cloud-1-data',
          deviceName: 'consuelo-data',
          autoDelete: false,
        },
        shielded: {
          secureBoot: true,
          vTPM: true,
          integrityMonitoring: true,
        },
      },
      bootstrap: {
        home: '/var/lib/consuelo',
        mountPath: '/var/lib/consuelo',
        statusPath: '/var/lib/consuelo/bootstrap/status.json',
        enrollmentStatusPath:
          '/var/lib/consuelo/bootstrap/enrollment-status.json',
      },
    });
    expect(first.labels).toMatchObject({
      'consuelo-managed': 'true',
      'consuelo-product': 'os-cloud',
      'consuelo-node-id': 'ko-cloud-1',
      'consuelo-workspace-id': 'workspace-kokayi',
    });
    expect(first.instance.metadata).toMatchObject({
      'enable-oslogin': 'TRUE',
      'block-project-ssh-keys': 'TRUE',
      'serial-port-enable': 'TRUE',
    });
  });

  it('renders a signed-bundle Linux bootstrap without embedding credentials', async () => {
    const { planManagedCloudNode } = await loadContract();
    const plan = planManagedCloudNode(input);
    const script = plan.bootstrap.startupScript;

    expect(script).toContain('google-consuelo-data');
    expect(script).toContain('/var/lib/consuelo');
    expect(script).toContain(release.bootstrapBundleUrl);
    expect(script).toContain(release.bootstrapBundleDigest.slice('sha256:'.length));
    expect(script).toContain('metadata.google.internal');
    expect(script).toContain('Metadata-Flavor: Google');
    expect(script).toContain('Authorization: Bearer $(gcp_access_token)');
    expect(script).toContain('CONSUELO_RELEASE_GCP_METADATA_AUTH=1');
    expect(script).toContain(release.cloudflaredBinaryUrl);
    expect(script).toContain(
      release.cloudflaredBinaryDigest.slice('sha256:'.length),
    );
    expect(script).toContain(
      'CLOUDFLARED_PATH="$CONSUELO_HOME/bin/cloudflared"',
    );
    expect(script).toContain('chmod 0755');
    expect(script).toContain('CONSUELO_RELEASE_BASE_URL');
    expect(script).toContain('CONSUELO_RELEASE_PUBLIC_KEYS_JSON');
    expect(script).toContain('scripts/lifecycle.ts');
    expect(script).toContain('scripts/managed-cloud-node-enroll.ts');
    expect(script).toContain(
      'CONSUELO_USER_HOME="$(getent passwd consuelo | cut -d: -f6)"',
    );
    expect(script).toContain('BUN_BIN="$CONSUELO_USER_HOME/.bun/bin/bun"');
    expect(script).not.toContain('/home/consuelo/');
    expect(script).toContain('/var/lib/consuelo/bootstrap/status.json');
    expect(script).not.toMatch(
      /ya29\.|-----BEGIN PRIVATE KEY-----|client[_-]?secret|service[_-]?account[_-]?key/i,
    );
  });

  it('plans and applies data disk, snapshot policies, and instance in stable order', async () => {
    const { applyManagedCloudNode, planManagedCloudNode } = await loadContract();
    const plan = planManagedCloudNode(input);
    const calls: string[] = [];
    const client: ManagedCloudNodeClient = {
      ensureReleaseBucketAccess: async () => {
        calls.push('release-bucket');
        return 'created';
      },
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

    const dryRun = await applyManagedCloudNode({ client, plan, dryRun: true });
    expect(dryRun.status).toBe('planned');
    expect(dryRun.operations).toHaveLength(4);
    expect(calls).toEqual([]);

    const applied = await applyManagedCloudNode({ client, plan });
    expect(applied.status).toBe('provisioned');
    expect(calls).toEqual([
      'data-disk',
      'snapshot-policy',
      'release-bucket',
      'instance',
    ]);
    expect(applied.operations.every((operation) => operation.status === 'created')).toBe(
      true,
    );
  });

  it('preserves data for ordinary deletion and VM replacement', async () => {
    const {
      PERMANENT_DATA_DELETE_CONFIRMATION,
      planManagedCloudNode,
      planManagedCloudNodeDeletion,
      planManagedCloudNodeReplacement,
    } = await loadContract();
    const plan = planManagedCloudNode(input);

    expect(planManagedCloudNodeReplacement({ plan })).toEqual({
      deleteInstance: true,
      deleteBootDisk: true,
      preserveDataDisk: true,
      attachDataDisk: 'consuelo-ko-cloud-1-data',
      recreateInstance: 'consuelo-ko-cloud-1',
    });
    expect(planManagedCloudNodeDeletion({ plan })).toEqual({
      deleteInstance: true,
      deleteBootDisk: true,
      deleteDataDisk: false,
      dataDiskName: 'consuelo-ko-cloud-1-data',
    });
    expect(() =>
      planManagedCloudNodeDeletion({ plan, deleteData: true }),
    ).toThrow(/explicit confirmation/i);
    expect(
      planManagedCloudNodeDeletion({
        plan,
        deleteData: true,
        confirmation: PERMANENT_DATA_DELETE_CONFIRMATION,
      }),
    ).toEqual({
      deleteInstance: true,
      deleteBootDisk: true,
      deleteDataDisk: true,
      dataDiskName: 'consuelo-ko-cloud-1-data',
    });
  });
});
