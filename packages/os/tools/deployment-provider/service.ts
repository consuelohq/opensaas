import { Effect } from 'effect';

import { redactJson } from '../../scripts/lib/redaction';
import {
  providerError,
  type ProviderCommandDiagnostics,
  type ProviderError,
  type ProviderErrorCode,
} from './errors';
import { redactProviderText } from './redaction';
import {
  providerOperationPolicy,
  type DeploymentProviderOperation,
  type ProviderOperationPolicy,
} from './schema';
import type {
  DeploymentProviderAdapter,
  DeploymentProviderOperationInputMap,
  DeploymentProviderOperationOutputMap,
  DeploymentProviderService,
  ProviderAuthStatus,
  ProviderCommand,
  ProviderCommandOperation,
  ProviderDetection,
  ProviderEnvironmentDeleteResult,
  ProviderEnvironmentSetResult,
  ProviderEnvironmentVariableMetadata,
  ProviderExecutionOptions,
  ProviderOperationDefinition,
  ProviderProcess,
  ProviderProcessResult,
  ProviderRawResult,
} from './types';
import { createNodeProviderProcess } from './process';

export type DeploymentProviderServiceOptions = {
  process?: ProviderProcess;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  defaultTimeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;

const diagnostics = (command: string, result: ProviderProcessResult): ProviderCommandDiagnostics => {
  return {
    command,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    cancelled: result.cancelled,
    stdout: redactProviderText(result.stdout),
    stderr: redactProviderText(result.stderr),
    ...(result.stdoutTruncated ? { stdoutTruncated: true } : {}),
    ...(result.stderrTruncated ? { stderrTruncated: true } : {}),
  };
};

const failureCode = (result: ProviderProcessResult): ProviderErrorCode => {
  if (result.runtimeMissing) return 'CLI_MISSING';
  if (result.cancelled) return 'CANCELLED';
  if (result.timedOut) return 'TIMEOUT';
  const detail = `${result.stderr}\n${result.stdout}`;
  if (/not authenticated|not logged in|login required|unauthenticated/i.test(detail)) return 'UNAUTHENTICATED';
  if (/not linked|no project|no context|project.*required/i.test(detail)) return 'NO_CONTEXT';
  if (/permission denied|forbidden|not authorized/i.test(detail)) return 'PERMISSION_DENIED';
  if (/rate.?limit|too many requests|\b429\b/i.test(detail)) return 'RATE_LIMITED';
  if (/unavailable|temporarily unavailable|ECONNREFUSED|ENETUNREACH|\b50[234]\b/i.test(detail)) return 'UNAVAILABLE';
  return 'COMMAND_FAILED';
};

const failureMessage = (
  provider: string,
  operation: DeploymentProviderOperation,
  executable: string,
  code: ProviderErrorCode,
): string => {
  if (code === 'CLI_MISSING') return `${executable} is not installed or is not available on PATH`;
  if (code === 'TIMEOUT') return `${provider} ${operation} timed out`;
  if (code === 'CANCELLED') return `${provider} ${operation} was cancelled`;
  return `${provider} ${operation} failed`;
};

const operationPolicy = <Operation extends DeploymentProviderOperation>(
  adapter: DeploymentProviderAdapter,
  operation: Operation,
  input?: Partial<DeploymentProviderOperationInputMap[Operation]>,
): ProviderOperationPolicy => {
  if (operation === 'detect') return providerOperationPolicy(operation);
  const definition = adapter.operations[operation as ProviderCommandOperation];
  const configured = definition?.policy as
    | ProviderOperationPolicy
    | ((value: unknown) => ProviderOperationPolicy)
    | undefined;
  if (typeof configured === 'function') return configured(input);
  return configured || providerOperationPolicy(operation);
};

const hasApproval = (input: ProviderExecutionOptions): boolean => {
  return input.approval?.approved === true;
};

const normalizeAuthStatus = (value: unknown): ProviderAuthStatus => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('authentication status must be an object');
  }
  const record = value as Record<string, unknown>;
  const authenticated = record.authenticated === true;
  const identityCandidate = record.identity ?? record.account ?? record.email ?? record.user;
  return {
    authenticated,
    ...(typeof identityCandidate === 'string' && identityCandidate.trim()
      ? { identity: redactProviderText(identityCandidate.trim()) }
      : {}),
    source: 'cli',
  };
};

