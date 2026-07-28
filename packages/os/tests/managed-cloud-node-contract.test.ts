import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type FoundationResourceStatus = 'created' | 'unchanged';

type ManagedCloudNodeFoundationClient = {
  ensureService: (service: string) => Promise<FoundationResourceStatus>;
  ensureNetwork: (input: {
    name: string;
    projectId: string;
  }) => Promise<FoundationResourceStatus>;
  ensureSubnet: (input: {
    name: string;
    projectId: string;
    network: string;
    region: string;
    cidr: string;
  }) => Promise<FoundationResourceStatus>;
  ensureRouter: (input: {
    name: string;
    projectId: string;
    region: string;
    network: string;
    asn: number;
  }) => Promise<FoundationResourceStatus>;
  ensureNat: (input: {
    name: string;
    projectId: string;
    region: string;
    router: string;
    sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES';
    autoAllocateExternalIps: true;
    logging: { enabled: true; filter: 'ERRORS_ONLY' };
  }) => Promise<FoundationResourceStatus>;
  ensureFirewallRule: (input: {
    name: string;
    projectId: string;
    network: string;
    sourceRanges: string[];
    targetTags: string[];
    allowed: string[];
  }) => Promise<FoundationResourceStatus>;
  ensureServiceAccount: (input: {
    accountId: string;
    displayName: string;
    projectId: string;
  }) => Promise<FoundationResourceStatus>;
  ensureProjectRoleBinding: (input: {
    member: string;
    projectId: string;
    role: string;
  }) => Promise<FoundationResourceStatus>;
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
  }) => Promise<FoundationResourceStatus>;
  ensureBudget: (input: {
    billingAccountId: string;
    displayName: string;
    projectId: string;
    amountUsd: number;
    thresholdPercents: number[];
  }) => Promise<FoundationResourceStatus>;
};

type ManagedCloudNodeContract = {
  MANAGED_NODE_DATA_RETENTION: {
    vmDeletePreservesDataDisk: true;
    ordinaryNodeDeletePreservesData: true;
    permanentDataDeletionRequiresExplicitAction: true;
  };
  planManagedCloudNodeFoundation: (input: {
    projectId: string;
    billingAccountId: string;
    region?: string;
    budgetAmountUsd?: number;
  }) => {
    provider: 'gcp';
    projectId: string;
    region: string;
    labels: Record<string, string>;
    services: string[];
    network: { name: string };
    subnet: { name: string; cidr: string };
    router: { name: string; asn: number };
    nat: {
      name: string;
      router: string;
      sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES';
      autoAllocateExternalIps: true;
      logging: { enabled: true; filter: 'ERRORS_ONLY' };
    };
    firewallRules: Array<{
      name: string;
      sourceRanges: string[];
      targetTags: string[];
      allowed: string[];
    }>;
    serviceAccount: { accountId: string; displayName: string; roles: string[] };
    snapshotPolicies: Array<{
      name: string;
      frequency: 'daily' | 'weekly';
      retentionDays: number;
      weekday?: string;
      keepAfterDiskDelete: boolean;
    }>;
    budget: { amountUsd: number; thresholdPercents: number[] };
  };
  applyManagedCloudNodeFoundation: (input: {
    client: ManagedCloudNodeFoundationClient;
    plan: ReturnType<ManagedCloudNodeContract['planManagedCloudNodeFoundation']>;
    dryRun?: boolean;
  }) => Promise<{
    status: 'planned' | 'provisioned';
    operations: Array<{ resource: string; status: 'planned' | FoundationResourceStatus }>;
  }>;
  waitForManagedCloudOperation: (input: {
    operationId: string;
    getOperation: (operationId: string) => Promise<{
      status: 'pending' | 'done';
      error?: { code: string; message: string };
    }>;
    sleep: (milliseconds: number) => Promise<void>;
    intervalMs?: number;
    timeoutMs?: number;
  }) => Promise<{ status: 'done' }>;
};

async function loadContract(): Promise<ManagedCloudNodeContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'managed-cloud-node.ts'),
  ).href;
  return (await import(modulePath)) as ManagedCloudNodeContract;
}

const createFixtureClient = () => {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const call = async (
    operation: string,
    input: unknown,
  ): Promise<FoundationResourceStatus> => {
    calls.push({ operation, input });
    return 'created';
  };
  const client: ManagedCloudNodeFoundationClient = {
    ensureService: async (service) => call('ensureService', service),
    ensureNetwork: async (input) => call('ensureNetwork', input),
    ensureSubnet: async (input) => call('ensureSubnet', input),
    ensureRouter: async (input) => call('ensureRouter', input),
    ensureNat: async (input) => call('ensureNat', input),
    ensureFirewallRule: async (input) => call('ensureFirewallRule', input),
    ensureServiceAccount: async (input) => call('ensureServiceAccount', input),
    ensureProjectRoleBinding: async (input) =>
      call('ensureProjectRoleBinding', input),
    ensureSnapshotPolicy: async (input) => call('ensureSnapshotPolicy', input),
    ensureBudget: async (input) => call('ensureBudget', input),
  };
  return { calls, client };
};

