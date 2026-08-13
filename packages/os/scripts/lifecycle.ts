#!/usr/bin/env bun

import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isCancel, multiselect } from '@clack/prompts';
import chalk from 'chalk';

import {
  createHttpHealthAcceptance,
  createConnectorReadinessAcceptance,
  createGcpMetadataReleaseAuthorization,
  createHttpReleaseSource,
  createBunRuntimeMaterializer,
  createLifecycleEngine,
  createReloadServiceController,
  lifecycleError,
  lifecycleFailureEnvelope,
  lifecycleReleaseChannels,
  lifecycleSuccessEnvelope,
  renderLifecycleProgress,
  renderLifecycleResult,
  resolveLifecyclePaths,
  type LifecycleEngine,
  type LifecycleNotificationPreference,
  type LifecycleOperationResult,
  type LifecycleProgressEvent,
  type LifecycleReleaseChannel,
  type LifecycleServiceController,
} from './lib/lifecycle';
import { resolveVisibleUserRoot } from './lib/managed-user-content-release';
import {
  createDetachedNativeLifecycleOperationLauncher,
  type NativeLifecycleOperationLauncher,
  type NativeLifecycleOperationState,
} from './lib/native-lifecycle-operation';
import { createLinuxPlatformAdapter } from './lib/platforms/linux';
import {
  applySkillSelectionChange,
  readSkillSelectionSnapshot,
  type SkillSelectionAction,
  type SkillSelectionResult,
} from './lib/skill-selection';
import { createWindowsServiceController } from './lib/windows-platform';

export type LifecycleCliIo = {
  stdout(value: string): void;
  stderr(value: string): void;
};

export type LifecycleCliDependencies = Partial<LifecycleCliIo> & {
  engine?: LifecycleEngine;
  environment?: NodeJS.ProcessEnv;
  operationLauncher?: NativeLifecycleOperationLauncher;
  visibleUserRoot?: string;
  selectSkills?: (input: {
    action: SkillSelectionAction;
    candidates: string[];
  }) => Promise<string[] | null>;
};

const publicLifecycleOperationState = (
  state: NativeLifecycleOperationState,
): Omit<NativeLifecycleOperationState, 'workerPid'> => {
  const { workerPid: _workerPid, ...publicState } = state;
  return publicState;
};

type ManagedCloudNodeOnboardingDescriptor = {
  schemaVersion: 1;
  projectId?: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  authorityOrigin?: string;
};

type ParsedLifecycleArgs = {
  command: string;
  positional: string[];
  channel?: LifecycleReleaseChannel;
  check: boolean;
  yes: boolean;
  dryRun: boolean;
  removeNode: boolean;
  removeUserContent: boolean;
  json: boolean;
  quiet: boolean;
  home?: string;
  snoozedUntil?: string;
};

const HELP = `Consuelo OS

If no command is specified, Consuelo shows the local OS status.

Usage: consuelo [OPTIONS] [COMMAND] [ARGS]

Commands:
  status          Show installation and runtime status
  install         Install and configure Consuelo OS
  restart         Restart Consuelo OS services
  update          Check for or install OS updates
  repair          Repair the current installation
  rollback        Roll back to the previous verified release
  add skill       Install bundled skills (picker by default)
  remove skill    Remove installed bundled skills (picker by default)
  channel         Show or change the release channel
  updates         Manage update notification preferences
  uninstall       Remove Consuelo OS from this machine
  dev             Development and recovery commands
  help            Print this message

Options:
      --json       Machine-readable output
      --quiet      Suppress human-readable output
  -h, --help       Print help

Channels:
  stable, beta, canary, dev, nightly
`;
const DEFAULT_RELEASE_BASE_URL = 'https://install.consuelohq.com/os/releases';

function nextValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('-'))
    throw new Error(`${flag} requires a value`);
  return value;
}

