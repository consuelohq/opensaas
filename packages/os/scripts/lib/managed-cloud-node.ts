export type ManagedNodeLifecycle =
  | 'requested'
  | 'provisioning'
  | 'booting'
  | 'enrolling'
  | 'online'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'deleting';

export type ManagedNodeHosting = {
  kind: 'consuelo-managed';
  provider: 'gcp';
  providerProjectId: string;
  providerResourceId?: string;
  region: string;
  zone?: string;
  lifecycle: ManagedNodeLifecycle;
};

export type FoundationResourceStatus = 'created' | 'unchanged';

export type ManagedCloudNodeFoundationClient = {
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
  ensureSnapshotPolicy: (input: ManagedCloudNodeSnapshotPolicy & {
    projectId: string;
    region: string;
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

export type ManagedCloudNodeSnapshotPolicy = {
  name: string;
  frequency: 'daily' | 'weekly';
  startTime: string;
  retentionDays: number;
  weekday?: string;
  keepAfterDiskDelete: boolean;
};

export type ManagedCloudNodeFoundationPlan = {
  provider: 'gcp';
  projectId: string;
  billingAccountId: string;
  region: string;
  labels: Record<string, string>;
  services: string[];
  network: { name: string };
  subnet: { name: string; cidr: string };
  firewallRules: Array<{
    name: string;
    sourceRanges: string[];
    targetTags: string[];
    allowed: string[];
  }>;
  serviceAccount: {
    accountId: string;
    displayName: string;
    roles: string[];
  };
  snapshotPolicies: ManagedCloudNodeSnapshotPolicy[];
  budget: {
    displayName: string;
    amountUsd: number;
    thresholdPercents: number[];
  };
};

export type ManagedCloudNodeFoundationOperation = {
  resource: string;
  status: 'planned' | FoundationResourceStatus;
};

export class ManagedCloudNodeError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManagedCloudNodeError';
    this.code = code;
  }
}

export const MANAGED_NODE_DATA_RETENTION = {
  vmDeletePreservesDataDisk: true,
  ordinaryNodeDeletePreservesData: true,
  permanentDataDeletionRequiresExplicitAction: true,
} as const;

const DEFAULT_SERVICES = [
  'billingbudgets.googleapis.com',
  'cloudbilling.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'compute.googleapis.com',
  'iam.googleapis.com',
  'iamcredentials.googleapis.com',
  'logging.googleapis.com',
  'monitoring.googleapis.com',
  'serviceusage.googleapis.com',
] as const;

const requireNonEmpty = (value: string, name: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      `${name} is required`,
    );
  }
  return normalized;
};

export const planManagedCloudNodeFoundation = (input: {
  projectId: string;
  billingAccountId: string;
  region?: string;
  budgetAmountUsd?: number;
}): ManagedCloudNodeFoundationPlan => {
  const projectId = requireNonEmpty(input.projectId, 'projectId');
  const billingAccountId = requireNonEmpty(
    input.billingAccountId,
    'billingAccountId',
  );
  const region = input.region?.trim() || 'us-east1';
  const budgetAmountUsd = input.budgetAmountUsd ?? 100;
  if (!Number.isFinite(budgetAmountUsd) || budgetAmountUsd <= 0) {
    throw new ManagedCloudNodeError(
      'MANAGED_NODE_INPUT_INVALID',
      'budgetAmountUsd must be greater than zero',
    );
  }

  const labels = {
    'consuelo-managed': 'true',
    'consuelo-environment': 'development',
    'consuelo-product': 'os-cloud',
  };

  return {
    provider: 'gcp',
    projectId,
    billingAccountId,
    region,
    labels,
    services: [...DEFAULT_SERVICES],
    network: { name: 'consuelo-os-cloud' },
    subnet: {
      name: `consuelo-os-cloud-${region}`,
      cidr: '10.70.0.0/20',
    },
    firewallRules: [
      {
        name: 'consuelo-os-cloud-allow-iap-ssh',
        sourceRanges: ['35.235.240.0/20'],
        targetTags: ['consuelo-os-cloud-admin'],
        allowed: ['tcp:22'],
      },
    ],
    serviceAccount: {
      accountId: 'consuelo-os-node',
      displayName: 'Consuelo OS managed cloud node',
      roles: ['roles/logging.logWriter', 'roles/monitoring.metricWriter'],
    },
    snapshotPolicies: [
      {
        name: 'consuelo-os-data-daily-90d',
        frequency: 'daily',
        startTime: '07:00',
        retentionDays: 90,
        keepAfterDiskDelete: true,
      },
      {
        name: 'consuelo-os-data-weekly-1y',
        frequency: 'weekly',
        weekday: 'sunday',
        startTime: '08:00',
        retentionDays: 365,
        keepAfterDiskDelete: true,
      },
    ],
    budget: {
      displayName: 'Consuelo Cloud Dev monthly budget',
      amountUsd: budgetAmountUsd,
      thresholdPercents: [0.5, 0.8, 1],
    },
  };
};

