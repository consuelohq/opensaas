import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  FoundationResourceStatus,
  ManagedCloudNodeClient,
  ManagedCloudNodeFoundationClient,
  ManagedCloudNodeInstance,
} from './managed-cloud-node';

export type GcloudCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type GcloudCommandRunner = (
  args: string[],
) => Promise<GcloudCommandResult>;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const commandText = (args: string[]): string => `gcloud ${args.join(' ')}`;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const withContext = (context: string, error: unknown): Error =>
  new Error(`${context}: ${getErrorMessage(error)}`, { cause: error });

const commandFailure = (args: string[], result: GcloudCommandResult): Error =>
  new Error(
    `${commandText(args)} failed: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`}`,
  );

const isMissingResult = (result: GcloudCommandResult): boolean =>
  result.exitCode !== 0 &&
  /(?:NOT_FOUND|not found|was not found)/i.test(result.stderr);

const runRequired = async (
  run: GcloudCommandRunner,
  args: string[],
): Promise<GcloudCommandResult> => {
  const result = await run(args);
  if (result.exitCode !== 0) throw commandFailure(args, result);
  return result;
};

const parseJson = (text: string, context: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    throw new Error(
      `${context} returned malformed JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
};

const readJsonResource = async (
  run: GcloudCommandRunner,
  args: string[],
): Promise<JsonRecord | null> => {
  let result: GcloudCommandResult;
  try {
    result = await run(args);
  } catch (error: unknown) {
    throw withContext(`${commandText(args)} read failed`, error);
  }
  if (isMissingResult(result)) return null;
  if (result.exitCode !== 0) throw commandFailure(args, result);
  const parsed = parseJson(result.stdout, commandText(args));
  if (!isRecord(parsed)) {
    throw new Error(`${commandText(args)} returned a non-object resource`);
  }
  return parsed;
};

const sorted = (values: string[]): string[] => [...values].sort();

const sameStrings = (left: string[], right: string[]): boolean =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

const resourceTail = (value: unknown): string => {
  const text = typeof value === 'string' ? value : '';
  return text.split('/').filter(Boolean).at(-1) ?? '';
};

const failDrift = (resource: string, details: string): never => {
  throw new Error(
    `managed cloud resource drift detected for ${resource}: ${details}`,
  );
};

const labelsArgument = (labels: Record<string, string>): string =>
  Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

const recordString = (record: JsonRecord, key: string): string =>
  typeof record[key] === 'string' ? record[key] : '';