function parseArgs(argv: string[]): ParsedLifecycleArgs {
  const positional: string[] = [];
  const parsed: ParsedLifecycleArgs = {
    command: 'status',
    positional,
    check: false,
    yes: false,
    dryRun: false,
    removeNode: false,
    removeUserContent: false,
    json: false,
    quiet: false,
  };

  let command: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--quiet') parsed.quiet = true;
    else if (arg === '--check') parsed.check = true;
    else if (arg === '--yes' || arg === '-y') parsed.yes = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--remove-node') parsed.removeNode = true;
    else if (arg === '--remove-user-content') parsed.removeUserContent = true;
    else if (arg === '--channel') {
      const value = nextValue(argv, index, arg);
      if (
        !lifecycleReleaseChannels.includes(value as LifecycleReleaseChannel)
      ) {
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
      if (command === undefined) command = arg;
      else positional.push(arg);
    }
  }
  if (parsed.command !== 'help') parsed.command = command ?? 'status';
  return parsed;
}

const managedOnboardingString = (
  record: Record<string, unknown>,
  key: keyof ManagedCloudNodeOnboardingDescriptor,
): string => {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`managed cloud node onboarding requires ${key}`);
  }
  return value.trim();
};

const assertNoManagedOnboardingSecrets = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (
      /(?:token|secret|private.?key|access.?key|refresh.?key|credential)/i.test(
        key,
      )
    ) {
      throw new Error(
        `managed cloud node onboarding descriptor cannot contain secret field ${key}`,
      );
    }
    assertNoManagedOnboardingSecrets(nested);
  }
};

const readManagedCloudNodeOnboardingDescriptor = (
  path: string,
): ManagedCloudNodeOnboardingDescriptor => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    throw new Error(
      `failed to read managed cloud node onboarding descriptor ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('managed cloud node onboarding descriptor must be an object');
  }
  assertNoManagedOnboardingSecrets(parsed);
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error('managed cloud node onboarding schemaVersion must be 1');
  }
  const workspaceSlug = managedOnboardingString(record, 'workspaceSlug');
  const workspaceHost = managedOnboardingString(record, 'workspaceHost');
  const normalizedHost = workspaceHost.toLowerCase().replace(/^https?:\/\//, '');
  if (
    normalizedHost !== workspaceSlug.toLowerCase() &&
    !normalizedHost.startsWith(`${workspaceSlug.toLowerCase()}.`)
  ) {
    throw new Error(
      'managed cloud node workspaceHost must belong to workspaceSlug',
    );
  }
  return {
    schemaVersion: 1,
    ...(typeof record.projectId === 'string' && record.projectId.trim()
      ? { projectId: record.projectId.trim() }
      : {}),
    workspaceId: managedOnboardingString(record, 'workspaceId'),
    workspaceSlug,
    workspaceHost,
    nodeId: managedOnboardingString(record, 'nodeId'),
    nodeName: managedOnboardingString(record, 'nodeName'),
    ...(typeof record.authorityOrigin === 'string' &&
    record.authorityOrigin.trim()
      ? { authorityOrigin: record.authorityOrigin.trim() }
      : {}),
  };
};

export const createLifecycleOnboardingCommand = (input: {
  osRoot: string;
  home?: string;
  onboardingFile?: string;
}): {
  kind: 'interactive' | 'managed-cloud-node';
  args: string[];
} => {
  const installer = resolve(input.osRoot, 'scripts', 'install.ts');
  if (!input.onboardingFile) {
    return {
      kind: 'interactive',
      args: [
        installer,
        '--skip-daemons',
        ...(input.home ? ['--home', input.home] : []),
      ],
    };
  }
  const descriptor = readManagedCloudNodeOnboardingDescriptor(
    input.onboardingFile,
  );
  return {
    kind: 'managed-cloud-node',
    args: [
      installer,
      '--yes',
      '--quiet',
      '--skip-daemons',
      '--mode',
      'cloud',
      ...(input.home ? ['--home', input.home] : []),
    ],
  };
};

function validateCommandArgs(parsed: ParsedLifecycleArgs): void {
  const rejectPositionals = (): void => {
    if (parsed.positional.length > 0) {
      throw new Error(
        `unexpected positional argument: ${parsed.positional[0]}`,
      );
    }
  };
  switch (parsed.command) {
    case 'status':
    case 'install':
    case 'restart':
    case 'update':
    case 'repair':
    case 'rollback':
    case 'uninstall':
      rejectPositionals();
      break;
    case 'add':
    case 'remove':
      if (parsed.positional[0] !== 'skill') {
        throw new Error(`${parsed.command} requires \`skill [name...]\``);
      }
      break;
    case 'dev':
      if (parsed.positional.length !== 1 || parsed.positional[0] !== 'reset') {
        throw new Error('dev requires `reset`');
      }
      break;
    case 'channel': {
      const action = parsed.positional[0] ?? 'show';
      if (action === 'show' && parsed.positional.length === 1) break;
      if (action === 'show' && parsed.positional.length === 0) break;
      if (action === 'set' && parsed.positional.length === 2) break;
      throw new Error('channel requires `show` or `set <channel>`');
    }
    case 'updates':
      if (
        parsed.positional.length !== 2 ||
        parsed.positional[0] !== 'notifications' ||
        !['on', 'off', 'snooze'].includes(parsed.positional[1])
      ) {
        throw new Error('updates requires `notifications on|off|snooze`');
      }
      break;
    default:
      throw new Error(`unknown lifecycle command: ${parsed.command}`);
  }
  if (parsed.check && parsed.command !== 'update') {
    throw new Error('--check is only valid for update');
  }
  if (parsed.yes && parsed.command !== 'update' && parsed.command !== 'dev') {
    throw new Error('--yes is only valid for update or dev reset');
  }
  if (
    parsed.dryRun &&
    !['rollback', 'uninstall', 'dev'].includes(parsed.command)
  ) {
    throw new Error(
      '--dry-run is only valid for rollback, uninstall, or dev reset',
    );
  }
  if (parsed.removeNode && parsed.command !== 'uninstall') {
    throw new Error('--remove-node is only valid for uninstall');
  }
  if (parsed.removeUserContent && parsed.command !== 'uninstall') {
    throw new Error('--remove-user-content is only valid for uninstall');
  }
  if (parsed.channel && !['install', 'update'].includes(parsed.command)) {
    throw new Error('--channel is only valid for install or update');
  }
  if (parsed.snoozedUntil && parsed.command !== 'updates') {
    throw new Error('--until is only valid for update notification snooze');
  }
}

