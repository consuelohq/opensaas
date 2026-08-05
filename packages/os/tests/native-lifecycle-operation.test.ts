import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  LifecycleEngine,
  LifecycleOperationResult,
} from '../scripts/lib/lifecycle';
import {
  createDetachedNativeLifecycleOperationLauncher,
  createNativeLifecycleOperationStore,
  executeNativeLifecycleOperation,
  parseNativeLifecycleOperationArguments,
  type NativeLifecycleOperation,
} from '../scripts/lib/native-lifecycle-operation';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const lifecycleResult = (
  operation: LifecycleOperationResult['operation'],
): LifecycleOperationResult => ({ operation, changed: true });

const fakeEngine = () => {
  const calls: string[] = [];
  const engine: LifecycleEngine = {
    status: vi.fn(async () => ({
      operation: 'status',
      changed: false,
      installState: 'valid',
      version: '1.4.0',
      bundleId: 'bundle-1.4.0',
      preferences: { channel: 'dev', notifications: { mode: 'on' } },
    })),
    install: vi.fn(async () => lifecycleResult('install')),
    update: vi.fn(async (input) => {
      calls.push(
        input?.check
          ? 'update:check'
          : `update:apply:${input?.expectedVersion ?? 'unbounded'}`,
      );
      if (input?.expectedVersion && input.expectedVersion !== '1.5.0') {
        throw new Error(
          'requested update target does not match the available release',
        );
      }
      return input?.check
        ? {
            operation: 'update',
            changed: false,
            updateAvailable: true,
            version: '1.5.0',
          }
        : lifecycleResult('update');
    }),
    restart: vi.fn(async () => {
      calls.push('restart');
      return lifecycleResult('restart');
    }),
    repair: vi.fn(async () => {
      calls.push('repair');
      return lifecycleResult('repair');
    }),
    rollback: vi.fn(async () => {
      calls.push('rollback');
      return lifecycleResult('rollback');
    }),
    uninstall: vi.fn(async (input) => {
      calls.push(
        `uninstall:${Boolean(input?.removeNode)}:${Boolean(input?.removeUserContent)}`,
      );
      return lifecycleResult('uninstall');
    }),
    devReset: vi.fn(async () => lifecycleResult('reset')),
    setChannel: vi.fn(async () => lifecycleResult('channel')),
    setUpdateNotifications: vi.fn(async () => lifecycleResult('notifications')),
  };
  return { engine, calls };
};

