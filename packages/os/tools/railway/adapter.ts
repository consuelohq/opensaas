import { providerInputError } from '../deployment-provider/errors';
import type {
  DeploymentProviderAdapter,
  DeploymentProviderOperationInputMap,
  ProviderAdapterOperationOutputMap,
  ProviderCommand,
  ProviderDeployment,
  ProviderEnvironmentVariableMetadata,
  ProviderLogEntry,
  ProviderProcessResult,
  ProviderResourceReference,
  ProviderService,
  ProviderVersion,
} from '../deployment-provider/types';

export const railwayCapabilities = [
  'detect',
  'auth.status',
  'context.current',
  'project.list',
  'service.list',
  'deployment.list',
  'deployment.status',
  'logs.read',
  'redeploy',
  'environment.listNames',
  'environment.set',
  'environment.delete',
  'raw',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseJson = (result: ProviderProcessResult): unknown => {
  const output = result.stdout.trim();
  if (!output) throw new Error('Railway returned empty JSON output');
  return JSON.parse(output) as unknown;
};

const firstString = (record: Record<string, unknown>, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const resource = (
  value: unknown,
  flatRecord?: Record<string, unknown>,
  idKeys: readonly string[] = [],
  nameKeys: readonly string[] = [],
): ProviderResourceReference | undefined => {
  if (isRecord(value)) {
    const id = firstString(value, ['id', ...idKeys]);
    const name = firstString(value, ['name', ...nameKeys]);
    if (id) return { id, ...(name ? { name } : {}) };
    if (name) return { id: name, name };
  }
  if (typeof value === 'string' && value.trim()) {
    const name = value.trim();
    return { id: name, name };
  }
  if (flatRecord) {
    const id = firstString(flatRecord, idKeys);
    const name = firstString(flatRecord, nameKeys);
    if (id) return { id, ...(name ? { name } : {}) };
    if (name) return { id: name, name };
  }
  return undefined;
};

const jsonArray = (value: unknown, keys: readonly string[]): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) throw new Error('Railway JSON output must be an array or object');
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return [];
};

const unsafeSyntax = (value: string): boolean => {
  return /[\0\r\n;`<>]|\$\(|\|\||&&/.test(value);
};

const safeValue = (value: string | undefined, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw providerInputError(field, `Railway ${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.startsWith('-') || unsafeSyntax(normalized)) {
    throw providerInputError(field, `Railway ${field} contains unsafe command syntax`);
  }
  if (normalized.length > 512) {
    throw providerInputError(field, `Railway ${field} exceeds the 512 character limit`);
  }
  return normalized;
};

const safeOptionalValue = (value: string | undefined, field: string): string | undefined => {
  return value === undefined ? undefined : safeValue(value, field);
};

const safeRawArgument = (value: string): string => {
  if (!value) throw providerInputError('raw argument', 'Railway raw arguments cannot be empty');
  if (unsafeSyntax(value)) {
    throw providerInputError('raw argument', 'Railway raw argument contains unsafe command syntax');
  }
  if (value.length > 1_024) {
    throw providerInputError('raw argument', 'Railway raw argument exceeds the 1024 character limit');
  }
  return value;
};

const safeFilter = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) throw providerInputError('filter', 'Railway filter cannot be empty');
  if (unsafeSyntax(normalized)) {
    throw providerInputError('filter', 'Railway filter contains unsafe command syntax');
  }
  if (normalized.length > 1_024) {
    throw providerInputError('filter', 'Railway filter exceeds the 1024 character limit');
  }
  return normalized;
};

const safeVariableName = (value: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw providerInputError('variable name', 'Railway variable name must use letters, numbers, and underscores');
  }
  return value;
};

const boundedLimit = (value: number | undefined, fallback: number): number => {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > 1_000) {
    throw providerInputError('limit', 'Railway limit must be an integer between 1 and 1000');
  }
  return candidate;
};

const pushOption = (args: string[], flag: string, value: string | undefined): void => {
  if (value !== undefined) args.push(flag, value);
};