const normalizeEnvironmentMetadata = (value: unknown): ProviderEnvironmentVariableMetadata[] => {
  if (!Array.isArray(value)) throw new Error('environment metadata must be an array');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('environment metadata entries must be objects');
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error('environment metadata entry is missing a name');
    }
    const scopes = Array.isArray(record.scopes)
      ? record.scopes.filter((scope): scope is string => typeof scope === 'string')
      : typeof record.scope === 'string'
        ? [record.scope]
        : [];
    const present = typeof record.present === 'boolean'
      ? record.present
      : record.value !== null && record.value !== undefined;
    return { name: record.name, scopes, present };
  });
};

const normalizeEnvironmentDeleteResult = (value: unknown): ProviderEnvironmentDeleteResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('environment deletion result must be an object');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string' || !record.name.trim()) {
    throw new Error('environment deletion result is missing a name');
  }
  if (typeof record.deleted !== 'boolean') {
    throw new Error('environment deletion result is missing deleted status');
  }
  const scopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof record.scope === 'string'
      ? [record.scope]
      : [];
  return { name: record.name, scopes, deleted: record.deleted };
};

const normalizeEnvironmentSetResult = (value: unknown): ProviderEnvironmentSetResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('environment mutation result must be an object');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string' || !record.name.trim()) {
    throw new Error('environment mutation result is missing a name');
  }
  if (typeof record.updated !== 'boolean') {
    throw new Error('environment mutation result is missing updated status');
  }
  const scopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof record.scope === 'string'
      ? [record.scope]
      : [];
  return {
    name: record.name,
    scopes,
    updated: record.updated,
  };
};

const normalizeRawResult = (result: ProviderProcessResult): ProviderRawResult => {
  return {
    stdout: redactProviderText(result.stdout),
    stderr: redactProviderText(result.stderr),
    exitCode: result.exitCode,
    ...(result.stdoutTruncated ? { stdoutTruncated: true } : {}),
    ...(result.stderrTruncated ? { stderrTruncated: true } : {}),
  };
};

