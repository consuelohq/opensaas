import { Effect } from 'effect';

import { ProviderError } from '../deployment-provider/errors';
import type { ProviderLogResult } from '../deployment-provider/types';
import { createRailwayService, type RailwayService } from './service';

export type RailwayLogsCliArgs = {
  serviceId: string;
  environment?: string;
  deploymentId?: string;
  kind: 'runtime' | 'build';
  filter?: string;
  limit: number;
  since?: string;
  until?: string;
  latest?: boolean;
  errorsOnly?: boolean;
  statusOnly?: boolean;
  environmentNameCheck?: string;
  raw?: boolean;
  json: boolean;
  quiet: boolean;
  help?: boolean;
};

export type RailwayRedeployCliArgs = {
  serviceId: string;
  environment?: string;
  wait: boolean;
  timeoutMs: number;
  approved: boolean;
  json: boolean;
  quiet: boolean;
  help?: boolean;
};

type CliIo = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

type RailwayCliDependencies = {
  service?: RailwayService;
  io?: Partial<CliIo>;
};

const defaultIo: CliIo = {
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`),
};

const optionValue = (argv: readonly string[], index: number, option: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${option} requires a value`);
  return value;
};

const positiveInteger = (value: string, option: string, maximum: number): number => {
  if (!/^\d+$/.test(value)) throw new Error(`${option} requires a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${option} must be between 1 and ${maximum}`);
  }
  return parsed;
};

const parseDuration = (value: string): number => {
  const match = value.match(/^(\d+)(ms|s|m|h)?$/);
  if (!match) throw new Error('--timeout expects values such as 30000ms, 90s, 10m, or 1h');
  const amount = Number(match[1]);
  const multiplier = match[2] === 'h'
    ? 60 * 60_000
    : match[2] === 'm'
      ? 60_000
      : match[2] === 's' || !match[2]
        ? 1_000
        : 1;
  const result = amount * multiplier;
  if (result < 1 || result > 60 * 60_000) throw new Error('--timeout must be between 1 ms and 1 hour');
  return result;
};

export const parseRailwayLogsArgs = (argv: readonly string[]): RailwayLogsCliArgs => {
  const args: Partial<RailwayLogsCliArgs> = {
    kind: 'runtime',
    limit: 200,
    json: false,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--service':
        args.serviceId = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--environment':
        args.environment = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--deployment':
        args.deploymentId = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--build':
        args.kind = 'build';
        break;
      case '--runtime':
        args.kind = 'runtime';
        break;
      case '--filter':
        args.filter = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--errors':
        args.errorsOnly = true;
        args.filter = '@level:error';
        break;
      case '--lines':
        args.limit = positiveInteger(optionValue(argv, index, argument), argument, 1_000);
        index += 1;
        break;
      case '--since':
        args.since = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--until':
        args.until = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--latest':
        args.latest = true;
        break;
      case '--status':
        args.statusOnly = true;
        break;
      case '--env':
        args.environmentNameCheck = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--raw':
        args.raw = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--network':
        throw new Error('--network is unsupported because Railway CLI does not expose structured network-flow logs');
      default:
        throw new Error(`unknown option: ${argument}`);
    }
  }

  if (!args.help && !args.serviceId) {
    throw new Error('--service is required; the Railway wrapper has no hidden service default');
  }
  return args as RailwayLogsCliArgs;
};

export const parseRailwayRedeployArgs = (argv: readonly string[]): RailwayRedeployCliArgs => {
  const args: Partial<RailwayRedeployCliArgs> = {
    wait: false,
    timeoutMs: 15 * 60_000,
    approved: false,
    json: false,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--service':
        args.serviceId = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--environment':
        args.environment = optionValue(argv, index, argument);
        index += 1;
        break;
      case '--wait':
        args.wait = true;
        break;
      case '--timeout':
        args.timeoutMs = parseDuration(optionValue(argv, index, argument));
        index += 1;
        break;
      case '--yes':
        args.approved = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`unknown option: ${argument}`);
    }
  }

  if (!args.help && !args.serviceId) {
    throw new Error('--service is required; the Railway wrapper has no hidden service default');
  }
  if (!args.help && !args.approved) {
    throw new Error('--yes is required to approve the Railway redeploy consequence');
  }
  return args as RailwayRedeployCliArgs;
};

const logsHelp = (): string => [
  'usage: bun run railway:logs -- --service <name-or-id> [options]',
  '',
  'Read bounded structured Railway logs through the authenticated Railway CLI.',
  '',
  'options:',
  '  --service <value>      required service name or id',
  '  --environment <value>  optional environment name or id',
  '  --deployment <id>      optional deployment id',
  '  --build                read build logs',
  '  --runtime              read deployment/runtime logs (default)',
  '  --filter <query>        Railway log query',
  '  --errors               shorthand for --filter @level:error',
  '  --lines <1..1000>      bounded log count (default: 200)',
  '  --since <time>         relative or ISO-8601 start',
  '  --until <time>         relative or ISO-8601 end',
  '  --latest               choose the latest deployment, including failures',
  '  --status               show recent deployment status only',
  '  --env <name>           report set/missing without returning the value',
  '  --raw                  print normalized log messages without metadata',
  '  --json                 emit a JSON envelope',
  '  --quiet                suppress progress messages',
  '',
  'Unsupported: network-flow and HTTP request logs are not available through a stable structured Railway CLI command.',
].join('\n');

