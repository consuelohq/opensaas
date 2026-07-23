import {
  deploymentProviderOperations,
  providerOperationPolicy,
  type DeploymentProviderOperation,
  type ProviderOperationPolicy,
} from './schema';
import type {
  DeploymentProviderAdapter,
  DeploymentProviderOperationInputMap,
  ProviderAdapterOperationOutputMap,
  ProviderCommand,
  ProviderCommandOperation,
  ProviderDeployment,
  ProviderDeploymentList,
  ProviderDeploymentMutationResult,
  ProviderDomainList,
  ProviderEnvironmentDeleteResult,
  ProviderEnvironmentSetResult,
  ProviderEnvironmentVariableMetadata,
  ProviderLogResult,
  ProviderOperationDefinition,
  ProviderProcessResult,
  ProviderProjectConfiguration,
  ProviderProjectLinkResult,
  ProviderProjectList,
  ProviderVersion,
} from './types';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const VERCEL_MINIMUM_MAJOR = 40;
const VERCEL_MAXIMUM_MAJOR = 50;

const cleanText = (value: string): string => value.replace(ANSI_PATTERN, '').replace(/\r/g, '').trim();

const cleanLines = (value: string): string[] => cleanText(value)
  .split('\n')
  .map((line) => line.trimEnd())
  .filter((line) => line.trim().length > 0);

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim().replace(/[),.;]+$/g, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const encodeCursor = (value: string | number): string => {
  return `vercel:${Buffer.from(String(value), 'utf8').toString('base64url')}`;
};

const decodeCursor = (value: string): string => {
  if (!value.startsWith('vercel:')) return value;
  const decoded = Buffer.from(value.slice('vercel:'.length), 'base64url').toString('utf8');
  if (!/^\d+$/.test(decoded)) throw new Error('Vercel cursor is malformed');
  return decoded;
};

const normalizeTimestamp = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return undefined;
};

const requireString = (record: Record<string, unknown>, keys: readonly string[], label: string): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new Error(`${label} is missing`);
};

const optionalString = (record: Record<string, unknown>, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const parseJsonObject = (value: string, label: string): Record<string, unknown> => {
  const parsed = JSON.parse(cleanText(value)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
};

const strictPolicy = (
  operation: DeploymentProviderOperation,
  consequence: string,
): ProviderOperationPolicy => ({
  operation,
  capability: operation,
  readOnly: false,
  mutating: true,
  approval: { required: true, consequence },
});

const parseVersion = (output: string): ProviderVersion | null => {
  const matches = [...cleanText(output).matchAll(/\b(\d+)\.(\d+)\.(\d+)\b/g)];
  if (matches.length === 0) return null;
  const versions = [...new Set(matches.map((match) => match[0]))];
  if (versions.length !== 1) throw new Error('Vercel CLI reported conflicting versions');
  const [major, minor, patch] = versions[0].split('.').map(Number);
  return { raw: versions[0], major, minor, patch };
};

const parseProjectInspection = (output: string): ProviderProjectConfiguration => {
  const lines = cleanText(output).split('\n');
  const fields = new Map<string, string>();
  const domains: string[] = [];
  let inDomains = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^Domains$/i.test(trimmed)) {
      inDomains = true;
      continue;
    }
    const pair = rawLine.match(/^\s{2,}(.+?)\s{2,}(.+?)\s*$/);
    if (pair) {
      inDomains = false;
      fields.set(pair[1].trim().toLowerCase(), pair[2].trim());
      continue;
    }
    if (inDomains && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(trimmed)) {
      domains.push(trimmed.toLowerCase());
    }
  }

  const id = fields.get('id') || fields.get('project id');
  const name = fields.get('name') || fields.get('project name');
  if (!id || !name) throw new Error('Vercel project inspection is missing project ID or name');
  const teamId = fields.get('team id');
  const teamName = fields.get('team name');
  const scope = fields.get('scope') || teamName;

  return {
    id,
    name,
    ...(fields.get('framework settings') ? { framework: fields.get('framework settings') } : {}),
    ...(fields.get('node.js version') ? { nodeVersion: fields.get('node.js version') } : {}),
    ...(fields.get('root directory') ? { rootDirectory: fields.get('root directory') } : {}),
    ...(teamId || teamName
      ? { team: { id: teamId || teamName || '', ...(teamName ? { name: teamName } : {}) } }
      : {}),
    ...(scope ? { scope: { id: scope, name: scope } } : {}),
    domains,
  };
};