describe('managed cloud node foundation contract', () => {
  it('plans deterministic GCP foundation resources with durable data retention', async () => {
    const { MANAGED_NODE_DATA_RETENTION, planManagedCloudNodeFoundation } =
      await loadContract();
    const first = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
    });
    const second = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      provider: 'gcp',
      projectId: 'consuelo-cloud-dev-igg2mr',
      region: 'us-east1',
      labels: {
        'consuelo-managed': 'true',
        'consuelo-environment': 'development',
        'consuelo-product': 'os-cloud',
      },
      network: { name: 'consuelo-os-cloud' },
      subnet: { name: 'consuelo-os-cloud-us-east1', cidr: '10.70.0.0/20' },
      router: { name: 'consuelo-os-cloud-us-east1-router', asn: 64514 },
      nat: {
        name: 'consuelo-os-cloud-us-east1-nat',
        router: 'consuelo-os-cloud-us-east1-router',
        sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES',
        autoAllocateExternalIps: true,
        logging: { enabled: true, filter: 'ERRORS_ONLY' },
      },
      serviceAccount: {
        accountId: 'consuelo-os-node',
        roles: ['roles/logging.logWriter', 'roles/monitoring.metricWriter'],
      },
      budget: {
        amountUsd: 100,
        thresholdPercents: [0.5, 0.8, 1],
      },
    });
    expect(first.services).toEqual(
      expect.arrayContaining([
        'compute.googleapis.com',
        'iam.googleapis.com',
        'iamcredentials.googleapis.com',
        'iap.googleapis.com',
        'billingbudgets.googleapis.com',
        'logging.googleapis.com',
        'monitoring.googleapis.com',
        'oslogin.googleapis.com',
      ]),
    );
    expect(first.firewallRules).toEqual([
      expect.objectContaining({
        name: 'consuelo-os-cloud-allow-iap-ssh',
        sourceRanges: ['35.235.240.0/20'],
        targetTags: ['consuelo-os-cloud-admin'],
        allowed: ['tcp:22'],
      }),
    ]);
    expect(first.snapshotPolicies).toEqual([
      expect.objectContaining({
        frequency: 'daily',
        retentionDays: 90,
        keepAfterDiskDelete: true,
      }),
      expect.objectContaining({
        frequency: 'weekly',
        retentionDays: 365,
        weekday: 'sunday',
        keepAfterDiskDelete: true,
      }),
    ]);
    expect(MANAGED_NODE_DATA_RETENTION).toEqual({
      vmDeletePreservesDataDisk: true,
      ordinaryNodeDeletePreservesData: true,
      permanentDataDeletionRequiresExplicitAction: true,
    });
  });

  it('returns a complete dry-run without calling the provider', async () => {
    const { applyManagedCloudNodeFoundation, planManagedCloudNodeFoundation } =
      await loadContract();
    const fixture = createFixtureClient();
    const plan = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
    });

    const result = await applyManagedCloudNodeFoundation({
      client: fixture.client,
      plan,
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.operations.length).toBeGreaterThan(10);
    expect(result.operations.every((operation) => operation.status === 'planned')).toBe(
      true,
    );
    expect(fixture.calls).toEqual([]);
  });

  it('applies every planned resource through idempotent ensure operations', async () => {
    const { applyManagedCloudNodeFoundation, planManagedCloudNodeFoundation } =
      await loadContract();
    const fixture = createFixtureClient();
    const plan = planManagedCloudNodeFoundation({
      projectId: 'consuelo-cloud-dev-igg2mr',
      billingAccountId: 'billing_fixture',
    });

    const result = await applyManagedCloudNodeFoundation({
      client: fixture.client,
      plan,
    });

    expect(result.status).toBe('provisioned');
    expect(fixture.calls.map((entry) => entry.operation)).toEqual([
      ...plan.services.map(() => 'ensureService'),
      'ensureNetwork',
      'ensureSubnet',
      'ensureRouter',
      'ensureNat',
      'ensureFirewallRule',
      'ensureServiceAccount',
      ...plan.serviceAccount.roles.map(() => 'ensureProjectRoleBinding'),
      'ensureSnapshotPolicy',
      'ensureSnapshotPolicy',
      'ensureBudget',
    ]);
    expect(result.operations.every((operation) => operation.status === 'created')).toBe(
      true,
    );
  });

  it('polls managed provider operations through success, provider failure, and timeout', async () => {
    const { waitForManagedCloudOperation } = await loadContract();
    let attempts = 0;
    await expect(
      waitForManagedCloudOperation({
        operationId: 'operation_fixture',
        getOperation: async () => {
          attempts += 1;
          return { status: attempts < 3 ? 'pending' : 'done' };
        },
        sleep: async () => {},
        intervalMs: 1,
        timeoutMs: 100,
      }),
    ).resolves.toEqual({ status: 'done' });
    expect(attempts).toBe(3);

    await expect(
      waitForManagedCloudOperation({
        operationId: 'operation_failed',
        getOperation: async () => ({
          status: 'done',
          error: { code: 'QUOTA_EXCEEDED', message: 'quota exhausted' },
        }),
        sleep: async () => {},
      }),
    ).rejects.toThrow(/QUOTA_EXCEEDED.*quota exhausted/);

    await expect(
      waitForManagedCloudOperation({
        operationId: 'operation_timeout',
        getOperation: async () => ({ status: 'pending' }),
        sleep: async () => {},
        intervalMs: 5,
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/timed out.*operation_timeout/i);
  });
});
