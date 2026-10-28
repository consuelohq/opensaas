import { Effect } from 'effect';

import { deploymentProviderOperations, type DeploymentProviderCapability } from './schema';
import type {
  DeploymentProviderAdapter,
  DeploymentProviderOperationInputMap,
  ProviderAdapterOperationOutputMap,
  ProviderCommandOperation,
  ProviderOperationDefinition,
  ProviderProcess,
  ProviderProcessRequest,
  ProviderProcessResult,
  ProviderVersion,
} from './types';

export const providerProcessResult = (
  overrides: Partial<ProviderProcessResult> = {},
): ProviderProcessResult => {
  return {
    stdout: '',
    stderr: '',
    exitCode: overrides.runtimeMissing ? 1 : 0,
    timedOut: false,
    cancelled: false,
    runtimeMissing: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    ...overrides,
  };
};

export const createFakeProviderProcess = (initialResults: ProviderProcessResult[]): {
  process: ProviderProcess;
  requests: ProviderProcessRequest[];
  push: (result: ProviderProcessResult) => void;
} => {
  const results = [...initialResults];
  const requests: ProviderProcessRequest[] = [];
  return {
    process: {
      execPath: process.execPath,
      run: (request) => {
        requests.push({ ...request, args: [...request.args], env: { ...request.env } });
        return Effect.succeed(results.shift() || providerProcessResult({
          exitCode: 1,
          stderr: 'fake provider process has no queued result',
        }));
      },
    },
    requests,
    push: (result) => { results.push(result); },
  };
};

const parseJson = <Value>(result: ProviderProcessResult): Value => {
  return JSON.parse(result.stdout) as Value;
};

const inputString = (input: object, key: string, fallback: string): string => {
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : fallback;
};

const definition = <Operation extends ProviderCommandOperation>(
  capability: Operation,
  args: (input: DeploymentProviderOperationInputMap[Operation]) => string[],
  parse: (result: ProviderProcessResult) => ProviderAdapterOperationOutputMap[Operation] =
    (result) => parseJson<ProviderAdapterOperationOutputMap[Operation]>(result),
): ProviderOperationDefinition<Operation> => {
  return {
    capability,
    command: (input) => ({ args: args(input) }),
    parse,
  };
};

const parseVersion = (output: string): ProviderVersion | null => {
  let raw = '';
  try {
    const value = JSON.parse(output.trim()) as { version?: unknown };
    if (typeof value.version === 'string') raw = value.version;
  } catch {
    raw = output.match(/\b\d+\.\d+\.\d+\b/)?.[0] || '';
  }
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const createFakeDeploymentProviderAdapter = (options: {
  provider?: string;
  executable?: string;
  capabilities?: readonly DeploymentProviderCapability[];
  rawPrefixArgs?: readonly string[];
} = {}): DeploymentProviderAdapter => {
  const rawPrefixArgs = [...(options.rawPrefixArgs || [])];
  return {
    provider: options.provider || 'fixture',
    executable: options.executable || 'fixture-cli',
    capabilities: options.capabilities || deploymentProviderOperations,
    version: {
      args: ['version', '--json'],
      parse: parseVersion,
      supports: (version) => version.major >= 1 && version.major < 3,
    },
    operations: {
      'auth.status': definition('auth.status', () => ['auth', 'status', '--json']),
      'context.current': definition('context.current', () => ['context', 'current', '--json']),
      'project.list': definition('project.list', () => ['project', 'list', '--json']),
      'service.list': definition('service.list', () => ['service', 'list', '--json']),
      'deployment.list': definition('deployment.list', () => ['deployment', 'list', '--json']),
      'deployment.status': definition(
        'deployment.status',
        (input) => ['deployment', 'status', inputString(input, 'deploymentId', 'current'), '--json'],
      ),
      'logs.read': definition(
        'logs.read',
        (input) => ['logs', 'read', inputString(input, 'deploymentId', 'current'), '--json'],
      ),
      deploy: definition(
        'deploy',
        (input) => ['deploy', '--target', inputString(input, 'target', 'preview'), '--json'],
      ),
      redeploy: definition(
        'redeploy',
        (input) => ['redeploy', inputString(input, 'deploymentId', 'current'), '--json'],
      ),
      'environment.listNames': definition('environment.listNames', () => ['environment', 'list', '--json']),
      'environment.set': {
        capability: 'environment.set',
        command: (input: DeploymentProviderOperationInputMap['environment.set']) => ({
          args: ['environment', 'set', input.name, '--scope', input.scope || 'production'],
          stdin: input.value,
        }),
        parse: (result) => parseJson<ProviderAdapterOperationOutputMap['environment.set']>(result),
      },
      'environment.delete': definition(
        'environment.delete',
        (input) => ['environment', 'delete', input.name],
      ),
      raw: definition(
        'raw',
        (input) => [
          ...rawPrefixArgs,
          ...(Array.isArray(input.args)
            ? input.args.filter((argument): argument is string => typeof argument === 'string')
            : []),
        ],
        (result) => ({ stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }),
      ),
    },
  };
};