const parseVersion = (output: string): ProviderVersion | null => {
  const match = output.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return null;
  const raw = `${match[1]}.${match[2]}.${match[3]}`;
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const parseAuthStatus = (result: ProviderProcessResult): ProviderAdapterOperationOutputMap['auth.status'] => {
  const value = parseJson(result);
  if (!isRecord(value)) throw new Error('Railway whoami JSON must be an object');
  const identity = firstString(value, ['email', 'name', 'username', 'id']);
  return {
    authenticated: true,
    ...(identity ? { identity } : {}),
  };
};

const parseContext = (result: ProviderProcessResult): ProviderAdapterOperationOutputMap['context.current'] => {
  const value = parseJson(result);
  if (!isRecord(value)) throw new Error('Railway status JSON must be an object');
  const project = resource(
    value.project,
    value,
    ['projectId'],
    ['projectName'],
  );
  if (!project) throw new Error('Railway status JSON is missing project context');
  return {
    workspace: resource(value.workspace ?? value.team, value, ['workspaceId', 'teamId'], ['workspaceName', 'teamName']),
    project,
    environment: resource(value.environment, value, ['environmentId'], ['environmentName']),
    service: resource(value.service, value, ['serviceId'], ['serviceName']),
  };
};

const parseProjects = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['project.list'],
): ProviderAdapterOperationOutputMap['project.list'] => {
  const rows = jsonArray(parseJson(result), ['projects']);
  const projects = rows.map((row) => {
    if (!isRecord(row)) throw new Error('Railway project entries must be objects');
    const id = firstString(row, ['id', 'projectId']);
    const name = firstString(row, ['name', 'projectName']);
    if (!id || !name) throw new Error('Railway project entry is missing id or name');
    const workspace = resource(row.workspace ?? row.team, row, ['workspaceId', 'teamId'], ['workspaceName', 'teamName']);
    return { id, name, ...(workspace ? { workspace } : {}) };
  });
  const limit = input.limit === undefined ? projects.length : boundedLimit(input.limit, projects.length || 1);
  return { projects: projects.slice(0, limit) };
};

const serviceRows = (value: unknown): Array<{ key?: string; value: unknown }> => {
  if (Array.isArray(value)) return value.map((entry) => ({ value: entry }));
  if (!isRecord(value)) throw new Error('Railway service status JSON must be an array or object');
  if (Array.isArray(value.services)) {
    return (value.services as unknown[]).map((entry) => ({ value: entry }));
  }
  const ignored = new Set(['project', 'environment', 'workspace']);
  return Object.entries(value)
    .filter(([key, entry]) => !ignored.has(key) && (isRecord(entry) || typeof entry === 'string'))
    .map(([key, entry]) => ({ key, value: entry }));
};

const parseServices = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['service.list'],
): ProviderAdapterOperationOutputMap['service.list'] => {
  const rows = serviceRows(parseJson(result));
  const services: ProviderService[] = rows.map(({ key, value }) => {
    if (typeof value === 'string') {
      const name = key || value;
      return { id: name, name, status: value };
    }
    if (!isRecord(value)) throw new Error('Railway service entries must be objects');
    const name = firstString(value, ['name', 'serviceName']) || key;
    const id = firstString(value, ['id', 'serviceId']) || name;
    if (!id || !name) throw new Error('Railway service entry is missing id or name');
    const status = firstString(value, ['status', 'deploymentStatus']);
    const environment = firstString(value, ['environment', 'environmentName']);
    const projectId = firstString(value, ['projectId']);
    return {
      id,
      name,
      ...(status ? { status } : {}),
      ...(environment ? { environment } : {}),
      ...(projectId ? { projectId } : {}),
    };
  });
  const limit = input.limit === undefined ? services.length : boundedLimit(input.limit, services.length || 1);
  return { services: services.slice(0, limit) };
};

const normalizeDeployment = (value: unknown): ProviderDeployment => {
  if (!isRecord(value)) throw new Error('Railway deployment entries must be objects');
  const id = firstString(value, ['id', 'deploymentId']);
  const status = firstString(value, ['status', 'deploymentStatus']);
  if (!id || !status) throw new Error('Railway deployment entry is missing id or status');
  const meta = isRecord(value.meta) ? value.meta : undefined;
  const url = firstString(value, ['url', 'deploymentUrl']) || (meta ? firstString(meta, ['url']) : undefined);
  const createdAt = firstString(value, ['createdAt', 'created_at']);
  const projectId = firstString(value, ['projectId']);
  const environment = firstString(value, ['environment', 'environmentName']);
  const serviceId = firstString(value, ['serviceId']) || (meta ? firstString(meta, ['serviceId']) : undefined);
  return {
    id,
    status,
    ...(url ? { url } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(projectId ? { projectId } : {}),
    ...(environment ? { environment } : {}),
    ...(serviceId ? { serviceId } : {}),
  };
};

const parseDeploymentList = (
  result: ProviderProcessResult,
): ProviderAdapterOperationOutputMap['deployment.list'] => {
  return { deployments: jsonArray(parseJson(result), ['deployments']).map(normalizeDeployment) };
};

const parseDeploymentStatus = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['deployment.status'],
): ProviderAdapterOperationOutputMap['deployment.status'] => {
  const deployments = jsonArray(parseJson(result), ['deployments']).map(normalizeDeployment);
  const selected = deployments.find((deployment) => deployment.id === input.deploymentId);
  if (!selected) throw new Error(`Railway deployment ${input.deploymentId} was not found`);
  return selected;
};

