import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (args: string[]) => Promise<CommandResult>;

type GcloudManagedNodeContract = {
  createGcloudManagedCloudNodeClient: (input: {
    run: CommandRunner;
  }) => {
    ensureDataDisk: (input: {
      projectId: string;
      zone: string;
      name: string;
      sizeGb: number;
      type: string;
      deviceName: string;
      autoDelete: false;
      snapshotPolicies: string[];
      labels: Record<string, string>;
    }) => Promise<'created' | 'unchanged'>;
    ensureSnapshotPolicyAttachment: (input: {
      projectId: string;
      zone: string;
      diskName: string;
      policyName: string;
    }) => Promise<'created' | 'unchanged'>;
    ensureInstance: (input: {
      projectId: string;
      zone: string;
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
      labels: Record<string, string>;
    }) => Promise<'created' | 'unchanged'>;
  };
};

async function loadContract(): Promise<GcloudManagedNodeContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'gcloud-managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as GcloudManagedNodeContract;
}

const ok = (stdout = ''): CommandResult => ({
  exitCode: 0,
  stdout,
  stderr: '',
});

const missing = (): CommandResult => ({
  exitCode: 1,
  stdout: '',
  stderr: 'ERROR: resource was not found',
});

const labels = {
  'consuelo-managed': 'true',
  'consuelo-node-id': 'ko-cloud-1',
  'consuelo-product': 'os-cloud',
  'consuelo-workspace-id': 'workspace-kokayi',
};

const dataDisk = {
  projectId: 'consuelo-cloud-dev-igg2mr',
  zone: 'us-east1-b',
  name: 'consuelo-ko-cloud-1-data',
  sizeGb: 100,
  type: 'pd-balanced',
  deviceName: 'consuelo-data',
  autoDelete: false as const,
  snapshotPolicies: [
    'consuelo-os-data-daily-90d',
    'consuelo-os-data-weekly-1y',
  ],
  labels,
};

const instance = {
  projectId: 'consuelo-cloud-dev-igg2mr',
  zone: 'us-east1-b',
  name: 'consuelo-ko-cloud-1',
  machineType: 'e2-standard-2',
  network: 'consuelo-os-cloud',
  subnet: 'consuelo-os-cloud-us-east1',
  noExternalIp: true as const,
  serviceAccountEmail:
    'consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  tags: ['consuelo-os-cloud-admin', 'consuelo-os-cloud-node'],
  bootDisk: {
    sizeGb: 30,
    type: 'pd-balanced',
    imageFamily: 'debian-12',
    imageProject: 'debian-cloud',
    autoDelete: true as const,
  },
  dataDisk: {
    name: 'consuelo-ko-cloud-1-data',
    deviceName: 'consuelo-data',
    autoDelete: false as const,
  },
  shielded: {
    secureBoot: true as const,
    vTPM: true as const,
    integrityMonitoring: true as const,
  },
  metadata: {
    'enable-oslogin': 'TRUE',
    'block-project-ssh-keys': 'TRUE',
    'serial-port-enable': 'TRUE',
    'startup-script': '#!/usr/bin/env bash\necho ready\n',
  },
  labels,
};

