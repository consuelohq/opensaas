import { fileURLToPath } from 'node:url';

import { providerInputError } from './errors';
import type {
  DeploymentProviderAdapter,
  DeploymentProviderOperationInputMap,
  ProviderAdapterOperationOutputMap,
  ProviderContext,
  ProviderDeployment,
  ProviderDeploymentList,
  ProviderEnvironmentVariableMetadata,
  ProviderLogEntry,
  ProviderLogResult,
  ProviderProcessResult,
  ProviderProjectList,
  ProviderVersion,
} from './types';

export const cloudflareRunnerPath = fileURLToPath(
  new URL('./cloudflare-runner.ts', import.meta.url),
);

type CloudflareTargetKind = 'worker' | 'pages';

type CloudflareReference = {
  kind: CloudflareTargetKind;
  target: string;
  detail?: string;
};

const FORBIDDEN_REFERENCE = /(?:consuelo|workspace[-_]edge|device[-_]authority|platform[-_]cloudflare|packages[\\/]os[\\/]cloudflare|cloudflare[_-].*test.*token)/i;
const SAFE_RESOURCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const assertCustomerValue = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) throw providerInputError(label, `${label} is required`);
  if (trimmed.includes('\0')) throw providerInputError(label, `${label} contains an invalid null byte`);
  if (FORBIDDEN_REFERENCE.test(trimmed)) {
    throw providerInputError(label, `${label} references operator-owned Cloudflare resources`);
  }
  return trimmed;
};

const assertResourceName = (value: string, label: string): string => {
  const name = assertCustomerValue(value, label);
  if (!SAFE_RESOURCE_NAME.test(name)) {
    throw providerInputError(label, `${label} must be a Cloudflare resource name`);
  }
  return name;
};

const parseReference = (
  value: string | undefined,
  label: string,
  options: { detail?: 'optional' | 'required' | 'forbidden' } = {},
): CloudflareReference => {
  const normalized = assertCustomerValue(value || '', label);
  const [kindCandidate, targetCandidate, ...detailParts] = normalized.split(':');
  if (kindCandidate !== 'worker' && kindCandidate !== 'pages') {
    throw providerInputError(label, `${label} must start with worker: or pages:`);
  }
  const target = assertResourceName(targetCandidate || '', `${label} target`);
  const detail = detailParts.length > 0
    ? assertCustomerValue(detailParts.join(':'), `${label} detail`)
    : undefined;
  const detailPolicy = options.detail || 'optional';
  if (detailPolicy === 'required' && !detail) {
    throw providerInputError(label, `${label} requires a detail identifier`);
  }
  if (detailPolicy === 'forbidden' && detail) {
    throw providerInputError(label, `${label} does not accept a detail identifier`);
  }
  return { kind: kindCandidate, target, ...(detail ? { detail } : {}) };
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const parseJson = (result: ProviderProcessResult): unknown => JSON.parse(result.stdout);

const stringValue = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const nestedString = (
  record: Record<string, unknown>,
  key: string,
  nestedKey: string,
): string | undefined => {
  const nested = record[key];
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return undefined;
  return stringValue(nested as Record<string, unknown>, nestedKey);
};

const arrayValue = (value: unknown, key?: string): unknown[] => {
  if (Array.isArray(value)) return value;
  if (key && value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>)[key];
    if (Array.isArray(candidate)) return candidate;
  }
  throw new Error('Cloudflare output must contain an array');
};