const logRows = (output: string): unknown[] => {
  const trimmed = output.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (isRecord(parsed) && Array.isArray(parsed.logs)) return parsed.logs as unknown[];
    return [parsed];
  } catch {
    return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown);
  }
};

const parseLogs = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['logs.read'],
): ProviderAdapterOperationOutputMap['logs.read'] => {
  const kind = input.kind || 'runtime';
  const limit = boundedLimit(input.limit, 200);
  const entries: ProviderLogEntry[] = logRows(result.stdout).map((row) => {
    if (!isRecord(row)) throw new Error('Railway log entries must be objects');
    const message = firstString(row, ['message', 'log', 'text']);
    if (!message) throw new Error('Railway log entry is missing a message');
    const timestamp = firstString(row, ['timestamp', 'time', 'createdAt']);
    const level = firstString(row, ['level', 'severity']);
    return {
      message,
      ...(timestamp ? { timestamp } : {}),
      ...(level ? { level } : {}),
      stream: kind,
    };
  });
  return {
    kind,
    requestedLimit: limit,
    returned: entries.length,
    truncated: result.stdoutTruncated || entries.length > limit,
    entries: entries.slice(-limit),
  };
};

const scopesFor = (input: { serviceId?: string; environment?: string; scope?: string }): string[] => {
  const scopes: string[] = [];
  if (input.serviceId) scopes.push(`service:${input.serviceId}`);
  if (input.environment) scopes.push(`environment:${input.environment}`);
  if (input.scope) scopes.push(input.scope);
  return scopes;
};

const parseEnvironmentNames = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['environment.listNames'],
): ProviderEnvironmentVariableMetadata[] => {
  const value = parseJson(result);
  const scopes = scopesFor(input);
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === 'string') return { name: entry, scopes, present: true };
      if (!isRecord(entry)) throw new Error('Railway variable entries must be objects');
      const name = firstString(entry, ['name', 'key']);
      if (!name) throw new Error('Railway variable entry is missing a name');
      return { name, scopes, present: true };
    });
  }
  if (!isRecord(value)) throw new Error('Railway variables JSON must be an object or array');
  const variables = isRecord(value.variables) ? value.variables : value;
  return Object.keys(variables).sort().map((name) => ({ name, scopes, present: true }));
};

const serviceAndEnvironmentArgs = (
  input: { serviceId?: string; environment?: string },
  requireService = true,
): string[] => {
  const args: string[] = [];
  const serviceId = requireService ? safeValue(input.serviceId, 'service') : safeOptionalValue(input.serviceId, 'service');
  const environment = safeOptionalValue(input.environment, 'environment');
  pushOption(args, '--service', serviceId);
  pushOption(args, '--environment', environment);
  return args;
};

const deploymentListCommand = (
  input: DeploymentProviderOperationInputMap['deployment.list'] | DeploymentProviderOperationInputMap['deployment.status'],
  limit: number,
): ProviderCommand => {
  const args = ['deployment', 'list', ...serviceAndEnvironmentArgs(input), '--limit', String(limit), '--json'];
  return { args };
};