const parseProjectList = (result: ProviderProcessResult): ProviderProjectList => {
  const record = parseJsonObject(result.stdout, 'Vercel project list');
  if (!Array.isArray(record.projects)) throw new Error('Vercel project list is missing projects');
  const projects = record.projects.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Vercel project entry must be an object');
    }
    const project = entry as Record<string, unknown>;
    return {
      id: requireString(project, ['id'], 'Vercel project ID'),
      name: requireString(project, ['name'], 'Vercel project name'),
    };
  });
  const pagination = record.pagination;
  const next = pagination && typeof pagination === 'object' && !Array.isArray(pagination)
    ? (pagination as Record<string, unknown>).next
    : undefined;
  return {
    projects,
    ...(typeof next === 'string' || typeof next === 'number' ? { cursor: encodeCursor(next) } : {}),
  };
};

const parseDeploymentList = (result: ProviderProcessResult): ProviderDeploymentList => {
  const lines = cleanLines(result.stdout);
  const headerIndex = lines.findIndex((line) => /\bAge\b/.test(line) && /\bDeployment\b/.test(line) && /\bEnvironment\b/.test(line));
  if (headerIndex < 0) throw new Error('Vercel deployment list header was not recognized');
  const deployments = lines.slice(headerIndex + 1).map((line) => line.trim().split(/\s{2,}/)).filter((columns) => columns.length > 1).map((columns) => {
    if (columns.length < 4) throw new Error('Vercel deployment list row was not recognized');
    const url = normalizeUrl(columns[1]);
    const status = columns[2].replace(/^[^A-Za-z0-9]+/, '').trim().toUpperCase();
    const environment = columns[3].trim().toLowerCase();
    if (!status || !environment) throw new Error('Vercel deployment row is missing status or environment');
    return { id: url, url, status, environment };
  });
  return { deployments };
};

const parseDeploymentStatus = (result: ProviderProcessResult): ProviderDeployment => {
  const record = parseJsonObject(result.stdout, 'Vercel deployment inspection');
  const id = requireString(record, ['id', 'uid'], 'Vercel deployment ID');
  const url = normalizeUrl(requireString(record, ['url', 'alias'], 'Vercel deployment URL'));
  const status = requireString(record, ['readyState', 'status'], 'Vercel deployment status').toUpperCase();
  const createdAt = normalizeTimestamp(record.createdAt ?? record.created);
  const projectId = optionalString(record, ['projectId', 'project']);
  const environment = optionalString(record, ['target', 'environment']);
  return {
    id,
    status,
    url,
    ...(createdAt ? { createdAt } : {}),
    ...(projectId ? { projectId } : {}),
    ...(environment ? { environment: environment.toLowerCase() } : {}),
  };
};

const parseLogs = (result: ProviderProcessResult): ProviderLogResult => {
  const lines = cleanLines(result.stdout);
  const entries = lines.map((line) => {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Vercel runtime log line must be a JSON object');
    }
    const record = parsed as Record<string, unknown>;
    const message = requireString(record, ['message', 'text'], 'Vercel runtime log message');
    const timestamp = normalizeTimestamp(record.timestamp ?? record.createdAt);
    const level = optionalString(record, ['level']);
    const stream = optionalString(record, ['source', 'stream']);
    return {
      message,
      ...(timestamp ? { timestamp } : {}),
      ...(level ? { level } : {}),
      ...(stream ? { stream } : {}),
    };
  });
  return { entries };
};

const parseDeploymentMutation = (result: ProviderProcessResult): ProviderDeploymentMutationResult => {
  const urls = cleanText(result.stdout).match(URL_PATTERN) || [];
  if (urls.length !== 1) throw new Error('Vercel deployment output did not contain exactly one deployment URL');
  const url = normalizeUrl(urls[0]);
  return { deploymentId: url, url, status: 'QUEUED' };
};

const parseProjectLink = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['project.link'],
): ProviderProjectLinkResult => {
  const output = cleanText(`${result.stdout}\n${result.stderr}`);
  const match = output.match(/Linked to\s+([^\s/]+)\/([^\s()]+)/i);
  if (!match) throw new Error('Vercel link output was not recognized');
  return {
    project: { id: match[2], name: match[2] },
    scope: { id: match[1], name: match[1] },
    linked: true,
  };
};

const parsePromotion = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['deployment.promote'],
): ProviderDeploymentMutationResult => {
  if (!/\bPromoted\b/i.test(cleanText(`${result.stdout}\n${result.stderr}`))) {
    throw new Error('Vercel promote output was not recognized');
  }
  return { deploymentId: input.deploymentId, status: 'PROMOTED' };
};