describe('gcloud managed cloud node instance adapter', () => {
  it('describes before creating the retained data disk and attaching policies', async () => {
    const { createGcloudManagedCloudNodeClient } = await loadContract();
    const calls: string[][] = [];
    const client = createGcloudManagedCloudNodeClient({
      run: async (args) => {
        calls.push(args);
        if (args.includes('describe')) return missing();
        return ok('{}');
      },
    });

    await expect(client.ensureDataDisk(dataDisk)).resolves.toBe('created');
    await expect(
      client.ensureSnapshotPolicyAttachment({
        projectId: dataDisk.projectId,
        zone: dataDisk.zone,
        diskName: dataDisk.name,
        policyName: 'consuelo-os-data-daily-90d',
      }),
    ).resolves.toBe('created');

    expect(calls).toContainEqual([
      'compute',
      'disks',
      'describe',
      'consuelo-ko-cloud-1-data',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--zone',
      'us-east1-b',
      '--format',
      'json',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'disks',
      'create',
      'consuelo-ko-cloud-1-data',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--zone',
      'us-east1-b',
      '--size',
      '100GB',
      '--type',
      'pd-balanced',
      '--labels',
      'consuelo-managed=true,consuelo-node-id=ko-cloud-1,consuelo-product=os-cloud,consuelo-workspace-id=workspace-kokayi',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'disks',
      'add-resource-policies',
      'consuelo-ko-cloud-1-data',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--zone',
      'us-east1-b',
      '--resource-policies',
      'consuelo-os-data-daily-90d',
      '--quiet',
    ]);
  });

  it('creates a no-public-IP Shielded VM with retained data disk and startup file', async () => {
    const { createGcloudManagedCloudNodeClient } = await loadContract();
    const calls: string[][] = [];
    let startupScript = '';
    const client = createGcloudManagedCloudNodeClient({
      run: async (args) => {
        calls.push(args);
        if (args.includes('describe')) return missing();
        const metadataArgument = args.find((arg) =>
          arg.startsWith('startup-script='),
        );
        if (metadataArgument) {
          startupScript = readFileSync(
            metadataArgument.slice('startup-script='.length),
            'utf8',
          );
        }
        return ok('{}');
      },
    });

    await expect(client.ensureInstance(instance)).resolves.toBe('created');
    expect(startupScript).toBe(instance.metadata['startup-script']);

    const create = calls.find(
      (args) =>
        args[0] === 'compute' &&
        args[1] === 'instances' &&
        args[2] === 'create',
    );
    expect(create).toBeDefined();
    expect(create).toEqual(
      expect.arrayContaining([
        'consuelo-ko-cloud-1',
        '--project',
        'consuelo-cloud-dev-igg2mr',
        '--zone',
        'us-east1-b',
        '--machine-type',
        'e2-standard-2',
        '--network',
        'consuelo-os-cloud',
        '--subnet',
        'consuelo-os-cloud-us-east1',
        '--no-address',
        '--service-account',
        instance.serviceAccountEmail,
        '--scopes',
        'https://www.googleapis.com/auth/cloud-platform',
        '--image-family',
        'debian-12',
        '--image-project',
        'debian-cloud',
        '--boot-disk-size',
        '30GB',
        '--boot-disk-type',
        'pd-balanced',
        '--boot-disk-auto-delete',
        '--disk',
        'name=consuelo-ko-cloud-1-data,device-name=consuelo-data,mode=rw,boot=no,auto-delete=no',
        '--shielded-secure-boot',
        '--shielded-vtpm',
        '--shielded-integrity-monitoring',
        '--quiet',
      ]),
    );
    expect(create?.some((arg) => arg.startsWith('startup-script='))).toBe(true);
  });

  it('returns unchanged for exact disk, policy, and instance state', async () => {
    const { createGcloudManagedCloudNodeClient } = await loadContract();
    const client = createGcloudManagedCloudNodeClient({
      run: async (args) => {
        const command = args.join(' ');
        if (command.includes('compute disks describe')) {
          return ok(
            JSON.stringify({
              name: dataDisk.name,
              sizeGb: String(dataDisk.sizeGb),
              type: `projects/fixture/zones/${dataDisk.zone}/diskTypes/${dataDisk.type}`,
              zone: `projects/fixture/zones/${dataDisk.zone}`,
              labels,
              resourcePolicies: [
                'projects/fixture/regions/us-east1/resourcePolicies/consuelo-os-data-daily-90d',
              ],
            }),
          );
        }
        if (command.includes('compute instances describe')) {
          return ok(
            JSON.stringify({
              name: instance.name,
              zone: `projects/fixture/zones/${instance.zone}`,
              machineType: `projects/fixture/zones/${instance.zone}/machineTypes/${instance.machineType}`,
              networkInterfaces: [
                {
                  network: `projects/fixture/global/networks/${instance.network}`,
                  subnetwork: `projects/fixture/regions/us-east1/subnetworks/${instance.subnet}`,
                  accessConfigs: [],
                },
              ],
              serviceAccounts: [
                {
                  email: instance.serviceAccountEmail,
                  scopes: instance.scopes,
                },
              ],
              tags: { items: instance.tags },
              labels,
              disks: [
                {
                  boot: true,
                  autoDelete: true,
                  deviceName: instance.name,
                  source: `projects/fixture/zones/${instance.zone}/disks/${instance.name}`,
                },
                {
                  boot: false,
                  autoDelete: false,
                  deviceName: instance.dataDisk.deviceName,
                  source: `projects/fixture/zones/${instance.zone}/disks/${instance.dataDisk.name}`,
                },
              ],
              shieldedInstanceConfig: {
                enableSecureBoot: true,
                enableVtpm: true,
                enableIntegrityMonitoring: true,
              },
              metadata: {
                items: Object.entries(instance.metadata).map(([key, value]) => ({
                  key,
                  value,
                })),
              },
            }),
          );
        }
        throw new Error(`unexpected mutation: ${command}`);
      },
    });

    await expect(client.ensureDataDisk(dataDisk)).resolves.toBe('unchanged');
    await expect(
      client.ensureSnapshotPolicyAttachment({
        projectId: dataDisk.projectId,
        zone: dataDisk.zone,
        diskName: dataDisk.name,
        policyName: 'consuelo-os-data-daily-90d',
      }),
    ).resolves.toBe('unchanged');
    await expect(client.ensureInstance(instance)).resolves.toBe('unchanged');
  });

  it('fails closed on disk or instance drift and unexpected reads', async () => {
    const { createGcloudManagedCloudNodeClient } = await loadContract();
    const drift = createGcloudManagedCloudNodeClient({
      run: async (args) => {
        if (args.join(' ').includes('disks describe')) {
          return ok(
            JSON.stringify({
              name: dataDisk.name,
              sizeGb: '10',
              type: 'diskTypes/pd-standard',
              zone: `zones/${dataDisk.zone}`,
              labels,
            }),
          );
        }
        return ok('{}');
      },
    });
    await expect(drift.ensureDataDisk(dataDisk)).rejects.toThrow(/drift/i);

    const failedRead = createGcloudManagedCloudNodeClient({
      run: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'PERMISSION_DENIED: compute.instances.get denied',
      }),
    });
    await expect(failedRead.ensureInstance(instance)).rejects.toThrow(
      /PERMISSION_DENIED.*compute\.instances\.get denied/,
    );
  });
});