export const createDeploymentProviderService = (
  adapter: DeploymentProviderAdapter,
  options: DeploymentProviderServiceOptions = {},
): DeploymentProviderService => {
  const providerProcess = options.process || createNodeProviderProcess();
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_TIMEOUT_MS;

  const runCommand = (
    operation: DeploymentProviderOperation,
    command: ProviderCommand,
    input: ProviderExecutionOptions,
    acceptPartialResult?: (result: ProviderProcessResult) => boolean,
  ) => providerProcess.run({
    command: command.command || adapter.executable,
    args: [...command.args],
    cwd: command.cwd || cwd,
    env: { ...env, ...command.env },
    timeoutMs: input.timeoutMs || defaultTimeoutMs,
    ...(input.signal ? { signal: input.signal } : {}),
    ...(command.stdin !== undefined ? { stdin: command.stdin } : {}),
  }).pipe(
    Effect.flatMap((result) => {
      const complete = result.exitCode === 0 && !result.runtimeMissing && !result.timedOut && !result.cancelled;
      const acceptedPartial = !result.runtimeMissing && !result.cancelled && acceptPartialResult?.(result) === true;
      if (complete || acceptedPartial) {
        return Effect.succeed(result);
      }
      const code = failureCode(result);
      return Effect.fail(providerError({
        code,
        provider: adapter.provider,
        operation,
        message: failureMessage(adapter.provider, operation, command.command || adapter.executable, code),
        diagnostics: diagnostics(command.command || adapter.executable, result),
      }));
    }),
  );

  const execute = <Operation extends ProviderCommandOperation>(
    operation: Operation,
    input: DeploymentProviderOperationInputMap[Operation],
  ): Effect.Effect<DeploymentProviderOperationOutputMap[Operation], ProviderError> => {
    return Effect.gen(function* () {
      const definition = adapter.operations[operation] as ProviderOperationDefinition<Operation> | undefined;
      if (!adapter.capabilities.includes(operation) || !definition) {
        return yield* Effect.fail(providerError({
          code: 'UNSUPPORTED_CAPABILITY',
          provider: adapter.provider,
          operation,
          message: `${adapter.provider} does not support ${operation}`,
        }));
      }
      const policy = operationPolicy(adapter, operation, input);
      if (policy.approval.required && !hasApproval(input)) {
        return yield* Effect.fail(providerError({
          code: 'APPROVAL_REQUIRED',
          provider: adapter.provider,
          operation,
          message: `${adapter.provider} ${operation} requires explicit approval`,
          approval: policy.approval,
        }));
      }

      let command: ProviderCommand;
      try {
        command = definition.command(input);
      } catch (cause: unknown) {
        return yield* Effect.fail(providerError({
          code: 'MALFORMED_OUTPUT',
          provider: adapter.provider,
          operation,
          message: `${adapter.provider} could not build ${operation}`,
          cause,
        }));
      }
      const result = yield* runCommand(operation, command, input, definition.acceptPartialResult);
      if (operation === 'raw') {
        return normalizeRawResult(result) as DeploymentProviderOperationOutputMap[Operation];
      }

      try {
        const parsed = definition.parse(result, input);
        if (operation === 'auth.status') {
          return normalizeAuthStatus(parsed) as DeploymentProviderOperationOutputMap[Operation];
        }
        if (operation === 'environment.listNames') {
          return normalizeEnvironmentMetadata(parsed) as DeploymentProviderOperationOutputMap[Operation];
        }
        if (operation === 'environment.set') {
          return normalizeEnvironmentSetResult(parsed) as DeploymentProviderOperationOutputMap[Operation];
        }
        if (operation === 'environment.delete') {
          return normalizeEnvironmentDeleteResult(parsed) as DeploymentProviderOperationOutputMap[Operation];
        }
        return redactJson(parsed) as DeploymentProviderOperationOutputMap[Operation];
      } catch (cause: unknown) {
        return yield* Effect.fail(providerError({
          code: 'MALFORMED_OUTPUT',
          provider: adapter.provider,
          operation,
          message: `${adapter.provider} returned malformed output for ${operation}`,
          diagnostics: diagnostics(command.command || adapter.executable, result),
          cause,
        }));
      }
    });
  };

  const detect = (): Effect.Effect<ProviderDetection, ProviderError> => Effect.gen(function* () {
    if (!adapter.capabilities.includes('detect')) {
      return yield* Effect.fail(providerError({
        code: 'UNSUPPORTED_CAPABILITY',
        provider: adapter.provider,
        operation: 'detect',
        message: `${adapter.provider} does not support detect`,
      }));
    }
    const result = yield* runCommand('detect', { args: adapter.version.args }, {});
    let version: ProviderDetection['version'] | null;
    try {
      version = adapter.version.parse(`${result.stdout}\n${result.stderr}`);
    } catch (cause: unknown) {
      return yield* Effect.fail(providerError({
        code: 'MALFORMED_OUTPUT',
        provider: adapter.provider,
        operation: 'detect',
        message: `${adapter.provider} CLI version output could not be parsed`,
        diagnostics: diagnostics(adapter.executable, result),
        cause,
      }));
    }
    if (!version) {
      return yield* Effect.fail(providerError({
        code: 'MALFORMED_OUTPUT',
        provider: adapter.provider,
        operation: 'detect',
        message: `${adapter.provider} CLI version output was not recognized`,
        diagnostics: diagnostics(adapter.executable, result),
      }));
    }
    if (!adapter.version.supports(version)) {
      return yield* Effect.fail(providerError({
        code: 'UNSUPPORTED_VERSION',
        provider: adapter.provider,
        operation: 'detect',
        message: `${adapter.provider} CLI version ${version.raw} is unsupported`,
        diagnostics: diagnostics(adapter.executable, result),
      }));
    }
    return { provider: adapter.provider, executable: adapter.executable, version };
  });

  return {
    policy: (operation, input) => operationPolicy(adapter, operation, input),
    detect,
    authStatus: () => execute('auth.status', {}),
    contextCurrent: (input = {}) => execute('context.current', input),
    projectList: (input = {}) => execute('project.list', input),
    projectLink: (input) => execute('project.link', input),
    projectConfiguration: (input = {}) => execute('project.configuration', input),
    domainList: (input = {}) => execute('domain.list', input),
    deploymentList: (input = {}) => execute('deployment.list', input),
    deploymentStatus: (input) => execute('deployment.status', input),
    logsRead: (input = {}) => execute('logs.read', input),
    deploy: (input) => execute('deploy', input),
    redeploy: (input) => execute('redeploy', input),
    deploymentPromote: (input) => execute('deployment.promote', input),
    environmentListNames: (input = {}) => execute('environment.listNames', input),
    environmentSet: (input) => execute('environment.set', input),
    environmentDelete: (input) => execute('environment.delete', input),
    raw: (input) => execute('raw', input),
    execute,
  };
};