const parseEnvironmentList = (result: ProviderProcessResult): ProviderEnvironmentVariableMetadata[] => {
  const lines = cleanLines(result.stdout);
  const headerIndex = lines.findIndex((line) => /\bname\b/i.test(line) && /\benvironments?\b/i.test(line));
  if (headerIndex < 0) throw new Error('Vercel environment list header was not recognized');
  return lines.slice(headerIndex + 1).map((line) => line.trim().split(/\s{2,}/)).filter((columns) => columns.length > 1).map((columns) => {
    if (columns.length < 3 || !columns[0]) throw new Error('Vercel environment list row was not recognized');
    const scopes = columns[2].split(',').map((scope) => scope.trim().toLowerCase()).filter(Boolean);
    if (scopes.length === 0) throw new Error('Vercel environment row is missing scopes');
    return { name: columns[0], scopes, present: true };
  });
};

const parseEnvironmentSet = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['environment.set'],
): ProviderEnvironmentSetResult => {
  if (!/\b(?:Added|Updated) Environment Variable\b/i.test(cleanText(`${result.stdout}\n${result.stderr}`))) {
    throw new Error('Vercel environment mutation output was not recognized');
  }
  return { name: input.name, scopes: [input.scope || 'all'], updated: true };
};

const parseEnvironmentDelete = (
  result: ProviderProcessResult,
  input: DeploymentProviderOperationInputMap['environment.delete'],
): ProviderEnvironmentDeleteResult => {
  if (!/\bRemoved Environment Variable\b/i.test(cleanText(`${result.stdout}\n${result.stderr}`))) {
    throw new Error('Vercel environment deletion output was not recognized');
  }
  return { name: input.name, scopes: [input.scope || 'all'], deleted: true };
};

const parseDomainList = (result: ProviderProcessResult): ProviderDomainList => {
  const lines = cleanLines(result.stdout);
  const headerIndex = lines.findIndex((line) => /\bname\b/i.test(line) && /\bregistrar\b/i.test(line) && /\bnameservers\b/i.test(line));
  if (headerIndex < 0) throw new Error('Vercel domain list header was not recognized');
  const domains = lines.slice(headerIndex + 1).map((line) => line.trim().split(/\s{2,}/)).filter((columns) => columns.length > 1).map((columns) => {
    if (columns.length < 3 || !columns[0]) throw new Error('Vercel domain list row was not recognized');
    return { name: columns[0].toLowerCase(), registrar: columns[1], nameservers: columns[2] };
  });
  return { domains };
};

const definition = <Operation extends ProviderCommandOperation>(input: {
  capability: Operation;
  command: (value: DeploymentProviderOperationInputMap[Operation]) => ProviderCommand;
  parse: (
    result: ProviderProcessResult,
    value: DeploymentProviderOperationInputMap[Operation],
  ) => ProviderAdapterOperationOutputMap[Operation];
  policy?: ProviderOperationDefinition<Operation>['policy'];
}): ProviderOperationDefinition<Operation> => input;

const noColor = (args: string[]): string[] => [...args, '--no-color'];

