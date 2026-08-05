import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawn, type SpawnOptions } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

import { createDefaultLifecycleEngine } from '../lifecycle';
import type { LifecycleEngine } from './lifecycle';
import { redactLifecycleDetail } from './lifecycle/diagnostics';
import { readLifecycleReleaseReference } from './lifecycle/retention';

export type NativeLifecycleOperationKind =
  | 'update'
  | 'rollback'
  | 'repair'
  | 'restart'
  | 'uninstall';

export type NativeLifecycleOperationInput =
  | { kind: 'update'; targetVersion: string }
  | { kind: 'rollback'; targetVersion: string }
  | { kind: 'repair' }
  | { kind: 'restart' }
  | {
      kind: 'uninstall';
      removeNode: boolean;
      removeUserContent: boolean;
    };

export type NativeLifecycleOperation = NativeLifecycleOperationInput & {
  operationId: string;
};

export type NativeLifecycleOperationState = {
  schemaVersion: 1;
  operationId: string;
  kind: NativeLifecycleOperationKind;
  phase: 'queued' | 'running' | 'succeeded' | 'failed';
  updatedAt: string;
  workerPid?: number;
  message?: string;
};

export type NativeLifecycleOperationStore = {
  path: string;
  read(): NativeLifecycleOperationState | undefined;
  write(state: NativeLifecycleOperationState): void;
  withLock<T>(action: () => T): T;
};

type SpawnedProcess = {
  pid?: number;
  unref(): void;
  once(event: 'error', listener: (error: Error) => void): unknown;
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): unknown;
};

type SpawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => SpawnedProcess;

export type NativeLifecycleOperationLauncher = {
  launch(
    operation: NativeLifecycleOperationInput,
  ): Promise<{ accepted: true; operationId: string }>;
  read(): NativeLifecycleOperationState | undefined;
};

const HOME_PATH = /\/Users\/[^/\s]+/g;
const ACTIVE_PHASES = new Set<NativeLifecycleOperationState['phase']>([
  'queued',
  'running',
]);

const safeMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return String(redactLifecycleDetail(message))
    .replace(HOME_PATH, '/Users/[REDACTED]')
    .replace(/(token|secret|password|passphrase)=([^&\s]+)/gi, '$1=[REDACTED]');
};

const escapeLaunchdXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const launchdWorkerPlist = (input: {
  label: string;
  arguments: string[];
}): string => {
  const argumentsXml = input.arguments
    .map((argument) => `    <string>${escapeLaunchdXml(argument)}</string>`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${escapeLaunchdXml(input.label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    argumentsXml,
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <false/>',
    '  <key>LaunchOnlyOnce</key>',
    '  <true/>',
    '  <key>ProcessType</key>',
    '  <string>Background</string>',
    '  <key>StandardOutPath</key>',
    '  <string>/dev/null</string>',
    '  <key>StandardErrorPath</key>',
    '  <string>/dev/null</string>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
};

const cleanupLaunchdWorkerPlist = (
  home: string,
  environment: NodeJS.ProcessEnv,
): void => {
  const plistPath = environment.CONSUELO_LIFECYCLE_LAUNCHD_PLIST?.trim();
  if (!plistPath) return;
  const runDirectory = resolve(home, 'run');
  const resolvedPath = resolve(plistPath);
  const relativePath = relative(runDirectory, resolvedPath);
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    resolve(runDirectory, relativePath) !== resolvedPath
  ) {
    return;
  }
  try {
    unlinkSync(resolvedPath);
  } catch {
    // Lifecycle completion must not be downgraded by best-effort plist cleanup.
  }
};

const isOperationKind = (
  value: unknown,
): value is NativeLifecycleOperationKind =>
  value === 'update' ||
  value === 'rollback' ||
  value === 'repair' ||
  value === 'restart' ||
  value === 'uninstall';

const parseState = (value: unknown): NativeLifecycleOperationState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('native lifecycle operation state must be an object');
  }
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== 1) {
    throw new Error('unsupported native lifecycle operation state schema');
  }
  if (typeof state.operationId !== 'string' || !state.operationId.trim()) {
    throw new Error('native lifecycle operation state is missing operationId');
  }
  if (!isOperationKind(state.kind)) {
    throw new Error('native lifecycle operation state has invalid kind');
  }
  if (
    state.phase !== 'queued' &&
    state.phase !== 'running' &&
    state.phase !== 'succeeded' &&
    state.phase !== 'failed'
  ) {
    throw new Error('native lifecycle operation state has invalid phase');
  }
  if (
    typeof state.updatedAt !== 'string' ||
    !state.updatedAt.trim() ||
    !Number.isFinite(Date.parse(state.updatedAt))
  ) {
    throw new Error('native lifecycle operation state has invalid updatedAt');
  }
  if (
    state.workerPid !== undefined &&
    (!Number.isSafeInteger(state.workerPid) || state.workerPid <= 0)
  ) {
    throw new Error('native lifecycle operation state has invalid workerPid');
  }
  if (state.message !== undefined && typeof state.message !== 'string') {
    throw new Error('native lifecycle operation state has invalid message');
  }
  return {
    schemaVersion: 1,
    operationId: state.operationId,
    kind: state.kind,
    phase: state.phase,
    updatedAt: state.updatedAt,
    ...(typeof state.workerPid === 'number'
      ? { workerPid: state.workerPid }
      : {}),
    ...(state.message ? { message: state.message } : {}),
  };
};