async function promptForSkills(input: {
  action: SkillSelectionAction;
  candidates: string[];
}): Promise<string[] | null> {
  try {
    const selected = await multiselect({
      message:
        input.action === 'add' ? 'Select skills to add' : 'Select skills to remove',
      options: input.candidates.map((name) => ({ value: name, label: name })),
      required: false,
    });
    if (isCancel(selected)) return null;
    return selected as string[];
  } catch (error: unknown) {
    throw new Error('Skill selection prompt failed.', { cause: error });
  }
}

function renderSkillSelectionResult(result: SkillSelectionResult): string {
  if (!result.changed) {
    return `${chalk.dim('No skill changes needed.')}\n`;
  }
  const verb = result.action === 'add' ? 'Added' : 'Removed';
  const lines = [
    chalk.green(`✓ ${verb} ${result.changedSkills.length} skill${result.changedSkills.length === 1 ? '' : 's'}`),
    ...result.changedSkills.map((name) => `  ${chalk.cyan(name)}`),
  ];
  if (result.reviewRequired.length > 0) {
    lines.push(
      chalk.yellow(
        `  Preserved local changes for review: ${result.reviewRequired.join(', ')}`,
      ),
    );
  }
  return `${lines.join('\n')}\n`;
}

async function runSkillSelectionCli(input: {
  parsed: ParsedLifecycleArgs;
  dependencies: LifecycleCliDependencies;
  stdout: (value: string) => void;
}): Promise<number> {
  const action = input.parsed.command as SkillSelectionAction;
  const snapshot = readSkillSelectionSnapshot(input.parsed.home);
  let skills = input.parsed.positional.slice(1);

  if (skills.length === 0) {
    if (input.parsed.json) {
      throw new Error(
        `${action} skill requires at least one skill name when --json is used`,
      );
    }
    const candidates = action === 'add' ? snapshot.addable : snapshot.removable;
    if (candidates.length === 0) {
      if (!input.parsed.quiet) {
        input.stdout(
          action === 'add'
            ? `${chalk.dim('All bundled skills are already installed.')}\n`
            : `${chalk.dim('No bundled skills are installed.')}\n`,
        );
      }
      return 0;
    }
    const selectSkills = input.dependencies.selectSkills ?? promptForSkills;
    let selected: string[] | null;
    try {
      selected = await selectSkills({ action, candidates });
    } catch (error: unknown) {
      throw new Error(`Could not ${action} skill selection.`, { cause: error });
    }
    if (selected === null) {
      if (!input.parsed.quiet) input.stdout(`${chalk.dim('Cancelled.')}\n`);
      return 0;
    }
    skills = selected;
  }

  const result = applySkillSelectionChange({
    action,
    skills,
    home: input.parsed.home,
    visibleUserRoot:
      input.dependencies.visibleUserRoot ?? resolveVisibleUserRoot(),
  });
  if (input.parsed.json) {
    input.stdout(
      `${JSON.stringify({ ok: true, command: `${action} skill`, result })}\n`,
    );
  } else if (!input.parsed.quiet) {
    input.stdout(renderSkillSelectionResult(result));
  }
  return 0;
}