export const createRailwayAdapter = (): DeploymentProviderAdapter => ({
  provider: 'railway',
  executable: 'railway',
  capabilities: railwayCapabilities,
  version: {
    args: ['--version'],
    parse: parseVersion,
    supports: (version) => version.major >= 4 && version.major <= 5,
  },
  errors: {
    message: ({ code, operation }) => {
      if (code === 'UNAUTHENTICATED') return 'Railway CLI is not authenticated; run railway login.';
      if (code === 'NO_CONTEXT') return 'This directory is not linked to a Railway project; run railway link.';
      if (code === 'UNSUPPORTED_CAPABILITY' && operation === 'environment.delete') {
        return 'Installed Railway CLI does not support variable deletion.';
      }
      return undefined;
    },
  },
  operations: {
    'auth.status': {
      capability: 'auth.status',
      command: () => ({ args: ['whoami', '--json'] }),
      parse: parseAuthStatus,
    },
    'context.current': {
      capability: 'context.current',
      command: () => ({ args: ['status', '--json'] }),
      parse: parseContext,
    },
    'project.list': {
      capability: 'project.list',
      command: () => ({ args: ['list', '--json'] }),
      parse: parseProjects,
    },
    'service.list': {
      capability: 'service.list',
      command: (input) => {
        if (input.projectId) {
          throw providerInputError(
            'project',
            'Railway service listing uses the linked project; projectId selection is unsupported',
          );
        }
        const args = ['service', 'status', '--all'];
        pushOption(args, '--environment', safeOptionalValue(input.environment, 'environment'));
        args.push('--json');
        return { args };
      },
      parse: parseServices,
    },
    'deployment.list': {
      capability: 'deployment.list',
      command: (input) => deploymentListCommand(input, boundedLimit(input.limit, 20)),
      parse: parseDeploymentList,
    },
    'deployment.status': {
      capability: 'deployment.status',
      command: (input) => {
        safeValue(input.deploymentId, 'deployment');
        return deploymentListCommand(input, 1_000);
      },
      parse: parseDeploymentStatus,
    },
    'logs.read': {
      capability: 'logs.read',
      command: (input) => {
        const args = ['logs'];
        if (input.deploymentId) args.push(safeValue(input.deploymentId, 'deployment'));
        args.push(...serviceAndEnvironmentArgs(input));
        args.push(input.kind === 'build' ? '--build' : '--deployment');
        args.push('--json', '--lines', String(boundedLimit(input.limit, 200)));
        pushOption(args, '--filter', safeFilter(input.filter));
        pushOption(args, '--since', safeOptionalValue(input.since, 'since'));
        pushOption(args, '--until', safeOptionalValue(input.until, 'until'));
        if (input.latest) args.push('--latest');
        return { args };
      },
      parse: parseLogs,
    },
    redeploy: {
      capability: 'redeploy',
      command: (input) => {
        if (input.environment) {
          throw providerInputError(
            'environment',
            'Railway redeploy operates on the linked Railway environment; select or link the desired environment before redeploying',
          );
        }
        return {
          args: ['redeploy', '--service', safeValue(input.serviceId, 'service'), '--yes'],
        };
      },
      parse: (_result, input) => ({
        deploymentId: input.deploymentId || 'latest',
        ...(input.serviceId ? { serviceId: input.serviceId } : {}),
        status: 'triggered',
      }),
    },
    'environment.listNames': {
      capability: 'environment.listNames',
      sensitiveOutput: true,
      command: (input) => ({
        args: ['variables', ...serviceAndEnvironmentArgs(input), '--json'],
      }),
      parse: parseEnvironmentNames,
    },
    'environment.set': {
      capability: 'environment.set',
      sensitiveOutput: true,
      command: (input) => {
        const args = [
          'variables',
          ...serviceAndEnvironmentArgs(input),
          '--set-from-stdin',
          safeVariableName(input.name),
        ];
        if (input.skipDeploys) args.push('--skip-deploys');
        return { args, stdin: input.value };
      },
      parse: (_result, input) => ({
        name: input.name,
        scopes: scopesFor(input),
        updated: true,
      }),
    },
    'environment.delete': {
      capability: 'environment.delete',
      sensitiveOutput: true,
      command: (input) => {
        const args = [
          'variable', 'delete', safeVariableName(input.name),
          ...serviceAndEnvironmentArgs(input),
          '--yes',
        ];
        if (input.skipDeploys) args.push('--skip-deploys');
        return { args };
      },
      parse: (_result, input) => ({
        name: input.name,
        scopes: scopesFor(input),
        deleted: true,
      }),
    },
    raw: {
      capability: 'raw',
      command: (input) => ({
        args: input.args.map(safeRawArgument),
      }),
      parse: (result) => ({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }),
    },
  },
});