export const createNativeLifecycleOperationStore = (
  home: string,
): NativeLifecycleOperationStore => {
  const runDirectory = join(home, 'run');
  const statePath = join(runDirectory, 'native-lifecycle-operation.json');
  const lockPath = join(runDirectory, 'native-lifecycle-operation.lock');

  const ensureRunDirectory = (): void => {
    mkdirSync(runDirectory, { recursive: true, mode: 0o700 });
    chmodSync(runDirectory, 0o700);
  };

  const releaseLock = (): void => {
    try {
      unlinkSync(lockPath);
    } catch (error: unknown) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      ) {
        throw error;
      }
    }
  };

  const acquireLock = (): (() => void) => {
    ensureRunDirectory();
    const deadline = Date.now() + 5_000;
    while (Date.now() <= deadline) {
      try {
        const descriptor = openSync(lockPath, 'wx', 0o600);
        try {
          writeFileSync(
            descriptor,
            `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`,
          );
        } finally {
          closeSync(descriptor);
        }
        chmodSync(lockPath, 0o600);
        return releaseLock;
      } catch (error: unknown) {
        if (
          !error ||
          typeof error !== 'object' ||
          !('code' in error) ||
          error.code !== 'EEXIST'
        ) {
          throw error;
        }
        let stale = false;
        try {
          const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
            pid?: unknown;
          };
          if (
            typeof lock.pid === 'number' &&
            Number.isSafeInteger(lock.pid) &&
            lock.pid > 0
          ) {
            stale = !defaultProcessAlive(lock.pid);
          } else {
            stale = Date.now() - statSync(lockPath).mtimeMs > 30_000;
          }
        } catch (lockError: unknown) {
          void lockError;
          try {
            stale = Date.now() - statSync(lockPath).mtimeMs > 30_000;
          } catch (statError: unknown) {
            void statError;
            stale = true;
          }
        }
        if (stale) {
          releaseLock();
          continue;
        }
        const signal = new Int32Array(new SharedArrayBuffer(4));
        Atomics.wait(signal, 0, 0, 10);
      }
    }
    throw new Error('native lifecycle operation state lock is busy');
  };

  return {
    path: statePath,
    read: () => {
      if (!existsSync(statePath)) return undefined;
      return parseState(JSON.parse(readFileSync(statePath, 'utf8')));
    },
    write: (state) => {
      ensureRunDirectory();
      const temporaryPath = `${statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
      writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      chmodSync(temporaryPath, 0o600);
      renameSync(temporaryPath, statePath);
      chmodSync(statePath, 0o600);
    },
    withLock: (action) => {
      const release = acquireLock();
      try {
        return action();
      } finally {
        release();
      }
    },
  };
};

const operationArguments = (operation: NativeLifecycleOperation): string[] => {
  const args = [
    '--operation-id',
    operation.operationId,
    '--kind',
    operation.kind,
  ];
  if (operation.kind === 'update' || operation.kind === 'rollback') {
    args.push('--target-version', operation.targetVersion);
  }
  if (operation.kind === 'uninstall') {
    args.push('--remove-node', String(operation.removeNode));
    args.push('--remove-user-content', String(operation.removeUserContent));
  }
  return args;
};

const defaultSpawnProcess: SpawnProcess = (command, args, options) =>
  spawn(command, args, options);

const defaultProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EPERM',
    );
  }
};

export const createDetachedNativeLifecycleOperationLauncher = (input: {
  home: string;
  platform?: NodeJS.Platform;
  userId?: number;
  executable?: string;
  scriptPath?: string;
  spawnProcess?: SpawnProcess;
  operationId?: () => string;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  isProcessAlive?: (pid: number) => boolean;
  queuedStaleMs?: number;
  pidlessRunningStaleMs?: number;
}): NativeLifecycleOperationLauncher => {
  const store = createNativeLifecycleOperationStore(input.home);
  const executable =
    input.executable ??
    input.env?.BUN_BIN ??
    process.env.BUN_BIN ??
    process.execPath;
  const scriptPath =
    input.scriptPath ??
    resolve(import.meta.dirname, '..', 'native-lifecycle-operation.ts');
  const spawnProcess = input.spawnProcess ?? defaultSpawnProcess;
  const nextOperationId =
    input.operationId ?? (() => `native-${Date.now()}-${crypto.randomUUID()}`);
  const now = input.now ?? (() => new Date());
  const isProcessAlive = input.isProcessAlive ?? defaultProcessAlive;
  const queuedStaleMs = Math.max(1, input.queuedStaleMs ?? 30_000);
  const pidlessRunningStaleMs = Math.max(
    queuedStaleMs,
    input.pidlessRunningStaleMs ?? 2 * 60 * 60 * 1_000,
  );
  const useLaunchdIsolation =
    input.platform === 'darwin' &&
    Boolean(input.env?.XPC_SERVICE_NAME?.trim());

  const readCurrentOperation = ():
    | NativeLifecycleOperationState
    | undefined => {
    const existing = store.read();
    if (!existing || !ACTIVE_PHASES.has(existing.phase)) return existing;
    const ageMs = Math.max(0, now().getTime() - Date.parse(existing.updatedAt));
    const active =
      existing.phase === 'running' && typeof existing.workerPid === 'number'
        ? isProcessAlive(existing.workerPid)
        : existing.phase === 'queued'
          ? ageMs < queuedStaleMs
          : ageMs < pidlessRunningStaleMs;
    if (active) return existing;
    const failed: NativeLifecycleOperationState = {
      ...existing,
      phase: 'failed',
      updatedAt: now().toISOString(),
      message: 'detached lifecycle worker is no longer active',
    };
    store.write(failed);
    return failed;
  };

  return {
    read: () => store.withLock(readCurrentOperation),
    launch: async (operationInput) => {
      const operation: NativeLifecycleOperation = {
        ...operationInput,
        operationId: nextOperationId(),
      };
      store.withLock(() => {
        const existing = readCurrentOperation();
        if (existing && ACTIVE_PHASES.has(existing.phase)) {
          throw new Error(
            `native lifecycle operation ${existing.operationId} is already active`,
          );
        }
        store.write({
          schemaVersion: 1,
          operationId: operation.operationId,
          kind: operation.kind,
          phase: 'queued',
          updatedAt: now().toISOString(),
        });
      });
      try {
        const workerArguments = [
          scriptPath,
          '--home',
          input.home,
          ...operationArguments(operation),
        ];
        const effectiveEnvironment = {
          ...process.env,
          ...input.env,
          CONSUELO_HOME: input.home,
        };
        let launchdPlistPath: string | undefined;
        let launchdLabel: string | undefined;
        let launchdDomain: string | undefined;
        if (useLaunchdIsolation) {
          const userId = input.userId ?? process.getuid?.();
          if (!Number.isSafeInteger(userId) || Number(userId) < 0) {
            throw new Error('macOS lifecycle isolation requires a valid user id');
          }
          launchdLabel = `com.consuelo.lifecycle.${operation.operationId}`;
          launchdDomain = `gui/${String(userId)}`;
          launchdPlistPath = join(
            input.home,
            'run',
            `native-lifecycle-${operation.operationId}.plist`,
          );
          const launchdArguments = [
            '/usr/bin/env',
            `HOME=${effectiveEnvironment.HOME ?? ''}`,
            `USER=${effectiveEnvironment.USER ?? ''}`,
            `CONSUELO_HOME=${input.home}`,
            `BUN_BIN=${executable}`,
            `CONSUELO_LIFECYCLE_LAUNCHD_LABEL=${launchdLabel}`,
            `CONSUELO_LIFECYCLE_LAUNCHD_DOMAIN=${launchdDomain}`,
            `CONSUELO_LIFECYCLE_LAUNCHD_PLIST=${launchdPlistPath}`,
            ...[
              'CONSUELO_OS_PORT',
              'PORT',
              'CONSUELO_RELEASE_BASE_URL',
              'CONSUELO_RELEASE_GCP_METADATA_AUTH',
              'CONSUELO_MANAGED_CLOUD_NODE_ONBOARDING_FILE',
            ].flatMap((name) => {
              const value = effectiveEnvironment[name]?.trim();
              return value ? [`${name}=${value}`] : [];
            }),
            executable,
            ...workerArguments,
          ];
          writeFileSync(
            launchdPlistPath,
            launchdWorkerPlist({
              label: launchdLabel,
              arguments: launchdArguments,
            }),
            { mode: 0o600, flag: 'wx' },
          );
          chmodSync(launchdPlistPath, 0o600);
        }
        const child = useLaunchdIsolation
          ? spawnProcess(
              '/bin/launchctl',
              ['bootstrap', launchdDomain!, launchdPlistPath!],
              {
                cwd: resolve(dirname(scriptPath), '..'),
                detached: false,
                stdio: 'ignore',
                env: effectiveEnvironment,
              },
            )
          : spawnProcess(executable, workerArguments, {
              cwd: resolve(dirname(scriptPath), '..'),
              detached: true,
              stdio: 'ignore',
              env: effectiveEnvironment,
            });
        const recordLaunchFailure = (error: unknown): void => {
          if (launchdPlistPath) {
            try {
              unlinkSync(launchdPlistPath);
            } catch {
              // Operation state carries the launch failure; cleanup is best effort.
            }
          }
          store.withLock(() => {
            const current = store.read();
            if (
              current?.operationId !== operation.operationId ||
              !ACTIVE_PHASES.has(current.phase)
            ) {
              return;
            }
            store.write({
              schemaVersion: 1,
              operationId: operation.operationId,
              kind: operation.kind,
              phase: 'failed',
              updatedAt: now().toISOString(),
              message: safeMessage(error),
            });
          });
        };
        child.once('error', recordLaunchFailure);
        child.once('exit', (code, signal) => {
          if (code === 0) return;
          recordLaunchFailure(
            new Error(
              `detached lifecycle worker exited before terminal state (code=${String(code)}, signal=${String(signal)})`,
            ),
          );
        });
        child.unref();
        return { accepted: true, operationId: operation.operationId };
      } catch (error: unknown) {
        store.withLock(() => {
          const current = store.read();
          if (current?.operationId === operation.operationId) {
            store.write({
              schemaVersion: 1,
              operationId: operation.operationId,
              kind: operation.kind,
              phase: 'failed',
              updatedAt: now().toISOString(),
              message: safeMessage(error),
            });
          }
        });
        throw new Error(safeMessage(error));
      }
    },
  };
};

const defaultRollbackVersion = (home: string): string | undefined =>
  readLifecycleReleaseReference(home, 'previous')?.manifest.version;

export const executeNativeLifecycleOperation = async (input: {
  home: string;
  operation: NativeLifecycleOperation;
  engine?: LifecycleEngine;
  store?: NativeLifecycleOperationStore;
  readRollbackVersion?: (home: string) => string | undefined;
  now?: () => Date;
  processId?: number;
}): Promise<void> => {
  const now = input.now ?? (() => new Date());
  const processId = input.processId ?? process.pid;
  const store = input.store ?? createNativeLifecycleOperationStore(input.home);
  const claimed = store.withLock(() => {
    const current = store.read();
    if (
      current?.operationId !== input.operation.operationId ||
      current.phase !== 'queued'
    ) {
      return false;
    }
    store.write({
      schemaVersion: 1,
      operationId: input.operation.operationId,
      kind: input.operation.kind,
      phase: 'running',
      updatedAt: now().toISOString(),
      workerPid: processId,
    });
    return true;
  });
  if (!claimed) return;

  const engine =
    input.engine ??
    createDefaultLifecycleEngine({
      home: input.home,
      quiet: true,
      json: true,
      progress: () => undefined,
    });
  const write = (
    phase: NativeLifecycleOperationState['phase'],
    message?: string,
  ): void => {
    if (input.operation.kind === 'uninstall' && !existsSync(input.home)) {
      return;
    }
    store.withLock(() => {
      const current = store.read();
      if (current?.operationId !== input.operation.operationId) return;
      store.write({
        schemaVersion: 1,
        operationId: input.operation.operationId,
        kind: input.operation.kind,
        phase,
        updatedAt: now().toISOString(),
        ...(message ? { message } : {}),
      });
    });
  };
  try {
    switch (input.operation.kind) {
      case 'update':
        await engine.update({
          yes: true,
          expectedVersion: input.operation.targetVersion,
        });
        break;
      case 'rollback': {
        const rollbackVersion = (
          input.readRollbackVersion ?? defaultRollbackVersion
        )(input.home);
        if (rollbackVersion !== input.operation.targetVersion) {
          throw new Error(
            'requested rollback target does not match the retained rollback release',
          );
        }
        await engine.rollback();
        break;
      }
      case 'repair':
        await engine.repair();
        break;
      case 'restart':
        await engine.restart();
        break;
      case 'uninstall':
        await engine.uninstall({
          removeNode: input.operation.removeNode,
          removeUserContent: input.operation.removeUserContent,
        });
        break;
    }
    write('succeeded');
  } catch (error: unknown) {
    const message = safeMessage(error);
    write('failed', message);
    throw new Error(message);
  } finally {
    cleanupLaunchdWorkerPlist(input.home, process.env);
  }
};

const requiredArgument = (
  values: Map<string, string>,
  name: string,
): string => {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`missing required argument --${name}`);
  return value;
};

const booleanArgument = (
  values: Map<string, string>,
  name: string,
): boolean => {
  const value = requiredArgument(values, name);
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`argument --${name} must be true or false`);
};

export const parseNativeLifecycleOperationArguments = (
  argv: string[],
): { home: string; operation: NativeLifecycleOperation } => {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(
        'native lifecycle operation arguments must be flag/value pairs',
      );
    }
    values.set(flag.slice(2), value);
  }
  const home = requiredArgument(values, 'home');
  const operationId = requiredArgument(values, 'operation-id');
  const kind = requiredArgument(values, 'kind');
  switch (kind) {
    case 'update':
    case 'rollback':
      return {
        home,
        operation: {
          operationId,
          kind,
          targetVersion: requiredArgument(values, 'target-version'),
        },
      };
    case 'repair':
    case 'restart':
      return { home, operation: { operationId, kind } };
    case 'uninstall':
      return {
        home,
        operation: {
          operationId,
          kind,
          removeNode: booleanArgument(values, 'remove-node'),
          removeUserContent: booleanArgument(values, 'remove-user-content'),
        },
      };
    default:
      throw new Error(`unsupported native lifecycle operation kind: ${kind}`);
  }
};