function parseTrustedReleaseKeyMap(
  parsed: unknown,
  source: string,
): Record<string, string> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON object`);
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(
          `release public key ${key} from ${source} must be a non-empty PEM string`,
        );
      }
      return [key, value];
    }),
  );
}

export function trustedReleaseKeysFromEnvironment(
  home?: string,
): Record<string, string> {
  const encoded = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
  if (encoded) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(encoded) as unknown;
    } catch (error: unknown) {
      throw new Error(
        'CONSUELO_RELEASE_PUBLIC_KEYS_JSON is not valid JSON',
        { cause: error },
      );
    }
    return parseTrustedReleaseKeyMap(
      parsed,
      'CONSUELO_RELEASE_PUBLIC_KEYS_JSON',
    );
  }
  const keyId = process.env.CONSUELO_RELEASE_KEY_ID;
  const publicKey = process.env.CONSUELO_RELEASE_PUBLIC_KEY;
  if (Boolean(keyId) !== Boolean(publicKey)) {
    throw new Error(
      'CONSUELO_RELEASE_KEY_ID and CONSUELO_RELEASE_PUBLIC_KEY must be configured together',
    );
  }
  if (keyId && publicKey) return { [keyId]: publicKey };
  const trustedKeysPath = resolve(
    resolveLifecyclePaths(home).home,
    'runtime',
    'trusted-release-keys.json',
  );
  try {
    const stats = lstatSync(trustedKeysPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(
        `trusted release key file must be a regular file: ${trustedKeysPath}`,
      );
    }
    if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) {
      throw new Error(
        `trusted release key file must be owned by the current user: ${trustedKeysPath}`,
      );
    }
    if ((stats.mode & 0o022) !== 0) {
      throw new Error(
        `trusted release key file must not be group- or world-writable: ${trustedKeysPath}`,
      );
    }
    const parsed = JSON.parse(readFileSync(trustedKeysPath, 'utf8')) as unknown;
    return parseTrustedReleaseKeyMap(
      parsed,
      'trusted release key file',
    );
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `no trusted release keys are installed at ${trustedKeysPath}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export function createDefaultLifecycleServiceController(input: {
  home?: string;
  osRoot: string;
  platform?: NodeJS.Platform;
  bunExecutable?: string;
}): LifecycleServiceController {
  const platform = input.platform ?? process.platform;
  const lifecycleHome = resolveLifecyclePaths(input.home).home;
  const bunExecutable =
    input.bunExecutable ?? process.env.BUN_BIN ?? process.execPath;
  if (platform === 'linux') {
    return createLinuxPlatformAdapter({
      home: lifecycleHome,
      bunExecutable,
    });
  }
  if (platform === 'win32') {
    return createWindowsServiceController({
      home: lifecycleHome,
      bunExecutable,
      serviceHostExecutable: resolve(
        lifecycleHome,
        'bin',
        'Consuelo.Windows.Service.exe',
      ),
      currentUserSid: process.env.CONSUELO_WINDOWS_USER_SID,
    });
  }
  return createReloadServiceController({ osRoot: input.osRoot, platform });
}

