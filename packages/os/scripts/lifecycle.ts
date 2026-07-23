#!/usr/bin/env bun

import { resolve } from 'node:path';

import {
  createHttpHealthAcceptance,
  createHttpReleaseSource,
  createLifecycleEngine,
  createReloadServiceController,
  lifecycleFailureEnvelope,
  lifecycleReleaseChannels,
  lifecycleSuccessEnvelope,
  renderLifecycleProgress,
  renderLifecycleResult,
  type LifecycleEngine,
  type LifecycleNotificationPreference,
  type LifecycleProgressEvent,
  type LifecycleReleaseChannel,
  type ReleaseSource,
} from './lib/lifecycle';

export type LifecycleCliIo = {
  stdout(value: string): void;
  stderr(value: string): void;
};

export type LifecycleCliDependencies = Partial<LifecycleCliIo> & {
  engine?: LifecycleEngine;
};

type ParsedLifecycleArgs = {
  command: string;
  positional: string[];
  channel?: LifecycleReleaseChannel;
  check: boolean;
  yes: boolean;
  json: boolean;
  quiet: boolean;
  home?: string;
  snoozedUntil?: string;
};

const HELP = `Consuelo OS lifecycle

Usage:
  consuelo status [--json] [--quiet]
  consuelo install [--channel <channel>] [--json] [--quiet]
  consuelo restart [--json] [--quiet]
  consuelo update [--channel <channel>] [--check] [--yes] [--json] [--quiet]
  consuelo channel show [--json]
  consuelo channel set <channel> [--json]
  consuelo updates notifications on|off|snooze [--until <iso>] [--json]
  consuelo repair [--json] [--quiet]

Channels: stable, beta, canary, dev, nightly
`;

function nextValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv: string[]): ParsedLifecycleArgs {
  const positional: string[] = [];
  const parsed: ParsedLifecycleArgs = {
    command: argv[0] ?? 'status',
    positional,
    check: false,
    yes: false,
    json: false,
    quiet: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--quiet') parsed.quiet = true;
    else if (arg === '--check') parsed.check = true;
    else if (arg === '--yes' || arg === '-y') parsed.yes = true;
    else if (arg === '--channel') {
      const value = nextValue(argv, index, arg);
      if (!lifecycleReleaseChannels.includes(value as LifecycleReleaseChannel)) {
        throw new Error(`unsupported release channel: ${value}`);
      }
      parsed.channel = value as LifecycleReleaseChannel;
      index += 1;
    } else if (arg === '--home') {
      parsed.home = nextValue(argv, index, arg);
      index += 1;
    } else if (arg === '--until') {
      parsed.snoozedUntil = nextValue(argv, index, arg);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      parsed.command = 'help';
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown lifecycle option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  return parsed;
}

function unavailableReleaseSource(): ReleaseSource {
  const missing = async (): Promise<never> => {
    throw new Error('CONSUELO_RELEASE_BASE_URL is required for install and update');
  };
  return {
    fetchManifest: missing,
    fetchBundle: missing,
  };
}

function trustedReleaseKeysFromEnvironment(): Record<string, string> {
  const encoded = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
  if (encoded) {
    const parsed = JSON.parse(encoded) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('CONSUELO_RELEASE_PUBLIC_KEYS_JSON must be a JSON object');
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
        if (typeof value !== 'string' || !value.trim()) {
          throw new Error(`release public key ${key} must be a non-empty PEM string`);
        }
        return [key, value];
      }),
    );
  }
  const keyId = process.env.CONSUELO_RELEASE_KEY_ID;
  const publicKey = process.env.CONSUELO_RELEASE_PUBLIC_KEY;
  return keyId && publicKey ? { [keyId]: publicKey } : {};
}