const parseVersion = (output: string): ProviderVersion | null => {
  const match = output.match(/(?:wrangler\s+)?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  const raw = `${match[1]}.${match[2]}.${match[3]}`;
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const parseAuthStatus = (
  result: ProviderProcessResult,
): ProviderAdapterOperationOutputMap['auth.status'] => {
  const record = asRecord(parseJson(result), 'Wrangler authentication output');
  return {
    authenticated: record.loggedIn === true || record.authenticated === true,
    ...(stringValue(record, 'email') ? { identity: stringValue(record, 'email') } : {}),
  };
};

const parseContext = (result: ProviderProcessResult): ProviderContext => {
  const record = asRecord(parseJson(result), 'Wrangler account output');
  const accounts = Array.isArray(record.accounts) ? record.accounts : [];
  if (accounts.length !== 1) return {};
  const account = asRecord(accounts[0], 'Wrangler account');
  const id = stringValue(account, 'id');
  const name = stringValue(account, 'name');
  if (!id || !name) return {};
  return { project: { id: `account:${id}`, name } };
};

const parseProjects = (result: ProviderProcessResult): ProviderProjectList => {
  const projects = arrayValue(parseJson(result), 'projects').map((entry) => {
    const record = asRecord(entry, 'Wrangler Pages project');
    const name = stringValue(record, 'name', 'project_name');
    if (!name) throw new Error('Wrangler Pages project is missing a name');
    return { id: `pages:${name}`, name };
  });
  return { projects };
};

const parseDeployment = (entry: unknown): ProviderDeployment => {
  const record = asRecord(entry, 'Wrangler deployment');
  const id = stringValue(record, 'id', 'deployment_id', 'version_id');
  if (!id) throw new Error('Wrangler deployment is missing an identifier');
  const projectName = stringValue(record, 'project_name');
  const latestStatus = nestedString(record, 'latest_stage', 'status');
  const versions = Array.isArray(record.versions) ? record.versions : [];
  const activeVersion = versions
    .map((version) => asRecord(version, 'Wrangler deployment version'))
    .find((version) => typeof version.percentage === 'number' && version.percentage > 0)
    || versions.map((version) => asRecord(version, 'Wrangler deployment version'))[0];
  const serviceId = activeVersion ? stringValue(activeVersion, 'version_id', 'id') : undefined;
  return {
    id,
    status: stringValue(record, 'status') || latestStatus || (serviceId ? 'active' : 'unknown'),
    ...(stringValue(record, 'url') ? { url: stringValue(record, 'url') } : {}),
    ...(stringValue(record, 'created_on', 'createdAt')
      ? { createdAt: stringValue(record, 'created_on', 'createdAt') }
      : {}),
    ...(projectName ? { projectId: `pages:${projectName}` } : {}),
    ...(stringValue(record, 'environment') ? { environment: stringValue(record, 'environment') } : {}),
    ...(serviceId ? { serviceId } : {}),
  };
};

const parseDeployments = (result: ProviderProcessResult): ProviderDeploymentList => ({
  deployments: arrayValue(parseJson(result), 'deployments').map(parseDeployment),
});

const parseDeploymentStatus = (result: ProviderProcessResult): ProviderDeployment => {
  const record = asRecord(parseJson(result), 'Wrangler version');
  const id = stringValue(record, 'id', 'version_id');
  if (!id) throw new Error('Wrangler version is missing an identifier');
  return {
    id,
    status: stringValue(record, 'status') || 'available',
    ...(stringValue(record, 'created_on', 'createdAt')
      ? { createdAt: stringValue(record, 'created_on', 'createdAt') }
      : {}),
  };
};

const normalizeLogMessage = (value: unknown, fallback: Record<string, unknown>): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(' ');
  if (value !== undefined) return JSON.stringify(value);
  return JSON.stringify(fallback);
};

const parseLogs = (result: ProviderProcessResult): ProviderLogResult => {
  const entries = arrayValue(parseJson(result)).map((entry): ProviderLogEntry => {
    const record = asRecord(entry, 'Wrangler tail event');
    return {
      message: normalizeLogMessage(record.message, record),
      ...(stringValue(record, 'timestamp', 'eventTimestamp')
        ? { timestamp: stringValue(record, 'timestamp', 'eventTimestamp') }
        : {}),
      ...(stringValue(record, 'level', 'outcome') ? { level: stringValue(record, 'level', 'outcome') } : {}),
    };
  });
  return { entries };
};

const urlFromOutput = (output: string): string | undefined => {
  const match = output.match(/https:\/\/[^\s)]+/i);
  return match?.[0]?.replace(/[.,;]+$/, '');
};