export const vercelOperationCatalog = [
  {
    name: 'vercel.detect',
    capability: 'detect',
    command: 'vercel --version',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel cli version', 'vercel detect'],
  },
  {
    name: 'vercel.auth.status',
    capability: 'auth.status',
    command: 'vercel whoami --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel login status', 'vercel identity'],
  },
  {
    name: 'vercel.context.current',
    capability: 'context.current',
    command: 'vercel project inspect --yes --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel linked project', 'vercel team scope'],
  },
  {
    name: 'vercel.project.list',
    capability: 'project.list',
    command: 'vercel project list --json --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['list vercel projects'],
  },
  {
    name: 'vercel.project.link',
    capability: 'project.link',
    command: 'vercel link --project <name> [--scope <scope>] --yes --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Links the current checkout to a remote provider project and changes local provider context.',
    },
    searchTerms: ['link vercel project', 'select vercel project'],
  },
  {
    name: 'vercel.project.configuration',
    capability: 'project.configuration',
    command: 'vercel project inspect [project] --yes --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel project configuration', 'vercel project settings'],
  },
  {
    name: 'vercel.domain.list',
    capability: 'domain.list',
    command: 'vercel domains list --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['list vercel domains', 'vercel domain inventory'],
  },
  {
    name: 'vercel.deployment.list',
    capability: 'deployment.list',
    command: 'vercel list [project] [--environment <environment>] [--next <cursor>] --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['list vercel deployments', 'vercel deployment history'],
  },
  {
    name: 'vercel.deployment.status',
    capability: 'deployment.status',
    command: 'vercel inspect <deployment> --json --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel deployment status', 'inspect vercel deployment'],
  },
  {
    name: 'vercel.logs.read',
    capability: 'logs.read',
    command: 'vercel logs <deployment> --json --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel runtime logs', 'read vercel logs'],
  },
  {
    name: 'vercel.deploy.preview',
    capability: 'deploy',
    command: 'vercel deploy <path> --target preview --yes --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Creates a Vercel preview deployment without assigning production domains.',
    },
    searchTerms: ['vercel preview deploy'],
  },
  {
    name: 'vercel.deploy.production',
    capability: 'deploy',
    command: 'vercel deploy <path> --target production --yes --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Creates a Vercel production deployment and may reassign customer-facing domains.',
    },
    searchTerms: ['vercel production deploy'],
  },
  {
    name: 'vercel.redeploy',
    capability: 'redeploy',
    command: 'vercel redeploy <deployment> [--target <target>] --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Rebuilds or restarts an existing deployment and may affect availability.',
    },
    searchTerms: ['redeploy vercel deployment', 'rebuild vercel deployment'],
  },
  {
    name: 'vercel.deployment.promote',
    capability: 'deployment.promote',
    command: 'vercel promote <deployment> --yes --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Promotes an existing deployment and may reassign customer-facing traffic.',
    },
    searchTerms: ['promote vercel deployment'],
  },
  {
    name: 'vercel.environment.listNames',
    capability: 'environment.listNames',
    command: 'vercel env list [environment] --no-color',
    readOnly: true,
    approval: { required: false },
    searchTerms: ['vercel env names scopes'],
  },
  {
    name: 'vercel.environment.set',
    capability: 'environment.set',
    command: 'vercel env add <name> [environment] --force --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Changes provider environment metadata and can alter future deployments.',
    },
    searchTerms: ['set vercel environment variable'],
  },
  {
    name: 'vercel.environment.delete',
    capability: 'environment.delete',
    command: 'vercel env remove <name> [environment] --yes --no-color',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Deletes provider environment metadata and can break future deployments.',
    },
    searchTerms: ['delete vercel environment variable'],
  },
  {
    name: 'vercel.raw',
    capability: 'raw',
    command: 'vercel <argv...>',
    readOnly: false,
    approval: {
      required: true,
      consequence: 'Runs an arbitrary provider CLI command that may change remote resources.',
    },
    searchTerms: ['raw vercel cli'],
  },
] as const;

export const vercelProviderLimitations = [
  'Vercel project inspect, deployment list, environment list, and domain list are human-readable CLI surfaces; parsers fail closed when their headers or required fields drift.',
  'Runtime logs are bounded by the shared process limit and may stop at timeout before Vercel CLI finishes its five-minute live stream.',
  'Domain inventory is scope-wide because Vercel CLI does not expose a project filter for domains list.',
  'Environment values are accepted only through stdin and are never returned by list, set, delete, diagnostics, or raw normalization.',
] as const;

export const vercelLiveValidationChecklist = [
  'Run detect and confirm the installed Vercel CLI reports a supported 40.x-50.x semantic version.',
  'Run auth.status and confirm only authenticated state and CLI identity are returned.',
  'From a linked checkout, run context.current, project.list, deployment.list, and project.configuration.',
  'Inspect one known deployment with deployment.status and read a short bounded logs.read sample.',
  'List environment names/scopes and domains; confirm no environment values or token-bearing URL parameters appear.',
  'Do not run project.link, deploy, redeploy, deployment.promote, environment.set, environment.delete, or raw during read-only live validation.',
] as const;