describe('native lifecycle detached operations', () => {
  it('parses only the detached worker operation contract', () => {
    expect(
      parseNativeLifecycleOperationArguments([
        '--home',
        '/tmp/consuelo-home',
        '--operation-id',
        'op-1',
        '--kind',
        'uninstall',
        '--remove-node',
        'true',
        '--remove-user-content',
        'false',
      ]),
    ).toEqual({
      home: '/tmp/consuelo-home',
      operation: {
        operationId: 'op-1',
        kind: 'uninstall',
        removeNode: true,
        removeUserContent: false,
      },
    });
    expect(() =>
      parseNativeLifecycleOperationArguments([
        '--home',
        '/tmp/consuelo-home',
        '--operation-id',
        'op-1',
        '--kind',
        'destructive-repair',
      ]),
    ).toThrow('unsupported native lifecycle operation kind');
    expect(() =>
      parseNativeLifecycleOperationArguments([
        '--home',
        '/tmp/consuelo-home',
        '--operation-id',
        'op-1',
        '--kind',
        'uninstall',
        '--remove-node',
        'sometimes',
        '--remove-user-content',
        'false',
      ]),
    ).toThrow('must be true or false');
  });

  it('persists owner-only operation state atomically', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const store = createNativeLifecycleOperationStore(home);
    const state = {
      schemaVersion: 1 as const,
      operationId: 'op-1',
      kind: 'update' as const,
      phase: 'running' as const,
      updatedAt: '2026-07-27T03:00:00.000Z',
    };

    store.write(state);

    expect(store.read()).toEqual(state);
    expect(statSync(store.path).mode & 0o077).toBe(0);
    expect(statSync(join(home, 'run')).mode & 0o077).toBe(0);

    const invalid = {
      ...state,
      updatedAt: 'not-a-time',
    };
    writeFileSync(store.path, JSON.stringify(invalid), { mode: 0o600 });
    expect(() => store.read()).toThrow('invalid updatedAt');
  });

  it('launches the canonical worker detached and rejects concurrent active operations', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const invocations: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];
    let unrefCount = 0;
    const launcher = createDetachedNativeLifecycleOperationLauncher({
      home,
      executable: '/usr/local/bin/bun',
      scriptPath: '/runtime/scripts/native-lifecycle-operation.ts',
      operationId: () => 'native-op-1',
      now: () => new Date('2026-07-27T03:00:00.000Z'),
      spawnProcess: (command, args, options) => {
        invocations.push({ command, args, options });
        return {
          pid: 4321,
          unref: () => {
            unrefCount += 1;
          },
          once: (_event, _listener) => undefined,
        };
      },
    });

    await expect(
      launcher.launch({ kind: 'update', targetVersion: '1.5.0' }),
    ).resolves.toEqual({ accepted: true, operationId: 'native-op-1' });

    expect(invocations).toEqual([
      {
        command: '/usr/local/bin/bun',
        args: [
          '/runtime/scripts/native-lifecycle-operation.ts',
          '--home',
          home,
          '--operation-id',
          'native-op-1',
          '--kind',
          'update',
          '--target-version',
          '1.5.0',
        ],
        options: expect.objectContaining({
          detached: true,
          stdio: 'ignore',
          cwd: '/runtime',
        }),
      },
    ]);
    expect(unrefCount).toBe(1);
    expect(launcher.read()).toMatchObject({
      operationId: 'native-op-1',
      kind: 'update',
      phase: 'queued',
    });
    await expect(launcher.launch({ kind: 'restart' })).rejects.toThrow(
      'already active',
    );
  });

  it('bootstraps a one-shot macOS launchd worker when invoked from a LaunchAgent', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const invocations: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];
    const launcher = createDetachedNativeLifecycleOperationLauncher({
      home,
      executable: '/opt/homebrew/bin/bun',
      scriptPath: '/runtime/scripts/native-lifecycle-operation.ts',
      operationId: () => 'native-macos-update',
      now: () => new Date('2026-07-27T03:00:00.000Z'),
      platform: 'darwin',
      userId: 501,
      env: {
        HOME: '/Users/tester',
        USER: 'tester',
        BUN_BIN: '/opt/homebrew/bin/bun',
        XPC_SERVICE_NAME: 'com.consuelo.system',
      },
      spawnProcess: (command, args, options) => {
        invocations.push({ command, args, options });
        return {
          pid: 4321,
          unref: () => undefined,
          once: (_event, _listener) => undefined,
        };
      },
    });

    await launcher.launch({ kind: 'update', targetVersion: '1.5.0' });

    const plistPath = join(
      home,
      'run',
      'native-lifecycle-native-macos-update.plist',
    );

    expect(invocations).toEqual([
      {
        command: '/bin/launchctl',
        args: [
          'bootstrap',
          'gui/501',
          plistPath,
        ],
        options: expect.objectContaining({
          detached: false,
          stdio: 'ignore',
          cwd: '/runtime',
        }),
      },
    ]);
    const plist = readFileSync(plistPath, 'utf8');
    expect(plist).toContain('<string>com.consuelo.lifecycle.native-macos-update</string>');
    expect(plist).toContain('<key>RunAtLoad</key>\n  <true/>');
    expect(plist).toContain('<key>KeepAlive</key>\n  <false/>');
    expect(plist).toContain('<key>LaunchOnlyOnce</key>\n  <true/>');
    expect(plist).toContain('<string>CONSUELO_HOME=' + home + '</string>');
    expect(plist).toContain('<string>--target-version</string>');
    expect(plist).toContain('<string>1.5.0</string>');
  });

  it('prefers the persisted Bun executable and records early worker exit', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    let exitListener:
      | ((code: number | null, signal: NodeJS.Signals | null) => void)
      | undefined;
    const commands: string[] = [];
    const launcher = createDetachedNativeLifecycleOperationLauncher({
      home,
      env: { BUN_BIN: '/managed/bun' },
      operationId: () => 'early-exit',
      now: () => new Date('2026-07-27T03:00:00.000Z'),
      spawnProcess: (command) => {
        commands.push(command);
        return {
          pid: 123,
          unref: () => undefined,
          once: (event, listener) => {
            if (event === 'exit') {
              exitListener = listener as (
                code: number | null,
                signal: NodeJS.Signals | null,
              ) => void;
            }
          },
        };
      },
    });

    await launcher.launch({ kind: 'restart' });
    expect(commands).toEqual(['/managed/bun']);
    exitListener?.(1, null);
    expect(launcher.read()).toMatchObject({
      operationId: 'early-exit',
      phase: 'failed',
      message: expect.stringContaining('exited before terminal state'),
    });
  });

  it('recovers dead or abandoned operation state without overlapping a live worker', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const store = createNativeLifecycleOperationStore(home);
    store.write({
      schemaVersion: 1,
      operationId: 'dead-worker',
      kind: 'update',
      phase: 'running',
      updatedAt: '2026-07-27T02:59:00.000Z',
      workerPid: 12345,
    });
    const launches: string[] = [];
    const launcher = createDetachedNativeLifecycleOperationLauncher({
      home,
      operationId: () => 'replacement-worker',
      now: () => new Date('2026-07-27T03:00:00.000Z'),
      isProcessAlive: () => false,
      spawnProcess: (_command, args) => {
        launches.push(args.join(' '));
        return {
          pid: 54321,
          unref: () => undefined,
          once: (_event, _listener) => undefined,
        };
      },
    });

    expect(launcher.read()).toMatchObject({
      operationId: 'dead-worker',
      phase: 'failed',
      message: 'detached lifecycle worker is no longer active',
    });
    await expect(launcher.launch({ kind: 'restart' })).resolves.toEqual({
      accepted: true,
      operationId: 'replacement-worker',
    });
    expect(launches).toHaveLength(1);

    store.write({
      schemaVersion: 1,
      operationId: 'live-worker',
      kind: 'repair',
      phase: 'running',
      updatedAt: '2026-07-27T03:00:00.000Z',
      workerPid: 777,
    });
    const liveLauncher = createDetachedNativeLifecycleOperationLauncher({
      home,
      now: () => new Date('2026-07-27T03:00:10.000Z'),
      isProcessAlive: () => true,
      spawnProcess: () => {
        throw new Error('must not spawn over a live worker');
      },
    });
    await expect(liveLauncher.launch({ kind: 'restart' })).rejects.toThrow(
      'already active',
    );
  });

  it('expires an abandoned queued state after the bounded startup window', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const store = createNativeLifecycleOperationStore(home);
    store.write({
      schemaVersion: 1,
      operationId: 'abandoned-queue',
      kind: 'update',
      phase: 'queued',
      updatedAt: '2026-07-27T03:00:00.000Z',
    });
    const launcher = createDetachedNativeLifecycleOperationLauncher({
      home,
      operationId: () => 'after-queue-timeout',
      now: () => new Date('2026-07-27T03:00:31.000Z'),
      queuedStaleMs: 30_000,
      spawnProcess: () => ({
        pid: 999,
        unref: () => undefined,
        once: (_event, _listener) => undefined,
      }),
    });

    await expect(launcher.launch({ kind: 'restart' })).resolves.toEqual({
      accepted: true,
      operationId: 'after-queue-timeout',
    });
  });

  it('prevents a delayed superseded worker from executing lifecycle authority', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const store = createNativeLifecycleOperationStore(home);
    const oldOperation: NativeLifecycleOperation = {
      operationId: 'old-suspended-worker',
      kind: 'restart',
    };
    store.write({
      schemaVersion: 1,
      operationId: oldOperation.operationId,
      kind: oldOperation.kind,
      phase: 'queued',
      updatedAt: '2026-07-27T03:00:00.000Z',
    });
    const replacement = createDetachedNativeLifecycleOperationLauncher({
      home,
      operationId: () => 'replacement-worker',
      now: () => new Date('2026-07-27T03:00:31.000Z'),
      queuedStaleMs: 30_000,
      spawnProcess: () => ({
        pid: 999,
        unref: () => undefined,
        once: (_event, _listener) => undefined,
      }),
    });
    await replacement.launch({ kind: 'repair' });

    const { engine, calls } = fakeEngine();
    await executeNativeLifecycleOperation({
      home,
      operation: oldOperation,
      engine,
      store,
      now: () => new Date('2026-07-27T03:00:32.000Z'),
      processId: 1234,
    });

    expect(calls).toEqual([]);
    expect(store.read()).toMatchObject({
      operationId: 'replacement-worker',
      kind: 'repair',
      phase: 'queued',
    });
  });

  it.each<NativeLifecycleOperation>([
    {
      operationId: 'update-op',
      kind: 'update',
      targetVersion: '1.5.0',
    },
    {
      operationId: 'rollback-op',
      kind: 'rollback',
      targetVersion: '1.3.0',
    },
    { operationId: 'repair-op', kind: 'repair' },
    { operationId: 'restart-op', kind: 'restart' },
    {
      operationId: 'uninstall-op',
      kind: 'uninstall',
      removeNode: true,
      removeUserContent: false,
    },
  ])(
    'executes $kind through the canonical engine and persists terminal state',
    async (operation) => {
      const home = await mkdtemp('/tmp/consuelo-native-operation-');
      temporaryRoots.push(home);
      const { engine, calls } = fakeEngine();
      const store = createNativeLifecycleOperationStore(home);
      store.write({
        schemaVersion: 1,
        operationId: operation.operationId,
        kind: operation.kind,
        phase: 'queued',
        updatedAt: '2026-07-27T02:59:59.000Z',
      });

      await executeNativeLifecycleOperation({
        home,
        operation,
        engine,
        store,
        readRollbackVersion: () => '1.3.0',
        now: () => new Date('2026-07-27T03:00:00.000Z'),
      });

      expect(store.read()).toMatchObject({
        operationId: operation.operationId,
        kind: operation.kind,
        phase: 'succeeded',
      });
      const expected: Record<NativeLifecycleOperation['kind'], string[]> = {
        update: ['update:apply:1.5.0'],
        rollback: ['rollback'],
        repair: ['repair'],
        restart: ['restart'],
        uninstall: ['uninstall:true:false'],
      };
      expect(calls).toEqual(expected[operation.kind]);
    },
  );

  it('fails closed when the worker target changed and redacts terminal errors', async () => {
    const home = await mkdtemp('/tmp/consuelo-native-operation-');
    temporaryRoots.push(home);
    const { engine } = fakeEngine();
    const store = createNativeLifecycleOperationStore(home);
    store.write({
      schemaVersion: 1,
      operationId: 'stale-update',
      kind: 'update',
      phase: 'queued',
      updatedAt: '2026-07-27T02:59:59.000Z',
    });

    await expect(
      executeNativeLifecycleOperation({
        home,
        operation: {
          operationId: 'stale-update',
          kind: 'update',
          targetVersion: '9.9.9',
        },
        engine,
        store,
        now: () => new Date('2026-07-27T03:00:00.000Z'),
      }),
    ).rejects.toThrow('does not match the available release');
    expect(store.read()).toMatchObject({
      phase: 'failed',
      message: 'requested update target does not match the available release',
    });
  });
});