const parseMutation = (
  result: ProviderProcessResult,
): ProviderAdapterOperationOutputMap['deploy'] => {
  const deploymentId = result.stdout.match(/(?:Current Version ID|Deployment ID):\s*([^\s]+)/i)?.[1]
    || urlFromOutput(result.stdout);
  if (!deploymentId) throw new Error('Wrangler deployment output is missing an identifier');
  const url = urlFromOutput(result.stdout);
  return {
    deploymentId,
    status: 'deployed',
    ...(url ? { url } : {}),
  };
};

const environmentMetadata = (
  name: string,
  scopes: string[] = [],
): ProviderEnvironmentVariableMetadata => ({ name, scopes, present: true });

const parseEnvironmentNames = (
  result: ProviderProcessResult,
): ProviderEnvironmentVariableMetadata[] => {
  const value = parseJson(result);
  const metadata = new Map<string, ProviderEnvironmentVariableMetadata>();
  const add = (name: string, scope?: string): void => {
    const current = metadata.get(name) || environmentMetadata(name);
    if (scope && !current.scopes.includes(scope)) current.scopes.push(scope);
    metadata.set(name, current);
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = asRecord(entry, 'Wrangler secret');
      const name = stringValue(record, 'name');
      if (name) add(name);
    }
  } else {
    const record = asRecord(value, 'Wrangler Pages secrets');
    for (const [scope, entries] of Object.entries(record)) {
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (typeof entry === 'string') add(entry, scope);
          else {
            const name = stringValue(asRecord(entry, 'Wrangler Pages secret'), 'name');
            if (name) add(name, scope);
          }
        }
      } else if (entries && typeof entries === 'object') {
        for (const name of Object.keys(entries as Record<string, unknown>)) add(name, scope);
      }
    }
  }
  return [...metadata.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const parseEnvironmentSet = (
  result: ProviderProcessResult,
): ProviderAdapterOperationOutputMap['environment.set'] => parseJson(result) as ProviderAdapterOperationOutputMap['environment.set'];

const rawArgs = (input: DeploymentProviderOperationInputMap['raw']): string[] => {
  if (!Array.isArray(input.args) || input.args.length === 0) {
    throw providerInputError('raw argument', 'raw Wrangler arguments are required');
  }
  return input.args.map((argument, index) => assertCustomerValue(argument, `raw argument ${index + 1}`));
};

const runnerArgs = (command: string, reference: CloudflareReference): string[] => [
  cloudflareRunnerPath,
  command,
  '--wrangler',
  'wrangler',
  '--kind',
  reference.kind,
  '--target',
  reference.target,
];

export const cloudflareDeploymentProviderAdapter = {
  provider: 'cloudflare',
  executable: 'wrangler',
  capabilities: [
    'detect',
    'auth.status',
    'context.current',
    'project.list',
    'deployment.list',
    'deployment.status',
    'logs.read',
    'deploy',
    'redeploy',
    'environment.listNames',
    'environment.set',
    'raw',
  ],
  version: {
    args: ['--version'],
    parse: parseVersion,
    supports: (version) => version.major === 4,
  },
  operations: {
    'auth.status': {
      capability: 'auth.status',
      command: () => ({ args: ['whoami', '--json'] }),
      parse: parseAuthStatus,
    },
    'context.current': {
      capability: 'context.current',
      command: () => ({ args: ['whoami', '--json'] }),
      parse: parseContext,
    },
    'project.list': {
      capability: 'project.list',
      command: () => ({ args: ['pages', 'project', 'list', '--json'] }),
      parse: parseProjects,
    },
    'deployment.list': {
      capability: 'deployment.list',
      command: (input) => {
        const reference = parseReference(input.projectId, 'projectId', { detail: 'forbidden' });
        if (reference.kind === 'worker') {
          return { args: ['deployments', 'list', '--name', reference.target, '--json'] };
        }
        return {
          args: [
            'pages',
            'deployment',
            'list',
            '--project-name',
            reference.target,
            ...(input.environment ? ['--environment', assertResourceName(input.environment, 'environment')] : []),
            '--json',
          ],
        };
      },
      parse: parseDeployments,
    },
    'deployment.status': {
      capability: 'deployment.status',
      command: (input) => {
        const reference = parseReference(input.deploymentId, 'deploymentId', { detail: 'required' });
        if (reference.kind !== 'worker') {
          throw new Error('Pages does not expose a stable deployment-view command');
        }
        return {
          args: ['versions', 'view', reference.detail!, '--name', reference.target, '--json'],
        };
      },
      parse: parseDeploymentStatus,
    },
    'logs.read': {
      capability: 'logs.read',
      command: (input) => {
        const reference = parseReference(input.serviceId, 'serviceId', { detail: 'forbidden' });
        const limit = Math.max(1, Math.min(input.limit || 100, 500));
        const durationMs = input.timeoutMs
          ? Math.max(250, Math.min(input.timeoutMs - 500, 120_000))
          : 10_000;
        return {
          command: process.execPath,
          args: [
            ...runnerArgs('tail', reference),
            ...(input.deploymentId
              ? ['--deployment-id', assertCustomerValue(input.deploymentId, 'deploymentId')]
              : []),
            ...(input.environment
              ? ['--environment', assertResourceName(input.environment, 'environment')]
              : []),
            '--limit',
            String(limit),
            '--duration-ms',
            String(durationMs),
          ],
        };
      },
      parse: parseLogs,
    },
    deploy: {
      capability: 'deploy',
      command: (input) => {
        const reference = parseReference(input.target, 'target', { detail: 'forbidden' });
        const source = assertCustomerValue(input.source || '', 'source');
        if (reference.kind === 'worker') {
          return {
            args: ['deploy', '--config', source, '--name', reference.target, '--strict'],
          };
        }
        return {
          args: ['pages', 'deploy', source, '--project-name', reference.target],
        };
      },
      parse: parseMutation,
    },
    redeploy: {
      capability: 'redeploy',
      command: (input) => {
        const reference = parseReference(input.deploymentId, 'deploymentId', { detail: 'required' });
        if (reference.kind !== 'worker') {
          throw new Error('Pages does not expose a stable redeploy command');
        }
        return {
          args: ['rollback', reference.detail!, '--name', reference.target, '--yes'],
        };
      },
      parse: parseMutation,
    },
    'environment.listNames': {
      capability: 'environment.listNames',
      command: (input) => {
        const reference = parseReference(input.projectId, 'projectId', { detail: 'forbidden' });
        if (reference.kind === 'worker') {
          return {
            args: [
              'secret',
              'list',
              '--name',
              reference.target,
              ...(input.environment ? ['--env', assertResourceName(input.environment, 'environment')] : []),
              '--format',
              'json',
            ],
          };
        }
        if (input.environment) {
          throw new Error('Pages secret listing does not accept an environment selector');
        }
        return {
          args: ['pages', 'secret', 'list', '--project-name', reference.target],
        };
      },
      parse: parseEnvironmentNames,
    },
    'environment.set': {
      capability: 'environment.set',
      command: (input) => {
        const reference = parseReference(input.scope, 'scope');
        const name = assertResourceName(input.name, 'environment name');
        return {
          command: process.execPath,
          args: [
            ...runnerArgs('secret-put', reference),
            '--name',
            name,
            ...(reference.detail ? ['--environment', assertResourceName(reference.detail, 'environment')] : []),
          ],
          stdin: input.value,
        };
      },
      parse: parseEnvironmentSet,
    },
    raw: {
      capability: 'raw',
      command: (input) => ({ args: rawArgs(input) }),
      parse: (result) => ({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }),
    },
  },
} as const satisfies DeploymentProviderAdapter;