function createDefaultLifecycleEngine(input: {
  home?: string;
  quiet: boolean;
  json: boolean;
  progress: (event: LifecycleProgressEvent) => void;
}): LifecycleEngine {
  const osRoot = resolve(import.meta.dirname, '..');
  const port = process.env.CONSUELO_OS_PORT || process.env.PORT || '46321';
  const releaseBaseUrl = process.env.CONSUELO_RELEASE_BASE_URL;
  return createLifecycleEngine({
    home: input.home,
    releaseSource: releaseBaseUrl
      ? createHttpReleaseSource({ baseUrl: releaseBaseUrl })
      : unavailableReleaseSource(),
    trustedReleaseKeys: trustedReleaseKeysFromEnvironment(),
    service: createReloadServiceController({ osRoot }),
    health: createHttpHealthAcceptance({
      url: `http://127.0.0.1:${port}/health`,
      expectedName: 'consuelo-os',
    }),
    progress: input.quiet || input.json ? undefined : input.progress,
    onboarding: async () => {
      try {
        const args = [resolve(osRoot, 'scripts', 'install.ts'), '--skip-daemons'];
        if (input.home) args.push('--home', input.home);
        const child = Bun.spawn([process.execPath, ...args], {
          cwd: osRoot,
          env: process.env,
          stdin: 'inherit',
          stdout: 'inherit',
          stderr: 'inherit',
        });
        const exitCode = await child.exited;
        if (exitCode !== 0) throw new Error(`installer exited with code ${exitCode}`);
      } catch (error: unknown) {
        throw new Error(
          `interactive onboarding failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  });
}

function notificationPreference(parsed: ParsedLifecycleArgs): LifecycleNotificationPreference {
  const action = parsed.positional[1];
  if (action === 'on') return { mode: 'on' };
  if (action === 'off') return { mode: 'off' };
  if (action === 'snooze') {
    const snoozedUntil = parsed.snoozedUntil
      ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (!Number.isFinite(Date.parse(snoozedUntil))) {
      throw new Error('--until must be a valid ISO timestamp');
    }
    return { mode: 'snoozed', snoozedUntil };
  }
  throw new Error('updates notifications requires on, off, or snooze');
}

async function executeCommand(
  parsed: ParsedLifecycleArgs,
  engine: LifecycleEngine,
): Promise<Awaited<ReturnType<LifecycleEngine['status']>>> {
  switch (parsed.command) {
    case 'status':
      return engine.status();
    case 'install':
      return engine.install({ channel: parsed.channel });
    case 'restart':
      return engine.restart();
    case 'update':
      return engine.update({
        channel: parsed.channel,
        check: parsed.check,
        yes: parsed.yes,
      });
    case 'repair':
      return engine.repair();
    case 'channel': {
      const action = parsed.positional[0] ?? 'show';
      if (action === 'show') return engine.status();
      if (action !== 'set') throw new Error('channel requires show or set');
      const channel = parsed.positional[1];
      if (!lifecycleReleaseChannels.includes(channel as LifecycleReleaseChannel)) {
        throw new Error(`unsupported release channel: ${String(channel)}`);
      }
      return engine.setChannel(channel as LifecycleReleaseChannel);
    }
    case 'updates': {
      if (parsed.positional[0] !== 'notifications') {
        throw new Error('updates requires the notifications subcommand');
      }
      return engine.setUpdateNotifications(notificationPreference(parsed));
    }
    default:
      throw new Error(`unknown lifecycle command: ${parsed.command}`);
  }
}

export async function runLifecycleCli(
  argv: string[],
  dependencies: LifecycleCliDependencies = {},
): Promise<number> {
  const stdout = dependencies.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr = dependencies.stderr ?? ((value: string) => process.stderr.write(value));
  let parsed: ParsedLifecycleArgs;
  try {
    parsed = parseArgs(argv);
  } catch (error: unknown) {
    stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  if (parsed.command === 'help') {
    stdout(HELP);
    return 0;
  }

  const engine = dependencies.engine ?? createDefaultLifecycleEngine({
    home: parsed.home,
    quiet: parsed.quiet,
    json: parsed.json,
    progress: (event) => stderr(renderLifecycleProgress(event)),
  });

  try {
    const result = await executeCommand(parsed, engine);
    if (parsed.json) stdout(`${JSON.stringify(lifecycleSuccessEnvelope(parsed.command, result))}\n`);
    else if (!parsed.quiet) stdout(renderLifecycleResult(result));
    return 0;
  } catch (error: unknown) {
    if (parsed.json) stderr(`${JSON.stringify(lifecycleFailureEnvelope(parsed.command, error))}\n`);
    else stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runLifecycleCli(process.argv.slice(2));
}