const recordNumber = (record: JsonRecord, key: string): number => {
  const value = record[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
};

const recordBoolean = (record: JsonRecord, key: string): boolean | undefined =>
  typeof record[key] === 'boolean' ? record[key] : undefined;

const recordStrings = (record: JsonRecord, key: string): string[] =>
  Array.isArray(record[key])
    ? (record[key] as unknown[]).filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

const recordEntries = (record: JsonRecord, key: string): JsonRecord[] =>
  Array.isArray(record[key]) ? (record[key] as unknown[]).filter(isRecord) : [];

const labelsMatch = (
  existing: unknown,
  expected: Record<string, string>,
): boolean => {
  if (!isRecord(existing)) return false;
  return Object.entries(expected).every(
    ([key, value]) => existing[key] === value,
  );
};

const metadataRecord = (resource: JsonRecord): Record<string, string> => {
  const metadata = isRecord(resource.metadata) ? resource.metadata : {};
  return Object.fromEntries(
    recordEntries(metadata, 'items')
      .map(
        (item) =>
          [recordString(item, 'key'), recordString(item, 'value')] as const,
      )
      .filter(([key]) => key),
  );
};

const ensureDataDiskMatches = (
  input: {
    name: string;
    zone: string;
    sizeGb: number;
    type: string;
    labels: Record<string, string>;
  },
  resource: JsonRecord,
): void => {
  if (
    recordString(resource, 'name') !== input.name ||
    resourceTail(resource.zone) !== input.zone ||
    recordNumber(resource, 'sizeGb') !== input.sizeGb ||
    resourceTail(resource.type) !== input.type ||
    !labelsMatch(resource.labels, input.labels)
  ) {
    failDrift(
      input.name,
      'data disk does not match size, type, zone, or labels',
    );
  }
};

const canonicalManagedNodeStartupScript = (value: string): string =>
  value.replace(
    /ALLOW_DATA_DISK_FORMAT='(?:true|false)'/,
    "ALLOW_DATA_DISK_FORMAT='<one-time-authorization>'",
  );

const ensureInstanceMatches = (
  input: ManagedCloudNodeInstance & {
    projectId: string;
    zone: string;
    labels: Record<string, string>;
  },
  resource: JsonRecord,
): void => {
  const interfaces = recordEntries(resource, 'networkInterfaces');
  const networkInterface = interfaces[0] ?? {};
  const serviceAccounts = recordEntries(resource, 'serviceAccounts');
  const serviceAccount = serviceAccounts[0] ?? {};
  const tags = isRecord(resource.tags)
    ? recordStrings(resource.tags, 'items')
    : [];
  const disks = recordEntries(resource, 'disks');
  const bootDisk = disks.find((disk) => recordBoolean(disk, 'boot') === true);
  const attachedDataDisk = disks.find(
    (disk) => recordString(disk, 'deviceName') === input.dataDisk.deviceName,
  );
  const shielded = isRecord(resource.shieldedInstanceConfig)
    ? resource.shieldedInstanceConfig
    : {};
  const existingMetadata = metadataRecord(resource);
  const metadataMatches = Object.entries(input.metadata).every(
    ([key, value]) => {
      if (key === 'startup-script') {
        return (
          canonicalManagedNodeStartupScript(existingMetadata[key] ?? '') ===
          canonicalManagedNodeStartupScript(value)
        );
      }
      return existingMetadata[key] === value;
    },
  );
  const unexpectedExecutableMetadata = Object.keys(existingMetadata).some(
    (key) =>
      /^(?:startup-script-url|shutdown-script|shutdown-script-url|windows-(?:startup|shutdown)-script(?:-url)?)(?:$|-)/i.test(
        key,
      ) && !(key in input.metadata),
  );
  const accessConfigs = Array.isArray(networkInterface.accessConfigs)
    ? networkInterface.accessConfigs
    : [];

  if (
    recordString(resource, 'name') !== input.name ||
    resourceTail(resource.zone) !== input.zone ||
    resourceTail(resource.machineType) !== input.machineType ||
    interfaces.length !== 1 ||
    resourceTail(networkInterface.network) !== input.network ||
    resourceTail(networkInterface.subnetwork) !== input.subnet ||
    accessConfigs.length !== 0 ||
    serviceAccounts.length !== 1 ||
    recordString(serviceAccount, 'email') !== input.serviceAccountEmail ||
    !sameStrings(recordStrings(serviceAccount, 'scopes'), input.scopes) ||
    !sameStrings(tags, input.tags) ||
    !labelsMatch(resource.labels, input.labels) ||
    !bootDisk ||
    recordBoolean(bootDisk, 'autoDelete') !== input.bootDisk.autoDelete ||
    recordNumber(bootDisk, 'diskSizeGb') !== input.bootDisk.sizeGb ||
    resourceTail(bootDisk.type) !== input.bootDisk.type ||
    !attachedDataDisk ||
    recordBoolean(attachedDataDisk, 'boot') !== false ||
    recordBoolean(attachedDataDisk, 'autoDelete') !== false ||
    recordString(attachedDataDisk, 'mode').toUpperCase() !== 'READ_WRITE' ||
    resourceTail(attachedDataDisk.source) !== input.dataDisk.name ||
    recordBoolean(shielded, 'enableSecureBoot') !== input.shielded.secureBoot ||
    recordBoolean(shielded, 'enableVtpm') !== input.shielded.vTPM ||
    recordBoolean(shielded, 'enableIntegrityMonitoring') !==
      input.shielded.integrityMonitoring ||
    !metadataMatches ||
    unexpectedExecutableMetadata
  ) {
    failDrift(
      input.name,
      'instance differs in compute, network, identity, disks, Shielded VM, labels, or metadata',
    );
  }
};

const ensureNetworkMatches = (name: string, resource: JsonRecord): void => {
  const autoCreateSubnetworks = recordBoolean(
    resource,
    'autoCreateSubnetworks',
  );
  const routingConfig = isRecord(resource.routingConfig)
    ? resource.routingConfig
    : {};
  const routingMode = recordString(routingConfig, 'routingMode').toUpperCase();
  if (autoCreateSubnetworks !== false || routingMode !== 'REGIONAL') {
    failDrift(name, 'expected custom subnet mode with REGIONAL routing');
  }
};

const ensureSubnetMatches = (
  input: { name: string; network: string; cidr: string },
  resource: JsonRecord,
): void => {
  if (
    resourceTail(resource.network) !== input.network ||
    recordString(resource, 'ipCidrRange') !== input.cidr ||
    recordBoolean(resource, 'privateIpGoogleAccess') !== true
  ) {
    failDrift(
      input.name,
      'expected network, CIDR, and private Google access to match the plan',
    );
  }
};

const ensureRouterMatches = (
  input: {
    name: string;
    region: string;
    network: string;
    asn: number;
  },
  resource: JsonRecord,
): void => {
  const bgp = isRecord(resource.bgp) ? resource.bgp : {};
  if (
    recordString(resource, 'name') !== input.name ||
    resourceTail(resource.region) !== input.region ||
    resourceTail(resource.network) !== input.network ||
    recordNumber(bgp, 'asn') !== input.asn
  ) {
    failDrift(input.name, 'router does not match region, network, or ASN');
  }
};

const ensureNatMatches = (
  input: {
    name: string;
    sourceSubnetworkIpRangesToNat: 'ALL_SUBNETWORKS_ALL_IP_RANGES';
    autoAllocateExternalIps: true;
    logging: { enabled: true; filter: 'ERRORS_ONLY' };
  },
  resource: JsonRecord,
): void => {
  const logConfig = isRecord(resource.logConfig) ? resource.logConfig : {};
  if (
    recordString(resource, 'name') !== input.name ||
    recordString(resource, 'natIpAllocateOption') !== 'AUTO_ONLY' ||
    recordString(resource, 'sourceSubnetworkIpRangesToNat') !==
      input.sourceSubnetworkIpRangesToNat ||
    recordBoolean(logConfig, 'enable') !== input.logging.enabled ||
    recordString(logConfig, 'filter') !== input.logging.filter
  ) {
    failDrift(
      input.name,
      'Cloud NAT does not match source ranges, allocation, or logging',
    );
  }
};

const firewallAllowed = (resource: JsonRecord): string[] => {
  if (!Array.isArray(resource.allowed)) return [];
  const values: string[] = [];
  for (const entry of resource.allowed) {
    if (!isRecord(entry)) continue;
    const protocol = recordString(entry, 'IPProtocol');
    const ports = recordStrings(entry, 'ports');
    if (ports.length === 0 && protocol) values.push(protocol);
    for (const port of ports) values.push(`${protocol}:${port}`);
  }
  return values;
};

const ensureFirewallMatches = (
  input: {
    name: string;
    network: string;
    sourceRanges: string[];
    targetTags: string[];
    allowed: string[];
  },
  resource: JsonRecord,
): void => {
  if (
    resourceTail(resource.network) !== input.network ||
    recordString(resource, 'direction').toUpperCase() !== 'INGRESS' ||
    recordNumber(resource, 'priority') !== 1_000 ||
    !sameStrings(recordStrings(resource, 'sourceRanges'), input.sourceRanges) ||
    !sameStrings(recordStrings(resource, 'targetTags'), input.targetTags) ||
    !sameStrings(firewallAllowed(resource), input.allowed)
  ) {
    failDrift(input.name, 'firewall rule does not match the approved policy');
  }
};

const readSnapshotPolicy = (resource: JsonRecord): JsonRecord => {
  if (!isRecord(resource.snapshotSchedulePolicy)) {
    throw new Error('snapshot resource is not a snapshot schedule policy');
  }
  return resource.snapshotSchedulePolicy;
};

const ensureSnapshotPolicyMatches = (
  input: {
    name: string;
    frequency: 'daily' | 'weekly';
    startTime: string;
    retentionDays: number;
    weekday?: string;
    keepAfterDiskDelete: boolean;
    labels: Record<string, string>;
  },
  resource: JsonRecord,
): void => {
  const policy = readSnapshotPolicy(resource);
  const retention = isRecord(policy.retentionPolicy)
    ? policy.retentionPolicy
    : {};
  const schedule = isRecord(policy.schedule) ? policy.schedule : {};
  const properties = isRecord(policy.snapshotProperties)
    ? policy.snapshotProperties
    : {};
  const existingLabels = isRecord(properties.labels) ? properties.labels : {};
  const expectedDeletePolicy = input.keepAfterDiskDelete
    ? 'KEEP_AUTO_SNAPSHOTS'
    : 'APPLY_RETENTION_POLICY';

  let scheduleMatches = false;
  if (input.frequency === 'daily' && isRecord(schedule.dailySchedule)) {
    scheduleMatches =
      recordString(schedule.dailySchedule, 'startTime') === input.startTime;
  }
  if (input.frequency === 'weekly' && isRecord(schedule.weeklySchedule)) {
    const days = Array.isArray(schedule.weeklySchedule.dayOfWeeks)
      ? schedule.weeklySchedule.dayOfWeeks
      : [];
    scheduleMatches = days.some(
      (day) =>
        isRecord(day) &&
        recordString(day, 'day').toLowerCase() ===
          input.weekday?.toLowerCase() &&
        recordString(day, 'startTime') === input.startTime,
    );
  }

  const labelsMatch = Object.entries(input.labels).every(
    ([key, value]) => existingLabels[key] === value,
  );
  if (
    recordNumber(retention, 'maxRetentionDays') !== input.retentionDays ||
    recordString(retention, 'onSourceDiskDelete') !== expectedDeletePolicy ||
    !scheduleMatches ||
    !labelsMatch
  ) {
    failDrift(input.name, 'snapshot schedule does not match retention policy');
  }
};

const budgetUnits = (budget: JsonRecord): number => {
  const amount = isRecord(budget.amount) ? budget.amount : {};
  const specified = isRecord(amount.specifiedAmount)
    ? amount.specifiedAmount
    : {};
  return recordNumber(specified, 'units');
};

const budgetCurrency = (budget: JsonRecord): string => {
  const amount = isRecord(budget.amount) ? budget.amount : {};
  const specified = isRecord(amount.specifiedAmount)
    ? amount.specifiedAmount
    : {};
  return recordString(specified, 'currencyCode').toUpperCase();
};

const budgetFilter = (budget: JsonRecord): JsonRecord =>
  isRecord(budget.budgetFilter) ? budget.budgetFilter : {};

const budgetThresholds = (budget: JsonRecord): number[] => {
  if (!Array.isArray(budget.thresholdRules)) return [];
  return budget.thresholdRules
    .filter(isRecord)
    .map((rule) => recordNumber(rule, 'thresholdPercent'))
    .filter(Number.isFinite);
};

export const createGcloudManagedCloudNodeFoundationClient = (input: {
  projectId: string;
  billingAccountId: string;
  run: GcloudCommandRunner;
  sleep?: (milliseconds: number) => Promise<void>;
}): ManagedCloudNodeFoundationClient => ({
  ensureService: async (service) => {
    const listArgs = [
      'services',
      'list',
      '--enabled',
      '--project',
      input.projectId,
      '--filter',
      `config.name=${service}`,
      '--format',
      'value(config.name)',
    ];
    let existing: GcloudCommandResult;
    try {
      existing = await runRequired(input.run, listArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect service ${service}`, error);
    }
    if (existing.stdout.split(/\s+/).includes(service)) return 'unchanged';
    await runRequired(input.run, [
      'services',
      'enable',
      service,
      '--project',
      input.projectId,
      '--quiet',
    ]);
    return 'created';
  },

  ensureNetwork: async (network) => {
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, [
        'compute',
        'networks',
        'describe',
        network.name,
        '--project',
        network.projectId,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to inspect network ${network.name}`, error);
    }
    if (resource) {
      ensureNetworkMatches(network.name, resource);
      return 'unchanged';
    }
    await runRequired(input.run, [
      'compute',
      'networks',
      'create',
      network.name,
      '--project',
      network.projectId,
      '--subnet-mode',
      'custom',
      '--bgp-routing-mode',
      'regional',
      '--quiet',
    ]);
    return 'created';
  },

  ensureSubnet: async (subnet) => {
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, [
        'compute',
        'networks',
        'subnets',
        'describe',
        subnet.name,
        '--project',
        subnet.projectId,
        '--region',
        subnet.region,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to inspect subnet ${subnet.name}`, error);
    }
    if (resource) {
      ensureSubnetMatches(subnet, resource);
      return 'unchanged';
    }
    await runRequired(input.run, [
      'compute',
      'networks',
      'subnets',
      'create',
      subnet.name,
      '--project',
      subnet.projectId,
      '--network',
      subnet.network,
      '--region',
      subnet.region,
      '--range',
      subnet.cidr,
      '--enable-private-ip-google-access',
      '--quiet',
    ]);
    return 'created';
  },

  ensureRouter: async (router) => {
    const describeArgs = [
      'compute',
      'routers',
      'describe',
      router.name,
      '--project',
      router.projectId,
      '--region',
      router.region,
      '--format',
      'json',
    ];
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, describeArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect router ${router.name}`, error);
    }
    if (resource) {
      ensureRouterMatches(router, resource);
      return 'unchanged';
    }
    try {
      await runRequired(input.run, [
        'compute',
        'routers',
        'create',
        router.name,
        '--project',
        router.projectId,
        '--region',
        router.region,
        '--network',
        router.network,
        '--asn',
        String(router.asn),
        '--quiet',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to create router ${router.name}`, error);
    }
    return 'created';
  },

  ensureNat: async (nat) => {
    const describeArgs = [
      'compute',
      'routers',
      'nats',
      'describe',
      nat.name,
      '--project',
      nat.projectId,
      '--region',
      nat.region,
      '--router',
      nat.router,
      '--format',
      'json',
    ];
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, describeArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect Cloud NAT ${nat.name}`, error);
    }
    if (resource) {
      ensureNatMatches(nat, resource);
      return 'unchanged';
    }
    try {
      await runRequired(input.run, [
        'compute',
        'routers',
        'nats',
        'create',
        nat.name,
        '--project',
        nat.projectId,
        '--region',
        nat.region,
        '--router',
        nat.router,
        '--nat-all-subnet-ip-ranges',
        '--auto-allocate-nat-external-ips',
        '--enable-logging',
        '--log-filter',
        nat.logging.filter,
        '--quiet',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to create Cloud NAT ${nat.name}`, error);
    }
    return 'created';
  },

  ensureFirewallRule: async (rule) => {
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, [
        'compute',
        'firewall-rules',
        'describe',
        rule.name,
        '--project',
        rule.projectId,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to inspect firewall rule ${rule.name}`, error);
    }
    if (resource) {
      ensureFirewallMatches(rule, resource);
      return 'unchanged';
    }
    await runRequired(input.run, [
      'compute',
      'firewall-rules',
      'create',
      rule.name,
      '--project',
      rule.projectId,
      '--network',
      rule.network,
      '--direction',
      'INGRESS',
      '--priority',
      '1000',
      '--source-ranges',
      rule.sourceRanges.join(','),
      '--target-tags',
      rule.targetTags.join(','),
      '--allow',
      rule.allowed.join(','),
      '--quiet',
    ]);
    return 'created';
  },

  ensureServiceAccount: async (account) => {
    const email = `${account.accountId}@${account.projectId}.iam.gserviceaccount.com`;
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, [
        'iam',
        'service-accounts',
        'describe',
        email,
        '--project',
        account.projectId,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to inspect service account ${email}`, error);
    }
    if (resource) {
      if (recordString(resource, 'displayName') !== account.displayName) {
        failDrift(account.accountId, 'service account display name differs');
      }
      return 'unchanged';
    }
    await runRequired(input.run, [
      'iam',
      'service-accounts',
      'create',
      account.accountId,
      '--project',
      account.projectId,
      '--display-name',
      account.displayName,
      '--quiet',
    ]);
    return 'created';
  },

  ensureProjectRoleBinding: async (binding) => {
    const readArgs = [
      'projects',
      'get-iam-policy',
      binding.projectId,
      '--flatten',
      'bindings[].members',
      '--filter',
      `bindings.role=${binding.role} AND bindings.members=${binding.member}`,
      '--format',
      'value(bindings.role)',
    ];
    let existing: GcloudCommandResult;
    try {
      existing = await runRequired(input.run, readArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect IAM binding ${binding.role}`, error);
    }
    if (existing.stdout.split(/\s+/).includes(binding.role)) return 'unchanged';
    const addArgs = [
      'projects',
      'add-iam-policy-binding',
      binding.projectId,
      '--member',
      binding.member,
      '--role',
      binding.role,
      '--condition',
      'None',
      '--quiet',
    ];
    const sleep =
      input.sleep ?? ((milliseconds: number) => Bun.sleep(milliseconds));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await input.run(addArgs);
      if (result.exitCode === 0) return 'created';
      const serviceAccountIsPropagating =
        /Service account .* does not exist/i.test(result.stderr);
      if (!serviceAccountIsPropagating || attempt === 4) {
        throw commandFailure(addArgs, result);
      }
      await sleep((attempt + 1) * 1_000);
    }
    throw new Error('unreachable IAM propagation retry state');
  },

  ensureSnapshotPolicy: async (policy) => {
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, [
        'compute',
        'resource-policies',
        'describe',
        policy.name,
        '--project',
        policy.projectId,
        '--region',
        policy.region,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(
        `failed to inspect snapshot policy ${policy.name}`,
        error,
      );
    }
    if (resource) {
      ensureSnapshotPolicyMatches(policy, resource);
      return 'unchanged';
    }
    const scheduleArgs =
      policy.frequency === 'daily'
        ? ['--daily-schedule']
        : ['--weekly-schedule', policy.weekday ?? 'sunday'];
    await runRequired(input.run, [
      'compute',
      'resource-policies',
      'create',
      'snapshot-schedule',
      policy.name,
      '--project',
      policy.projectId,
      '--region',
      policy.region,
      ...scheduleArgs,
      '--start-time',
      policy.startTime,
      '--max-retention-days',
      String(policy.retentionDays),
      '--on-source-disk-delete',
      policy.keepAfterDiskDelete
        ? 'keep-auto-snapshots'
        : 'apply-retention-policy',
      '--snapshot-labels',
      labelsArgument(policy.labels),
      '--quiet',
    ]);
    return 'created';
  },

  ensureBudget: async (budget) => {
    const listArgs = [
      'billing',
      'budgets',
      'list',
      '--billing-account',
      budget.billingAccountId,
      '--format',
      'json',
    ];
    let listed: GcloudCommandResult;
    try {
      listed = await runRequired(input.run, listArgs);
    } catch (error: unknown) {
      throw withContext(
        `failed to inspect budget ${budget.displayName}`,
        error,
      );
    }
    const parsed = parseJson(listed.stdout || '[]', commandText(listArgs));
    if (!Array.isArray(parsed)) {
      throw new Error(
        `${commandText(listArgs)} returned a non-array budget list`,
      );
    }
    const matches = parsed.filter(
      (entry): entry is JsonRecord =>
        isRecord(entry) &&
        recordString(entry, 'displayName') === budget.displayName,
    );
    if (matches.length > 1) {
      failDrift(
        budget.displayName,
        'multiple budgets have the same display name',
      );
    }
    if (matches.length === 1) {
      const projectNumberArgs = [
        'projects',
        'describe',
        budget.projectId,
        '--format',
        'value(projectNumber)',
      ];
      const projectNumberResult = await runRequired(
        input.run,
        projectNumberArgs,
      );
      const projectNumber = projectNumberResult.stdout.trim();
      if (!/^\d+$/.test(projectNumber)) {
        throw new Error(
          `${commandText(projectNumberArgs)} returned an invalid project number`,
        );
      }
      const existingFilter = budgetFilter(matches[0]);
      if (
        budgetUnits(matches[0]) !== budget.amountUsd ||
        budgetCurrency(matches[0]) !== 'USD' ||
        recordString(existingFilter, 'calendarPeriod').toUpperCase() !==
          'MONTH' ||
        !sameStrings(recordStrings(existingFilter, 'projects'), [
          `projects/${projectNumber}`,
        ]) ||
        !sameStrings(
          budgetThresholds(matches[0]).map(String),
          budget.thresholdPercents.map(String),
        )
      ) {
        failDrift(
          budget.displayName,
          'budget amount, currency, period, project scope, or thresholds differ',
        );
      }
      return 'unchanged';
    }

    await runRequired(input.run, [
      'billing',
      'budgets',
      'create',
      '--billing-account',
      budget.billingAccountId,
      '--display-name',
      budget.displayName,
      '--budget-amount',
      `${budget.amountUsd}USD`,
      '--filter-projects',
      `projects/${budget.projectId}`,
      '--calendar-period',
      'month',
      ...budget.thresholdPercents.flatMap((percent) => [
        '--threshold-rule',
        `percent=${percent}`,
      ]),
      '--quiet',
    ]);
    return 'created';
  },
});