const DEFAULT_ADVISORY_PROCESS_TIMEOUT_MS = 30_000;

export async function waitForAdvisoryProcessExit(
  child: { exited: Promise<number>; kill(): void },
  timeoutMs: number,
): Promise<number | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      child.exited,
      new Promise<null>((resolveTimeout) => {
        timeout = setTimeout(() => {
          child.kill();
          resolveTimeout(null);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const createDefaultLifecycleEngine = (input: {
  home?: string;
  quiet: boolean;
  json: boolean;
  progress: (event: LifecycleProgressEvent) => void;
}): LifecycleEngine => {
  const osRoot = resolve(import.meta.dirname, '..');
  const port = process.env.CONSUELO_OS_PORT || process.env.PORT || '46321';
  const releaseBaseUrl =
    process.env.CONSUELO_RELEASE_BASE_URL?.trim() || DEFAULT_RELEASE_BASE_URL;
  return createLifecycleEngine({
    home: input.home,
    visibleUserRoot: resolveVisibleUserRoot(),
    releaseSource: createHttpReleaseSource({
      baseUrl: releaseBaseUrl,
      ...(process.env.CONSUELO_RELEASE_GCP_METADATA_AUTH === '1'
        ? {
            authorizationProvider:
              createGcpMetadataReleaseAuthorization(),
          }
        : {}),
    }),
    trustedReleaseKeys: () =>
      trustedReleaseKeysFromEnvironment(input.home),
    service: createDefaultLifecycleServiceController({
      home: input.home,
      osRoot,
    }),
    runtime: createBunRuntimeMaterializer(),
    health: createHttpHealthAcceptance({
      url: `http://127.0.0.1:${port}/health`,
      expectedName: 'consuelo-os',
    }),
    connectorReadiness: createConnectorReadinessAcceptance({
      home: resolveLifecyclePaths(input.home).home,
      osRoot,
    }),
    connectivity: {
      async accept() {
        const child = Bun.spawn([
          process.execPath,
          resolve(osRoot, 'scripts', 'verify-local-agents.ts'),
        ], {
          cwd: osRoot,
          env: {
            ...process.env,
            CONSUELO_HOME: resolveLifecyclePaths(input.home).home,
          },
          stdin: 'ignore',
          stdout: 'ignore',
          stderr: 'ignore',
        });
        return await waitForAdvisoryProcessExit(
          child,
          DEFAULT_ADVISORY_PROCESS_TIMEOUT_MS,
        ) === 0;
      },
    },
    progress: input.quiet || input.json ? undefined : input.progress,
    onboarding: async () => {
      try {
        const onboarding = createLifecycleOnboardingCommand({
          osRoot,
          home: input.home,
          onboardingFile:
            process.env.CONSUELO_MANAGED_CLOUD_NODE_ONBOARDING_FILE,
        });
        const args = onboarding.args;
        const child = Bun.spawn([process.execPath, ...args], {
          cwd: osRoot,
          env: process.env,
          stdin: 'inherit',
          stdout: 'inherit',
          stderr: 'inherit',
        });
        const exitCode = await child.exited;
        if (exitCode !== 0)
          throw new Error(`installer exited with code ${exitCode}`);
      } catch (error: unknown) {
        throw new Error(
          `lifecycle onboarding failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  });
};

function notificationPreference(
  parsed: ParsedLifecycleArgs,
): LifecycleNotificationPreference {
  const action = parsed.positional[1];
  if (action === 'on') return { mode: 'on' };
  if (action === 'off') return { mode: 'off' };
  if (action === 'snooze') {
    const snoozedUntil =
      parsed.snoozedUntil ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
): Promise<LifecycleOperationResult> {
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
    case 'rollback':
      return engine.rollback({ dryRun: parsed.dryRun });
    case 'uninstall':
      return engine.uninstall({
        dryRun: parsed.dryRun,
        removeNode: parsed.removeNode,
        removeUserContent: parsed.removeUserContent,
      });
    case 'dev':
      return engine.devReset({ yes: parsed.yes, dryRun: parsed.dryRun });
    case 'channel': {
      const action = parsed.positional[0] ?? 'show';
      if (action === 'show') return engine.status();
      if (action !== 'set') throw new Error('channel requires show or set');
      const channel = parsed.positional[1];
      if (
        !lifecycleReleaseChannels.includes(channel as LifecycleReleaseChannel)
      ) {
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
  const stdout =
    dependencies.stdout ?? ((value: string) => process.stdout.write(value));
  const stderr =
    dependencies.stderr ?? ((value: string) => process.stderr.write(value));
  let parsed: ParsedLifecycleArgs;
  try {
    parsed = parseArgs(argv);
    if (parsed.command !== 'help') validateCommandArgs(parsed);
  } catch (error: unknown) {
    stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  if (parsed.command === 'help') {
    stdout(HELP);
    return 0;
  }

  try {
    const environment = dependencies.environment ?? process.env;
    if (parsed.command === 'add' || parsed.command === 'remove') {
      return await runSkillSelectionCli({ parsed, dependencies, stdout });
    }
    const runsInsideActiveDaemon =
      environment.CONSUELO_OS_DAEMON_PROCESS === '1' ||
      environment.XPC_SERVICE_NAME === 'com.consuelo.system';
    if (runsInsideActiveDaemon && parsed.command === 'repair') {
      throw lifecycleError(
        'DAEMON_MUTATION_NOT_ALLOWED',
        'Consuelo OS cannot run a synchronous repair inside its active daemon process. Run the repair from Terminal or through the separate lifecycle process.',
      );
    }
    const engine =
      dependencies.engine ??
      createDefaultLifecycleEngine({
        home: parsed.home,
        quiet: parsed.quiet,
        json: parsed.json,
        progress: (event) => stderr(renderLifecycleProgress(event)),
      });
    const operationLauncher =
      dependencies.operationLauncher ??
      createDetachedNativeLifecycleOperationLauncher({
        home: resolveLifecyclePaths(parsed.home).home,
        platform: process.platform,
        env: environment,
      });
    let result: LifecycleOperationResult;
    if (runsInsideActiveDaemon && parsed.command === 'update' && !parsed.check) {
      const checked = await engine.update({
        channel: parsed.channel,
        check: true,
        yes: parsed.yes,
      });
      if (checked.updateAvailable !== true) {
        result = checked;
      } else {
        if (!checked.version) {
          throw lifecycleError(
            'MANIFEST_INVALID',
            'update check did not return a target release version',
          );
        }
        const accepted = await operationLauncher.launch({
          kind: 'update',
          targetVersion: checked.version,
          ...(parsed.channel ? { channel: parsed.channel } : {}),
        });
        result = {
          ...checked,
          detail: {
            ...checked.detail,
            detached: true,
            accepted: accepted.accepted,
            operationId: accepted.operationId,
          },
        };
      }
    } else {
      result = await executeCommand(parsed, engine);
    }
    if (parsed.command === 'status') {
      const lifecycleOperation = operationLauncher.read();
      if (lifecycleOperation) {
        result = {
          ...result,
          detail: {
            ...result.detail,
            lifecycleOperation: publicLifecycleOperationState(lifecycleOperation),
          },
        };
      }
    }
    if (parsed.json)
      stdout(
        `${JSON.stringify(lifecycleSuccessEnvelope(parsed.command, result))}\n`,
      );
    else if (!parsed.quiet) stdout(renderLifecycleResult(result));
    return 0;
  } catch (error: unknown) {
    if (parsed.json)
      stderr(
        `${JSON.stringify(lifecycleFailureEnvelope(parsed.command, error))}\n`,
      );
    else stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runLifecycleCli(process.argv.slice(2));
}