export const createVercelProviderAdapter = (): DeploymentProviderAdapter => ({
  provider: 'vercel',
  executable: 'vercel',
  capabilities: deploymentProviderOperations,
  version: {
    args: ['--version'],
    parse: parseVersion,
    supports: (version) => version.major >= VERCEL_MINIMUM_MAJOR && version.major <= VERCEL_MAXIMUM_MAJOR,
  },
  operations: {
    'auth.status': definition({
      capability: 'auth.status',
      command: () => ({ args: noColor(['whoami']) }),
      parse: (result) => {
        const identity = cleanText(result.stdout);
        if (!identity || identity.includes('\n')) throw new Error('Vercel whoami output was not recognized');
        return { authenticated: true, identity };
      },
    }),
    'context.current': definition({
      capability: 'context.current',
      command: () => ({ args: noColor(['project', 'inspect', '--yes']) }),
      parse: (result) => {
        const project = parseProjectInspection(result.stdout);
        return {
          project: { id: project.id, name: project.name },
          ...(project.team ? { team: project.team } : {}),
          ...(project.scope ? { scope: project.scope } : {}),
        };
      },
    }),
    'project.list': definition({
      capability: 'project.list',
      command: (input) => ({
        args: noColor([
          'project',
          'list',
          '--json',
          ...(input.cursor ? ['--next', decodeCursor(input.cursor)] : []),
        ]),
      }),
      parse: parseProjectList,
    }),
    'project.link': definition({
      capability: 'project.link',
      policy: providerOperationPolicy('project.link'),
      command: (input) => ({
        args: noColor([
          'link',
          '--project',
          input.project,
          ...(input.scope ? ['--scope', input.scope] : []),
          '--yes',
        ]),
        ...(input.path ? { cwd: input.path } : {}),
      }),
      parse: parseProjectLink,
    }),
    'project.configuration': definition({
      capability: 'project.configuration',
      command: (input) => ({
        args: noColor([
          'project',
          'inspect',
          ...(input.projectId ? [input.projectId] : []),
          '--yes',
        ]),
      }),
      parse: (result) => parseProjectInspection(result.stdout),
    }),
    'domain.list': definition({
      capability: 'domain.list',
      command: () => ({ args: noColor(['domains', 'list']) }),
      parse: parseDomainList,
    }),
    'deployment.list': definition({
      capability: 'deployment.list',
      command: (input) => ({
        args: noColor([
          'list',
          ...(input.projectId ? [input.projectId] : []),
          ...(input.environment ? ['--environment', input.environment] : []),
          ...(input.cursor ? ['--next', input.cursor] : []),
        ]),
      }),
      parse: parseDeploymentList,
    }),
    'deployment.status': definition({
      capability: 'deployment.status',
      command: (input) => ({ args: noColor(['inspect', input.deploymentId, '--json']) }),
      parse: parseDeploymentStatus,
    }),
    'deployment.promote': definition({
      capability: 'deployment.promote',
      policy: providerOperationPolicy('deployment.promote'),
      command: (input) => ({ args: noColor(['promote', input.deploymentId, '--yes']) }),
      parse: parsePromotion,
    }),
    'logs.read': definition({
      capability: 'logs.read',
      command: (input) => {
        if (!input.deploymentId) throw new Error('Vercel logs require deploymentId');
        return { args: noColor(['logs', input.deploymentId, '--json']) };
      },
      parse: parseLogs,
    }),
    deploy: definition({
      capability: 'deploy',
      policy: (input) => input.target.toLowerCase() === 'preview'
        ? strictPolicy('deploy', 'Creates a Vercel preview deployment without assigning production domains.')
        : input.target.toLowerCase() === 'production'
          ? strictPolicy('deploy', 'Creates a Vercel production deployment and may reassign customer-facing domains.')
          : providerOperationPolicy('deploy'),
      command: (input) => {
        const target = input.target.toLowerCase();
        if (target !== 'preview' && target !== 'production') {
          throw new Error('Vercel deploy target must be preview or production');
        }
        return { args: noColor(['deploy', input.source || '.', '--target', target, '--yes']) };
      },
      parse: parseDeploymentMutation,
    }),
    redeploy: definition({
      capability: 'redeploy',
      command: (input) => ({
        args: noColor([
          'redeploy',
          input.deploymentId,
          ...(input.target ? ['--target', input.target] : []),
        ]),
      }),
      parse: parseDeploymentMutation,
    }),
    'environment.listNames': definition({
      capability: 'environment.listNames',
      command: (input) => ({
        args: noColor(['env', 'list', ...(input.environment ? [input.environment] : [])]),
      }),
      parse: parseEnvironmentList,
    }),
    'environment.set': definition({
      capability: 'environment.set',
      command: (input) => ({
        args: noColor([
          'env',
          'add',
          input.name,
          ...(input.scope ? [input.scope] : []),
          '--force',
        ]),
        stdin: input.value,
      }),
      parse: parseEnvironmentSet,
    }),
    'environment.delete': definition({
      capability: 'environment.delete',
      policy: providerOperationPolicy('environment.delete'),
      command: (input) => ({
        args: noColor([
          'env',
          'remove',
          input.name,
          ...(input.scope ? [input.scope] : []),
          '--yes',
        ]),
      }),
      parse: parseEnvironmentDelete,
    }),
    raw: definition({
      capability: 'raw',
      command: (input) => ({ args: [...input.args] }),
      parse: (result) => ({ stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }),
    }),
  },
});