export const createGcloudManagedCloudNodeClient = (input: {
  run: GcloudCommandRunner;
}): ManagedCloudNodeClient => ({
  ensureReleaseBucketAccess: async (access) => {
    const bucket = `gs://${access.bucketName}`;
    let policy: JsonRecord | null;
    try {
      policy = await readJsonResource(input.run, [
        'storage',
        'buckets',
        'get-iam-policy',
        bucket,
        '--format',
        'json',
      ]);
    } catch (error: unknown) {
      throw withContext(
        `failed to inspect release bucket IAM for ${bucket}`,
        error,
      );
    }
    if (!policy) throw new Error(`release bucket ${bucket} does not exist`);
    const alreadyBound = recordEntries(policy, 'bindings').some(
      (binding) =>
        recordString(binding, 'role') === access.role &&
        recordStrings(binding, 'members').includes(access.member),
    );
    if (alreadyBound) return 'unchanged';
    await runRequired(input.run, [
      'storage',
      'buckets',
      'add-iam-policy-binding',
      bucket,
      '--member',
      access.member,
      '--role',
      access.role,
      '--quiet',
    ]);
    return 'created';
  },

  ensureDataDisk: async (disk) => {
    const describeArgs = [
      'compute',
      'disks',
      'describe',
      disk.name,
      '--project',
      disk.projectId,
      '--zone',
      disk.zone,
      '--format',
      'json',
    ];
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, describeArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect data disk ${disk.name}`, error);
    }
    if (resource) {
      ensureDataDiskMatches(disk, resource);
      return 'unchanged';
    }
    try {
      await runRequired(input.run, [
        'compute',
        'disks',
        'create',
        disk.name,
        '--project',
        disk.projectId,
        '--zone',
        disk.zone,
        '--size',
        `${disk.sizeGb}GB`,
        '--type',
        disk.type,
        '--labels',
        labelsArgument(disk.labels),
        '--quiet',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to create data disk ${disk.name}`, error);
    }
    return 'created';
  },

  ensureSnapshotPolicyAttachment: async (attachment) => {
    const describeArgs = [
      'compute',
      'disks',
      'describe',
      attachment.diskName,
      '--project',
      attachment.projectId,
      '--zone',
      attachment.zone,
      '--format',
      'json',
    ];
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, describeArgs);
    } catch (error: unknown) {
      throw withContext(
        `failed to inspect snapshot policy attachment for ${attachment.diskName}`,
        error,
      );
    }
    if (resource) {
      const policies = recordStrings(resource, 'resourcePolicies').map(
        resourceTail,
      );
      if (policies.includes(attachment.policyName)) return 'unchanged';
      if (policies.length > 0) {
        failDrift(
          attachment.diskName,
          'data disk already has a different snapshot policy: ' +
            policies.join(', '),
        );
      }
    }
    try {
      await runRequired(input.run, [
        'compute',
        'disks',
        'add-resource-policies',
        attachment.diskName,
        '--project',
        attachment.projectId,
        '--zone',
        attachment.zone,
        '--resource-policies',
        attachment.policyName,
        '--quiet',
      ]);
    } catch (error: unknown) {
      throw withContext(
        `failed to attach snapshot policy ${attachment.policyName} to ${attachment.diskName}`,
        error,
      );
    }
    return 'created';
  },

  ensureInstance: async (instance) => {
    const describeArgs = [
      'compute',
      'instances',
      'describe',
      instance.name,
      '--project',
      instance.projectId,
      '--zone',
      instance.zone,
      '--format',
      'json',
    ];
    let resource: JsonRecord | null;
    try {
      resource = await readJsonResource(input.run, describeArgs);
    } catch (error: unknown) {
      throw withContext(`failed to inspect instance ${instance.name}`, error);
    }
    if (resource) {
      ensureInstanceMatches(instance, resource);
      const status = recordString(resource, 'status').toUpperCase();
      if (status === 'TERMINATED' || status === 'STOPPED') {
        await runRequired(input.run, [
          'compute',
          'instances',
          'start',
          instance.name,
          '--project',
          instance.projectId,
          '--zone',
          instance.zone,
          '--quiet',
        ]);
        return 'created';
      }
      if (status && status !== 'RUNNING') {
        failDrift(
          instance.name,
          'instance has unsupported runtime status ' + status,
        );
      }
      return 'unchanged';
    }

    const metadata = Object.entries(instance.metadata)
      .filter(([key]) => key !== 'startup-script')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    const startupScript = instance.metadata['startup-script'];
    if (!startupScript) {
      throw new Error(
        `instance ${instance.name} requires startup-script metadata`,
      );
    }
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), 'consuelo-cloud-node-'),
    );
    const startupScriptPath = join(temporaryDirectory, 'startup.sh');
    try {
      writeFileSync(startupScriptPath, startupScript, { mode: 0o600 });
      await runRequired(input.run, [
        'compute',
        'instances',
        'create',
        instance.name,
        '--project',
        instance.projectId,
        '--zone',
        instance.zone,
        '--machine-type',
        instance.machineType,
        '--network',
        instance.network,
        '--subnet',
        instance.subnet,
        '--no-address',
        '--service-account',
        instance.serviceAccountEmail,
        '--scopes',
        instance.scopes.join(','),
        '--tags',
        sorted(instance.tags).join(','),
        '--labels',
        labelsArgument(instance.labels),
        '--image-family',
        instance.bootDisk.imageFamily,
        '--image-project',
        instance.bootDisk.imageProject,
        '--boot-disk-size',
        `${instance.bootDisk.sizeGb}GB`,
        '--boot-disk-type',
        instance.bootDisk.type,
        '--boot-disk-auto-delete',
        '--disk',
        `name=${instance.dataDisk.name},device-name=${instance.dataDisk.deviceName},mode=rw,boot=no,auto-delete=no`,
        '--shielded-secure-boot',
        '--shielded-vtpm',
        '--shielded-integrity-monitoring',
        ...(metadata ? ['--metadata', metadata] : []),
        '--metadata-from-file',
        `startup-script=${startupScriptPath}`,
        '--quiet',
      ]);
    } catch (error: unknown) {
      throw withContext(`failed to create instance ${instance.name}`, error);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
    return 'created';
  },
});

export const createLocalGcloudCommandRunner =
  (): GcloudCommandRunner => async (args) => {
    const process = Bun.spawnSync({
      cmd: ['gcloud', ...args],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return {
      exitCode: process.exitCode ?? 1,
      stdout: new TextDecoder().decode(process.stdout),
      stderr: new TextDecoder().decode(process.stderr),
    };
  };