const plannedOperations = (
  plan: ManagedCloudNodeFoundationPlan,
): ManagedCloudNodeFoundationOperation[] => [
  ...plan.services.map((service) => ({
    resource: `service:${service}`,
    status: 'planned' as const,
  })),
  { resource: `network:${plan.network.name}`, status: 'planned' },
  { resource: `subnet:${plan.subnet.name}`, status: 'planned' },
  ...plan.firewallRules.map((rule) => ({
    resource: `firewall:${rule.name}`,
    status: 'planned' as const,
  })),
  {
    resource: `service-account:${plan.serviceAccount.accountId}`,
    status: 'planned',
  },
  ...plan.serviceAccount.roles.map((role) => ({
    resource: `iam:${role}`,
    status: 'planned' as const,
  })),
  ...plan.snapshotPolicies.map((policy) => ({
    resource: `snapshot-policy:${policy.name}`,
    status: 'planned' as const,
  })),
  { resource: `budget:${plan.budget.displayName}`, status: 'planned' },
];

export const applyManagedCloudNodeFoundation = async (input: {
  client: ManagedCloudNodeFoundationClient;
  plan: ManagedCloudNodeFoundationPlan;
  dryRun?: boolean;
}): Promise<{
  status: 'planned' | 'provisioned';
  operations: ManagedCloudNodeFoundationOperation[];
}> => {
  if (input.dryRun) {
    return { status: 'planned', operations: plannedOperations(input.plan) };
  }

  const operations: ManagedCloudNodeFoundationOperation[] = [];
  const record = async (
    resource: string,
    operation: () => Promise<FoundationResourceStatus>,
  ): Promise<void> => {
    try {
      operations.push({ resource, status: await operation() });
    } catch (error: unknown) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_FOUNDATION_FAILED',
        `managed cloud node foundation failed at ${resource}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  };

  for (const service of input.plan.services) {
    await record(`service:${service}`, () => input.client.ensureService(service));
  }
  await record(`network:${input.plan.network.name}`, () =>
    input.client.ensureNetwork({
      name: input.plan.network.name,
      projectId: input.plan.projectId,
    }),
  );
  await record(`subnet:${input.plan.subnet.name}`, () =>
    input.client.ensureSubnet({
      name: input.plan.subnet.name,
      projectId: input.plan.projectId,
      network: input.plan.network.name,
      region: input.plan.region,
      cidr: input.plan.subnet.cidr,
    }),
  );
  for (const rule of input.plan.firewallRules) {
    await record(`firewall:${rule.name}`, () =>
      input.client.ensureFirewallRule({
        ...rule,
        projectId: input.plan.projectId,
        network: input.plan.network.name,
      }),
    );
  }
  await record(`service-account:${input.plan.serviceAccount.accountId}`, () =>
    input.client.ensureServiceAccount({
      accountId: input.plan.serviceAccount.accountId,
      displayName: input.plan.serviceAccount.displayName,
      projectId: input.plan.projectId,
    }),
  );
  const serviceAccountMember = `serviceAccount:${input.plan.serviceAccount.accountId}@${input.plan.projectId}.iam.gserviceaccount.com`;
  for (const role of input.plan.serviceAccount.roles) {
    await record(`iam:${role}`, () =>
      input.client.ensureProjectRoleBinding({
        member: serviceAccountMember,
        projectId: input.plan.projectId,
        role,
      }),
    );
  }
  for (const policy of input.plan.snapshotPolicies) {
    await record(`snapshot-policy:${policy.name}`, () =>
      input.client.ensureSnapshotPolicy({
        ...policy,
        projectId: input.plan.projectId,
        region: input.plan.region,
        labels: input.plan.labels,
      }),
    );
  }
  await record(`budget:${input.plan.budget.displayName}`, () =>
    input.client.ensureBudget({
      billingAccountId: input.plan.billingAccountId,
      displayName: input.plan.budget.displayName,
      projectId: input.plan.projectId,
      amountUsd: input.plan.budget.amountUsd,
      thresholdPercents: input.plan.budget.thresholdPercents,
    }),
  );

  return { status: 'provisioned', operations };
};

export const waitForManagedCloudOperation = async (input: {
  operationId: string;
  getOperation: (operationId: string) => Promise<{
    status: 'pending' | 'done';
    error?: { code: string; message: string };
  }>;
  sleep: (milliseconds: number) => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{ status: 'done' }> => {
  const intervalMs = input.intervalMs ?? 1_000;
  const timeoutMs = input.timeoutMs ?? 120_000;
  let elapsedMs = 0;

  while (elapsedMs <= timeoutMs) {
    let operation: Awaited<ReturnType<typeof input.getOperation>>;
    try {
      operation = await input.getOperation(input.operationId);
    } catch (error: unknown) {
      throw new ManagedCloudNodeError(
        'MANAGED_NODE_OPERATION_READ_FAILED',
        `failed to read managed cloud operation ${input.operationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
    if (operation.status === 'done') {
      if (operation.error) {
        throw new ManagedCloudNodeError(
          operation.error.code,
          `${operation.error.code}: ${operation.error.message}`,
        );
      }
      return { status: 'done' };
    }
    if (elapsedMs === timeoutMs) break;
    await input.sleep(intervalMs);
    elapsedMs = Math.min(timeoutMs, elapsedMs + intervalMs);
  }

  throw new ManagedCloudNodeError(
    'MANAGED_NODE_OPERATION_TIMEOUT',
    `managed cloud operation timed out: ${input.operationId}`,
  );
};