const redeployHelp = (): string => [
  'usage: bun run railway:redeploy -- --service <name-or-id> --yes [options]',
  '',
  'Redeploy an explicitly selected Railway service through the authenticated CLI.',
  '',
  'options:',
  '  --service <value>      required service name or id',
  '  --environment <value>  optional environment name or id for deployment polling',
  '  --yes                  required approval',
  '  --wait                 wait for a terminal deployment status',
  '  --timeout <duration>   bounded wait, maximum 1h (default: 15m)',
  '  --json                 emit a JSON envelope',
  '  --quiet                suppress progress messages',
].join('\n');

const providerFailure = (error: unknown): { code: string; message: string } => {
  if (error instanceof ProviderError) return { code: error.code, message: error.message };
  return { code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) };
};

const formatLogLine = (entry: ProviderLogResult['entries'][number]): string => {
  return [entry.timestamp, entry.level ? `[${entry.level}]` : undefined, entry.message]
    .filter(Boolean)
    .join(' ');
};

export const runRailwayLogsCli = async (
  argv: readonly string[],
  dependencies: RailwayCliDependencies = {},
): Promise<number> => {
  const io: CliIo = { ...defaultIo, ...dependencies.io };
  let args: RailwayLogsCliArgs;
  try {
    args = parseRailwayLogsArgs(argv);
  } catch (error: unknown) {
    const failure = providerFailure(error);
    const wantsJson = argv.includes('--json');
    (wantsJson ? io.stdout : io.stderr)(wantsJson ? JSON.stringify({ ok: false, error: failure }) : failure.message);
    return 1;
  }
  if (args.help) {
    io.stdout(logsHelp());
    return 0;
  }

  const service = dependencies.service || createRailwayService();
  if (!args.quiet) io.stderr(`reading ${args.kind} logs for ${args.serviceId}`);
  try {
    let data: unknown;
    if (args.environmentNameCheck) {
      const variables = await Effect.runPromise(service.environmentListNames({
        serviceId: args.serviceId,
        environment: args.environment,
      }));
      data = {
        name: args.environmentNameCheck,
        present: variables.some((variable) => variable.name === args.environmentNameCheck && variable.present),
      };
    } else if (args.statusOnly) {
      const deployments = await Effect.runPromise(service.deploymentList({
        serviceId: args.serviceId,
        environment: args.environment,
        limit: 1,
      }));
      data = deployments.deployments[0] || null;
    } else {
      data = await Effect.runPromise(service.logsRead({
        serviceId: args.serviceId,
        environment: args.environment,
        deploymentId: args.deploymentId,
        kind: args.kind,
        filter: args.filter,
        limit: args.limit,
        since: args.since,
        until: args.until,
        latest: args.latest,
      }));
    }

    if (args.json) {
      io.stdout(JSON.stringify({ ok: true, data }, null, 2));
    } else if (isLogResult(data)) {
      if (args.raw) {
        for (const entry of data.entries) io.stdout(entry.message);
      } else {
        io.stdout(`service: ${args.serviceId}`);
        io.stdout(`kind: ${data.kind || args.kind}`);
        io.stdout(`entries: ${data.returned ?? data.entries.length}${data.truncated ? ' (truncated)' : ''}`);
        for (const entry of data.entries) io.stdout(formatLogLine(entry));
      }
    } else if (isPresenceResult(data)) {
      io.stdout(`${data.name}: ${data.present ? 'set' : 'missing'}`);
    } else {
      io.stdout(data ? JSON.stringify(data, null, 2) : 'no deployment found');
    }
    return 0;
  } catch (error: unknown) {
    const failure = providerFailure(error);
    (args.json ? io.stdout : io.stderr)(args.json ? JSON.stringify({ ok: false, error: failure }, null, 2) : failure.message);
    return 1;
  }
};

const isLogResult = (value: unknown): value is ProviderLogResult => {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as ProviderLogResult).entries);
};

const isPresenceResult = (value: unknown): value is { name: string; present: boolean } => {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { present?: unknown }).present === 'boolean';
};

export const runRailwayRedeployCli = async (
  argv: readonly string[],
  dependencies: RailwayCliDependencies = {},
): Promise<number> => {
  const io: CliIo = { ...defaultIo, ...dependencies.io };
  let args: RailwayRedeployCliArgs;
  try {
    args = parseRailwayRedeployArgs(argv);
  } catch (error: unknown) {
    const failure = providerFailure(error);
    const wantsJson = argv.includes('--json');
    (wantsJson ? io.stdout : io.stderr)(wantsJson ? JSON.stringify({ ok: false, error: failure }) : failure.message);
    return 1;
  }
  if (args.help) {
    io.stdout(redeployHelp());
    return 0;
  }

  const service = dependencies.service || createRailwayService();
  if (!args.quiet) io.stderr(`redeploying ${args.serviceId}`);
  try {
    const data = await Effect.runPromise(service.redeploy({
      serviceId: args.serviceId,
      environment: args.environment,
      wait: args.wait,
      timeoutMs: args.timeoutMs,
      approval: { approved: args.approved, reason: 'Approved through railway:redeploy --yes' },
    }));
    if (args.json) io.stdout(JSON.stringify({ ok: true, data }, null, 2));
    else io.stdout(`${args.serviceId}: ${data.status || 'triggered'} (${data.deploymentId})`);
    return 0;
  } catch (error: unknown) {
    const failure = providerFailure(error);
    (args.json ? io.stdout : io.stderr)(args.json ? JSON.stringify({ ok: false, error: failure }, null, 2) : failure.message);
    return 1;
  }
};
