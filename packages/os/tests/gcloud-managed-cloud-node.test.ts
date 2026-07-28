import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (args: string[]) => Promise<CommandResult>;

type GcloudManagedCloudNodeContract = {
  createGcloudManagedCloudNodeFoundationClient: (input: {
    projectId: string;
    billingAccountId: string;
    run: CommandRunner;
    sleep?: (milliseconds: number) => Promise<void>;
  }) => {
    ensureService: (service: string) => Promise<'created' | 'unchanged'>;
    ensureNetwork: (input: {
      name: string;
      projectId: string;
    }) => Promise<'created' | 'unchanged'>;
    ensureSubnet: (input: {
      name: string;
      projectId: string;
      network: string;
      region: string;
      cidr: string;
    }) => Promise<'created' | 'unchanged'>;
    ensureFirewallRule: (input: {
      name: string;
      projectId: string;
      network: string;
      sourceRanges: string[];
      targetTags: string[];
      allowed: string[];
    }) => Promise<'created' | 'unchanged'>;
    ensureServiceAccount: (input: {
      accountId: string;
      displayName: string;
      projectId: string;
    }) => Promise<'created' | 'unchanged'>;
    ensureProjectRoleBinding: (input: {
      member: string;
      projectId: string;
      role: string;
    }) => Promise<'created' | 'unchanged'>;
    ensureSnapshotPolicy: (input: {
      name: string;
      projectId: string;
      region: string;
      frequency: 'daily' | 'weekly';
      startTime: string;
      retentionDays: number;
      weekday?: string;
      keepAfterDiskDelete: boolean;
      labels: Record<string, string>;
    }) => Promise<'created' | 'unchanged'>;
    ensureBudget: (input: {
      billingAccountId: string;
      displayName: string;
      projectId: string;
      amountUsd: number;
      thresholdPercents: number[];
    }) => Promise<'created' | 'unchanged'>;
  };
};

async function loadContract(): Promise<GcloudManagedCloudNodeContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'gcloud-managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as GcloudManagedCloudNodeContract;
}

const ok = (stdout = ''): CommandResult => ({
  exitCode: 0,
  stdout,
  stderr: '',
});

const missing = (): CommandResult => ({
  exitCode: 1,
  stdout: '',
  stderr: 'ERROR: (gcloud) Could not fetch resource: NOT_FOUND',
});

const commandKey = (args: string[]): string => args.slice(0, 5).join(' ');

