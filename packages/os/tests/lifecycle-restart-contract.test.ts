import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createReloadServiceController } from '../scripts/lib/lifecycle';

const osRoot = resolve(import.meta.dirname, '..');
const source = (path: string): string => readFileSync(resolve(osRoot, path), 'utf8');

describe('lifecycle restart parity', () => {
  it('preserves reply-safe detached reload and canonical launchd/direct execution', () => {
    const reload = source('scripts/consuelo-reload.js');

    expect(reload).toContain("spawn(process.execPath, [__filename, command]");
    expect(reload).toContain("scheduleReload({ useLaunchd: hasLaunchdPlist, command: 'reload-now' });");
    expect(reload).toContain("scheduleReload({ useLaunchd: hasLaunchdPlist, command: 'restart-now' });");
    expect(reload).toContain('detached: true');
    expect(reload).toContain("CONSUELO_OS_RELOAD_CHILD: '1'");
    expect(reload).toContain('if (useLaunchd && existsSync(PLIST))');
    expect(reload).toContain('bootstrapLaunchAgent();');
    expect(reload).toContain('startDirect();');
  });

  it('preserves conflicting-label cleanup, TERM-to-KILL escalation, and bounded named health acceptance', () => {
    const reload = source('scripts/consuelo-reload.js');

    expect(reload).toContain("const CONFLICTING_LABELS = ['com.consuelo.workspace']");
    expect(reload).toContain('stopConflictingLaunchAgents();');
    expect(reload).toContain("runBestEffort('kill', [pid])");
    expect(reload).toContain("runBestEffort('kill', ['-9', pid])");
    expect(reload).toContain("const EXPECTED_SERVER_NAME = 'consuelo-os'");
    expect(reload).toContain('RELOAD_WAIT_ATTEMPTS');
    expect(reload).toContain('wrong server');
  });

  it('retries a transient primary macOS LaunchAgent bootstrap before failing the lifecycle restart', () => {
    const reload = source('scripts/consuelo-reload.js');

    expect(reload).toContain('PRIMARY_LAUNCH_AGENT_BOOTSTRAP_ATTEMPTS = 4');
    expect(reload).toContain('PRIMARY_LAUNCH_AGENT_BOOTSTRAP_RETRY_SECONDS = 0.2');
    expect(reload).toContain('for (let attempt = 1; attempt <= PRIMARY_LAUNCH_AGENT_BOOTSTRAP_ATTEMPTS; attempt += 1)');
    expect(reload).toContain('/Bootstrap failed:\\s*5|Input\\/output error/i');
    expect(reload).toContain('if (isLaunchdLoaded())');
    expect(reload).toContain('if (attempt < PRIMARY_LAUNCH_AGENT_BOOTSTRAP_ATTEMPTS)');
    expect(reload).toContain('sleep(PRIMARY_LAUNCH_AGENT_BOOTSTRAP_RETRY_SECONDS);');
    expect(reload).toContain('primary launch agent bootstrap failed for ${LABEL}');
  });

  it('preserves watchdog thresholding and restart-gap limiting', () => {
    const watchdog = source('scripts/workspace-watchdog.sh');

    expect(watchdog).toContain('WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD');
    expect(watchdog).toContain('WORKSPACE_WATCHDOG_LOCAL_HTTP_FAILURE_THRESHOLD');
    expect(watchdog).toContain('WORKSPACE_WATCHDOG_EXTERNAL_FAILURE_THRESHOLD');
    expect(watchdog).toContain('WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS');
    expect(watchdog).toContain('still inside restart gap');
    expect(watchdog).toContain('consuelo_cli=');
    expect(watchdog).toContain('"$consuelo_cli" restart --quiet');
    expect(watchdog).toContain('restart_launchd_label');
  });

  it('routes the legacy server command through the lifecycle adapter instead of duplicating process control', () => {
    const server = source('scripts/server.js');

    expect(server).toContain("'lifecycle.ts'");
    expect(server).toContain("'consuelo-reload.js'");
    expect(server).not.toContain('function killServer');
    expect(server).not.toContain('function startDirect');
    expect(server).not.toContain('function waitForHealth');
  });

  it('maps restart to the canonical reload script through one injected service controller', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const controller = createReloadServiceController({
      osRoot,
      run: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: 'Consuelo OS reload scheduled\n', stderr: '' };
      },
    });

    await controller.preflight();
    await controller.restart({ waitForCompletion: true });

    expect(calls).toEqual([
      ...(process.platform === 'darwin'
        ? [{ command: 'bash', args: [resolve(osRoot, 'scripts', 'retire-legacy-system-daemons.sh'), '--check'] }]
        : []),
      ...(process.platform === 'darwin'
        ? [{ command: 'bash', args: [resolve(osRoot, 'scripts', 'install-system-daemons.sh'), '--definitions-only', '--quiet'] }]
        : []),
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      },
    ]);

    calls.length = 0;
    await controller.restart();
    expect(calls).toEqual([
      ...(process.platform === 'darwin'
        ? [{ command: 'bash', args: [resolve(osRoot, 'scripts', 'install-system-daemons.sh'), '--definitions-only', '--quiet'] }]
        : []),
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload'],
      },
    ]);
  });

  it('uses destructive reload only after the rolling recovery path fails', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const controller = createReloadServiceController({
      osRoot,
      platform: 'linux',
      run: async (command, args) => {
        calls.push({ command, args });
        if (args.at(-1) === 'rolling-reload-now') {
          return { exitCode: 1, stdout: '', stderr: 'rolling pool unavailable' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(controller.restart({
      waitForCompletion: true,
      allowDestructiveFallback: true,
    })).resolves.toBeUndefined();

    expect(calls).toEqual([
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      },
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'reload-now'],
      },
    ]);
  });

  it('preserves transport-critical macOS ingress while restarting non-ingress sidecars', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-gateways-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    for (const label of [
      'com.consuelo.caddy',
      'com.consuelo.availability',
      'com.consuelo.portless.system',
      'com.consuelo.watchdog',
      'com.consuelo.os.cloudflared.connector-test',
      'com.consuelo.os.node-heartbeat.node-test',
    ]) {
      writeFileSync(join(launchAgents, label + '.plist'), '<plist/>\n');
    }
    const calls: Array<{ command: string; args: string[] }> = [];
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        run: async (command, args) => {
          calls.push({ command, args });
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await controller.restart({ waitForCompletion: true });

      expect(calls[0]).toEqual({
        command: 'bash',
        args: [
          resolve(osRoot, 'scripts', 'install-system-daemons.sh'),
          '--definitions-only',
          '--quiet',
        ],
      });
      expect(calls[1]).toEqual({
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      });
      const launchctl = calls.filter((call) => call.command === 'launchctl');
      expect(JSON.stringify(launchctl)).not.toContain('com.consuelo.caddy');
      expect(JSON.stringify(launchctl)).not.toContain('com.consuelo.os.cloudflared.connector-test');
      for (const label of [
        'com.consuelo.availability',
        'com.consuelo.os.node-heartbeat.node-test',
        'com.consuelo.portless.system',
        'com.consuelo.watchdog',
      ]) {
        expect(launchctl).toContainEqual({
          command: 'launchctl',
          args: ['bootout', 'gui/501/' + label],
        });
        expect(launchctl).toContainEqual({
          command: 'launchctl',
          args: ['bootstrap', 'gui/501', join(launchAgents, label + '.plist')],
        });
        expect(launchctl).toContainEqual({
          command: 'launchctl',
          args: ['kickstart', '-k', 'gui/501/' + label],
        });
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('retries a transient macOS gateway bootstrap after bootout settles', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-gateway-retry-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    const label = 'com.consuelo.os.node-heartbeat.node-test';
    const plistPath = join(launchAgents, label + '.plist');
    writeFileSync(plistPath, '<plist/>\n');
    const calls: Array<{ command: string; args: string[] }> = [];
    let bootstrapAttempts = 0;
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        sleep: async () => {},
        run: async (command, args) => {
          calls.push({ command, args });
          if (command === 'launchctl' && args[0] === 'bootstrap') {
            bootstrapAttempts += 1;
            if (bootstrapAttempts === 1) {
              return {
                exitCode: 5,
                stdout: '',
                stderr: 'Bootstrap failed: 5: Input/output error',
              };
            }
          }
          if (command === 'launchctl' && args[0] === 'print') {
            return { exitCode: 113, stdout: '', stderr: 'Could not find service' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await expect(controller.restart({ waitForCompletion: true })).resolves.toBeUndefined();
      expect(bootstrapAttempts).toBe(2);
      expect(calls).toContainEqual({
        command: 'launchctl',
        args: ['print', 'gui/501/' + label],
      });
      expect(calls.at(-1)).toEqual({
        command: 'launchctl',
        args: ['kickstart', '-k', 'gui/501/' + label],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('retries a transient macOS sidecar kickstart after bootstrap succeeds', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-gateway-kickstart-retry-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    const label = 'com.consuelo.os.node-heartbeat.node-test';
    writeFileSync(join(launchAgents, label + '.plist'), '<plist/>\n');
    let kickstartAttempts = 0;
    const sleepCalls: number[] = [];
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        sleep: async (milliseconds) => {
          sleepCalls.push(milliseconds);
        },
        run: async (command, args) => {
          if (command === 'launchctl' && args[0] === 'kickstart') {
            kickstartAttempts += 1;
            if (kickstartAttempts === 1) {
              return {
                exitCode: 5,
                stdout: '',
                stderr: 'Bootstrap failed: 5: Input/output error',
              };
            }
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await expect(controller.restart({ waitForCompletion: true })).resolves.toBeUndefined();
      expect(kickstartAttempts).toBe(2);
      expect(sleepCalls).toEqual([200]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('includes the sidecar label when transient kickstart retries are exhausted', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-gateway-kickstart-failure-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    const label = 'com.consuelo.os.node-heartbeat.node-test';
    writeFileSync(join(launchAgents, label + '.plist'), '<plist/>\n');
    let kickstartAttempts = 0;
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        sleep: async () => {},
        run: async (command, args) => {
          if (command === 'launchctl' && args[0] === 'kickstart') {
            kickstartAttempts += 1;
            return {
              exitCode: 5,
              stdout: '',
              stderr: 'Bootstrap failed: 5: Input/output error',
            };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await expect(controller.restart({ waitForCompletion: true })).rejects.toThrow(label);
      expect(kickstartAttempts).toBe(4);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('includes the gateway label when bootstrap retries are exhausted', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-gateway-failure-'));
    const launchAgents = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgents, { recursive: true });
    const label = 'com.consuelo.watchdog';
    writeFileSync(join(launchAgents, label + '.plist'), '<plist/>\n');
    try {
      const controller = createReloadServiceController({
        osRoot,
        platform: 'darwin',
        environment: { HOME: home },
        userId: 501,
        sleep: async () => {},
        run: async (command, args) => {
          if (command === 'launchctl' && args[0] === 'bootstrap') {
            return {
              exitCode: 5,
              stdout: '',
              stderr: 'Bootstrap failed: 5: Input/output error',
            };
          }
          if (command === 'launchctl' && args[0] === 'print') {
            return { exitCode: 113, stdout: '', stderr: 'Could not find service' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await expect(controller.restart({ waitForCompletion: true })).rejects.toThrow(label);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('reconciles preserved Caddy topology from the activated runtime before lifecycle restart', async () => {
    const lifecycle = source('scripts/lifecycle.ts');
    const service = source('scripts/lib/lifecycle/service.ts');
    const activeRuntimeRoot = resolve(osRoot, 'runtime-current');
    const home = resolve(osRoot, '.tmp-lifecycle-home');
    const calls: Array<{ command: string; args: string[] }> = [];
    const controllerInput = {
      osRoot,
      activeRuntimeRoot,
      home,
      platform: 'darwin' as const,
      run: async (command: string, args: string[]) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '{"ok":true,"changed":false}\n', stderr: '' };
      },
    };
    const controller = createReloadServiceController(controllerInput);

    await controller.restart({ waitForCompletion: true });

    expect(calls).toEqual([
      {
        command: 'bash',
        args: [
          resolve(activeRuntimeRoot, 'scripts', 'install-system-daemons.sh'),
          '--definitions-only',
          '--quiet',
        ],
      },
      {
        command: process.execPath,
        args: [
          resolve(activeRuntimeRoot, 'scripts', 'migrations', 'reconcile-caddy-worker-pool.ts'),
          home,
        ],
      },
      {
        command: process.execPath,
        args: [resolve(activeRuntimeRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      },
    ]);
    expect(lifecycle).toContain('activeRuntimeRoot: lifecyclePaths.currentLink');
    expect(service).not.toContain("import { reconcileCaddyWorkerPoolConfig } from '../caddy-worker-pool-reconciliation'");
    expect(service).toContain("'migrations',");
    expect(service).toContain("'reconcile-caddy-worker-pool.ts',");
    const workflow = source('../../.github/workflows/consuelo-os-runtime-publish.yaml');
    expect(workflow).toContain(
      '--migration "2026-08-13-reconcile-caddy-worker-pool:scripts/migrations/reconcile-caddy-worker-pool.ts"',
    );
    expect(workflow).toContain(
      '--migration "2026-08-13-reconcile-caddy-ha-watchdog:scripts/migrations/reconcile-caddy-ha-watchdog.ts"',
    );
  });

  it('reapplies reconciled Caddy config with a zero-downtime config-file signal', () => {
    const migration = source('scripts/migrations/reconcile-caddy-worker-pool.ts');

    expect(migration).toContain("['launchctl', 'kill', 'SIGUSR1', service]");
    expect(migration).toContain("result.reason !== 'gateway-not-configured'");
    expect(migration).not.toContain("if (result.changed && process.platform === 'darwin')");
    expect(migration).not.toContain("['launchctl', 'kickstart', '-k', service]");
    expect(migration).not.toContain("'--force',");
  });

  it('keeps rollback compatible with an older runtime installer that predates definitions-only refresh', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-legacy-runtime-'));
    const legacyRuntimeRoot = resolve(osRoot, 'runtime-legacy');
    const calls: Array<{ command: string; args: string[] }> = [];
    try {
      const controller = createReloadServiceController({
        osRoot,
        activeRuntimeRoot: osRoot,
        home,
        platform: 'darwin',
        environment: { HOME: home },
        run: async (command, args) => {
          calls.push({ command, args });
          if (command === 'bash' && args.includes('--definitions-only')) {
            return { exitCode: 1, stdout: '', stderr: 'unknown option: --definitions-only' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await expect(controller.restart({
        waitForCompletion: true,
        allowDestructiveFallback: true,
        runtimeRoot: legacyRuntimeRoot,
      })).resolves.toBeUndefined();

      expect(calls[0]).toEqual({
        command: 'bash',
        args: [
          resolve(legacyRuntimeRoot, 'scripts', 'install-system-daemons.sh'),
          '--definitions-only',
          '--quiet',
        ],
      });
      expect(calls).toContainEqual({
        command: process.execPath,
        args: [
          resolve(legacyRuntimeRoot, 'scripts', 'migrations', 'reconcile-caddy-worker-pool.ts'),
          home,
        ],
      });
      expect(calls).toContainEqual({
        command: process.execPath,
        args: [resolve(legacyRuntimeRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('pins activation and rollback reconciliation to the explicit immutable runtime root', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-restart-runtime-root-'));
    const activeRuntimeRoot = resolve(osRoot, 'runtime-current');
    const targetRuntimeRoot = resolve(osRoot, 'runtime-target');
    const calls: Array<{ command: string; args: string[] }> = [];
    try {
      const controller = createReloadServiceController({
        osRoot,
        activeRuntimeRoot,
        home,
        platform: 'darwin',
        environment: { HOME: home },
        run: async (command, args) => {
          calls.push({ command, args });
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      });

      await controller.restart({
        waitForCompletion: true,
        runtimeRoot: targetRuntimeRoot,
      });

      expect(calls.slice(0, 3)).toEqual([
        {
          command: 'bash',
          args: [
            resolve(targetRuntimeRoot, 'scripts', 'install-system-daemons.sh'),
            '--definitions-only',
            '--quiet',
          ],
        },
        {
          command: process.execPath,
          args: [
            resolve(targetRuntimeRoot, 'scripts', 'migrations', 'reconcile-caddy-worker-pool.ts'),
            home,
          ],
        },
        {
          command: process.execPath,
          args: [resolve(targetRuntimeRoot, 'scripts', 'consuelo-reload.js'), 'rolling-reload-now'],
        },
      ]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('publishes a fresh Caddy gateway reconciliation migration with every runtime release', () => {
    const workflow = source('../../.github/workflows/consuelo-os-runtime-publish.yaml');

    expect(workflow).toContain(
      '--migration "release-${{ needs.plan.outputs.version }}-reconcile-caddy-gateway:scripts/migrations/reconcile-caddy-worker-pool.ts"',
    );
    expect(workflow.match(/reconcile-caddy-gateway:scripts\/migrations\/reconcile-caddy-worker-pool\.ts/g)).toHaveLength(1);
  });

  it('fails macOS lifecycle preflight when recognized legacy root supervision remains', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const controller = createReloadServiceController({
      osRoot,
      platform: 'darwin',
      run: async (command, args) => {
        calls.push({ command, args });
        if (args.includes('--check')) {
          return { exitCode: 2, stdout: 'legacy root supervision found', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await expect(controller.preflight()).rejects.toThrow(/legacy.*LaunchDaemon|administrator|sudo/i);
    expect(calls).toEqual([
      {
        command: 'bash',
        args: [resolve(osRoot, 'scripts', 'retire-legacy-system-daemons.sh'), '--check'],
      },
    ]);
  });

  it('fails service restart when the canonical adapter exits non-zero', async () => {
    const controller = createReloadServiceController({
      osRoot,
      run: async () => ({ exitCode: 2, stdout: '', stderr: 'launchctl failed' }),
    });

    await expect(controller.restart()).rejects.toThrow('launchctl failed');
  });
});