describe('gcloud managed cloud node adapter', () => {
  it('describes every resource before creating it with exact safe arguments', async () => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    const calls: string[][] = [];
    const run: CommandRunner = async (args) => {
      calls.push(args);
      const command = args.join(' ');
      if (
        command.includes('services list') ||
        command.includes('projects get-iam-policy') ||
        command.includes('billing budgets list')
      ) {
        return ok(command.includes('billing budgets list') ? '[]' : '');
      }
      if (command.includes(' describe ')) return missing();
      return ok('{}');
    };
    const client = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run,
    });

    await expect(client.ensureService('compute.googleapis.com')).resolves.toBe(
      'created',
    );
    await expect(
      client.ensureNetwork({
        name: 'consuelo-os-cloud',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureSubnet({
        name: 'consuelo-os-cloud-us-east1',
        projectId: 'consuelo-cloud-dev-igg2mr',
        network: 'consuelo-os-cloud',
        region: 'us-east1',
        cidr: '10.70.0.0/20',
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureFirewallRule({
        name: 'consuelo-os-cloud-allow-iap-ssh',
        projectId: 'consuelo-cloud-dev-igg2mr',
        network: 'consuelo-os-cloud',
        sourceRanges: ['35.235.240.0/20'],
        targetTags: ['consuelo-os-cloud-admin'],
        allowed: ['tcp:22'],
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureServiceAccount({
        accountId: 'consuelo-os-node',
        displayName: 'Consuelo OS managed cloud node',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureProjectRoleBinding({
        member:
          'serviceAccount:consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
        projectId: 'consuelo-cloud-dev-igg2mr',
        role: 'roles/logging.logWriter',
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureSnapshotPolicy({
        name: 'consuelo-os-data-weekly-1y',
        projectId: 'consuelo-cloud-dev-igg2mr',
        region: 'us-east1',
        frequency: 'weekly',
        weekday: 'sunday',
        startTime: '08:00',
        retentionDays: 365,
        keepAfterDiskDelete: true,
        labels: {
          'consuelo-managed': 'true',
          'consuelo-product': 'os-cloud',
        },
      }),
    ).resolves.toBe('created');
    await expect(
      client.ensureBudget({
        billingAccountId: 'billing_fixture',
        displayName: 'Consuelo Cloud Dev monthly budget',
        projectId: 'consuelo-cloud-dev-igg2mr',
        amountUsd: 100,
        thresholdPercents: [0.5, 0.8, 1],
      }),
    ).resolves.toBe('created');

    expect(calls).toContainEqual([
      'services',
      'enable',
      'compute.googleapis.com',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'networks',
      'create',
      'consuelo-os-cloud',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--subnet-mode',
      'custom',
      '--bgp-routing-mode',
      'regional',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'networks',
      'subnets',
      'create',
      'consuelo-os-cloud-us-east1',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--network',
      'consuelo-os-cloud',
      '--region',
      'us-east1',
      '--range',
      '10.70.0.0/20',
      '--enable-private-ip-google-access',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'firewall-rules',
      'create',
      'consuelo-os-cloud-allow-iap-ssh',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--network',
      'consuelo-os-cloud',
      '--direction',
      'INGRESS',
      '--priority',
      '1000',
      '--source-ranges',
      '35.235.240.0/20',
      '--target-tags',
      'consuelo-os-cloud-admin',
      '--allow',
      'tcp:22',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'iam',
      'service-accounts',
      'create',
      'consuelo-os-node',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--display-name',
      'Consuelo OS managed cloud node',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'projects',
      'add-iam-policy-binding',
      'consuelo-cloud-dev-igg2mr',
      '--member',
      'serviceAccount:consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
      '--role',
      'roles/logging.logWriter',
      '--condition',
      'None',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'compute',
      'resource-policies',
      'create',
      'snapshot-schedule',
      'consuelo-os-data-weekly-1y',
      '--project',
      'consuelo-cloud-dev-igg2mr',
      '--region',
      'us-east1',
      '--weekly-schedule',
      'sunday',
      '--start-time',
      '08:00',
      '--max-retention-days',
      '365',
      '--on-source-disk-delete',
      'keep-auto-snapshots',
      '--snapshot-labels',
      'consuelo-managed=true,consuelo-product=os-cloud',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'billing',
      'budgets',
      'create',
      '--billing-account',
      'billing_fixture',
      '--display-name',
      'Consuelo Cloud Dev monthly budget',
      '--budget-amount',
      '100USD',
      '--filter-projects',
      'projects/consuelo-cloud-dev-igg2mr',
      '--calendar-period',
      'month',
      '--threshold-rule',
      'percent=0.5',
      '--threshold-rule',
      'percent=0.8',
      '--threshold-rule',
      'percent=1',
      '--quiet',
    ]);
    expect(calls).toContainEqual([
      'billing',
      'budgets',
      'list',
      '--billing-account',
      'billing_fixture',
      '--format',
      'json',
    ]);
    expect(calls.map(commandKey)).toEqual(
      expect.arrayContaining([
        'services list --enabled --project consuelo-cloud-dev-igg2mr',
        'compute networks describe consuelo-os-cloud --project',
        'compute networks subnets describe consuelo-os-cloud-us-east1',
        'compute firewall-rules describe consuelo-os-cloud-allow-iap-ssh --project',
        'iam service-accounts describe consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com --project',
      ]),
    );
  });

  it('returns unchanged when the provider matches the desired state', async () => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    const run: CommandRunner = async (args) => {
      const command = args.join(' ');
      if (command.includes('services list')) return ok('compute.googleapis.com\n');
      if (command.includes('networks describe')) {
        return ok(JSON.stringify({ autoCreateSubnetworks: false, routingConfig: { routingMode: 'REGIONAL' } }));
      }
      if (command.includes('subnets describe')) {
        return ok(
          JSON.stringify({
            network:
              'https://www.googleapis.com/compute/v1/projects/fixture/global/networks/consuelo-os-cloud',
            ipCidrRange: '10.70.0.0/20',
            privateIpGoogleAccess: true,
          }),
        );
      }
      if (command.includes('firewall-rules describe')) {
        return ok(
          JSON.stringify({
            network:
              'https://www.googleapis.com/compute/v1/projects/fixture/global/networks/consuelo-os-cloud',
            direction: 'INGRESS',
            priority: 1000,
            sourceRanges: ['35.235.240.0/20'],
            targetTags: ['consuelo-os-cloud-admin'],
            allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
          }),
        );
      }
      if (command.includes('service-accounts describe')) {
        return ok(JSON.stringify({ displayName: 'Consuelo OS managed cloud node' }));
      }
      if (command.includes('projects get-iam-policy')) {
        return ok('roles/logging.logWriter\n');
      }
      if (command.includes('projects describe')) {
        return ok('117668798286\n');
      }
      if (command.includes('resource-policies describe')) {
        return ok(
          JSON.stringify({
            snapshotSchedulePolicy: {
              retentionPolicy: {
                maxRetentionDays: 365,
                onSourceDiskDelete: 'KEEP_AUTO_SNAPSHOTS',
              },
              schedule: {
                weeklySchedule: {
                  dayOfWeeks: [{ day: 'SUNDAY', startTime: '08:00' }],
                },
              },
              snapshotProperties: {
                labels: {
                  'consuelo-managed': 'true',
                  'consuelo-product': 'os-cloud',
                },
              },
            },
          }),
        );
      }
      if (command.includes('billing budgets list')) {
        return ok(
          JSON.stringify([
            {
              displayName: 'Consuelo Cloud Dev monthly budget',
              amount: { specifiedAmount: { currencyCode: 'USD', units: '100' } },
              thresholdRules: [
                { thresholdPercent: 0.5 },
                { thresholdPercent: 0.8 },
                { thresholdPercent: 1 },
              ],
              budgetFilter: {
                calendarPeriod: 'MONTH',
                projects: ['projects/117668798286'],
              },
            },
          ]),
        );
      }
      throw new Error(`unexpected mutating command: ${command}`);
    };
    const client = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run,
    });

    await expect(client.ensureService('compute.googleapis.com')).resolves.toBe(
      'unchanged',
    );
    await expect(
      client.ensureNetwork({
        name: 'consuelo-os-cloud',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureSubnet({
        name: 'consuelo-os-cloud-us-east1',
        projectId: 'consuelo-cloud-dev-igg2mr',
        network: 'consuelo-os-cloud',
        region: 'us-east1',
        cidr: '10.70.0.0/20',
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureFirewallRule({
        name: 'consuelo-os-cloud-allow-iap-ssh',
        projectId: 'consuelo-cloud-dev-igg2mr',
        network: 'consuelo-os-cloud',
        sourceRanges: ['35.235.240.0/20'],
        targetTags: ['consuelo-os-cloud-admin'],
        allowed: ['tcp:22'],
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureServiceAccount({
        accountId: 'consuelo-os-node',
        displayName: 'Consuelo OS managed cloud node',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureProjectRoleBinding({
        member:
          'serviceAccount:consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
        projectId: 'consuelo-cloud-dev-igg2mr',
        role: 'roles/logging.logWriter',
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureSnapshotPolicy({
        name: 'consuelo-os-data-weekly-1y',
        projectId: 'consuelo-cloud-dev-igg2mr',
        region: 'us-east1',
        frequency: 'weekly',
        weekday: 'sunday',
        startTime: '08:00',
        retentionDays: 365,
        keepAfterDiskDelete: true,
        labels: {
          'consuelo-managed': 'true',
          'consuelo-product': 'os-cloud',
        },
      }),
    ).resolves.toBe('unchanged');
    await expect(
      client.ensureBudget({
        billingAccountId: 'billing_fixture',
        displayName: 'Consuelo Cloud Dev monthly budget',
        projectId: 'consuelo-cloud-dev-igg2mr',
        amountUsd: 100,
        thresholdPercents: [0.5, 0.8, 1],
      }),
    ).resolves.toBe('unchanged');
  });

  it('fails closed when an existing resource drifts or a read fails unexpectedly', async () => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    const driftClient = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run: async (args) =>
        args.join(' ').includes('networks describe')
          ? ok(JSON.stringify({ autoCreateSubnetworks: true }))
          : ok(''),
    });
    await expect(
      driftClient.ensureNetwork({
        name: 'consuelo-os-cloud',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).rejects.toThrow(/drift.*consuelo-os-cloud/i);

    const failedReadClient = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'PERMISSION_DENIED: access denied',
      }),
    });
    await expect(
      failedReadClient.ensureNetwork({
        name: 'consuelo-os-cloud',
        projectId: 'consuelo-cloud-dev-igg2mr',
      }),
    ).rejects.toThrow(/PERMISSION_DENIED.*access denied/);
  });

  it('retries a project IAM binding while a newly created service account propagates', async () => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    let addAttempts = 0;
    const sleeps: number[] = [];
    const client = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
      run: async (args) => {
        const command = args.join(' ');
        if (command.includes('projects get-iam-policy')) return ok('');
        if (command.includes('projects add-iam-policy-binding')) {
          addAttempts += 1;
          return addAttempts < 3
            ? {
                exitCode: 1,
                stdout: '',
                stderr:
                  'INVALID_ARGUMENT: Service account consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com does not exist.',
              }
            : ok('{}');
        }
        throw new Error(`unexpected command: ${command}`);
      },
    });

    await expect(
      client.ensureProjectRoleBinding({
        member:
          'serviceAccount:consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com',
        projectId: 'consuelo-cloud-dev-igg2mr',
        role: 'roles/logging.logWriter',
      }),
    ).resolves.toBe('created');
    expect(addAttempts).toBe(3);
    expect(sleeps).toEqual([1_000, 2_000]);
  });

  it('fails closed when duplicate managed budgets already exist', async () => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    const client = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run: async (args) => {
        if (args.join(' ').includes('billing budgets list')) {
          return ok(
            JSON.stringify([
              {
                displayName: 'Consuelo Cloud Dev monthly budget',
                amount: { specifiedAmount: { currencyCode: 'USD', units: '100' } },
                thresholdRules: [{ thresholdPercent: 0.5 }],
              },
              {
                displayName: 'Consuelo Cloud Dev monthly budget',
                amount: { specifiedAmount: { currencyCode: 'USD', units: '100' } },
                thresholdRules: [{ thresholdPercent: 0.5 }],
              },
            ]),
          );
        }
        throw new Error(`unexpected command: ${args.join(' ')}`);
      },
    });

    await expect(
      client.ensureBudget({
        billingAccountId: 'billing_fixture',
        displayName: 'Consuelo Cloud Dev monthly budget',
        projectId: 'consuelo-cloud-dev-igg2mr',
        amountUsd: 100,
        thresholdPercents: [0.5],
      }),
    ).rejects.toThrow(/multiple budgets.*same display name/i);
  });

  it.each([
    {
      name: 'another project',
      budgetFilter: {
        calendarPeriod: 'MONTH',
        projects: ['projects/999999999999'],
      },
      currencyCode: 'USD',
    },
    {
      name: 'a non-monthly period',
      budgetFilter: {
        calendarPeriod: 'YEAR',
        projects: ['projects/117668798286'],
      },
      currencyCode: 'USD',
    },
    {
      name: 'a non-USD currency',
      budgetFilter: {
        calendarPeriod: 'MONTH',
        projects: ['projects/117668798286'],
      },
      currencyCode: 'EUR',
    },
  ])('fails closed when an existing managed budget targets $name', async (fixture) => {
    const { createGcloudManagedCloudNodeFoundationClient } = await loadContract();
    const client = createGcloudManagedCloudNodeFoundationClient({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
      run: async (args) => {
        const command = args.join(' ');
        if (command.includes('projects describe')) return ok('117668798286\n');
        if (command.includes('billing budgets list')) {
          return ok(
            JSON.stringify([
              {
                displayName: 'Consuelo Cloud Dev monthly budget',
                amount: {
                  specifiedAmount: {
                    currencyCode: fixture.currencyCode,
                    units: '100',
                  },
                },
                thresholdRules: [
                  { thresholdPercent: 0.5 },
                  { thresholdPercent: 0.8 },
                  { thresholdPercent: 1 },
                ],
                budgetFilter: fixture.budgetFilter,
              },
            ]),
          );
        }
        throw new Error(`unexpected command: ${command}`);
      },
    });

    await expect(
      client.ensureBudget({
        billingAccountId: 'billing_fixture',
        displayName: 'Consuelo Cloud Dev monthly budget',
        projectId: 'consuelo-cloud-dev-igg2mr',
        amountUsd: 100,
        thresholdPercents: [0.5, 0.8, 1],
      }),
    ).rejects.toThrow(/budget.*drift|drift.*budget/i);
  });
});
