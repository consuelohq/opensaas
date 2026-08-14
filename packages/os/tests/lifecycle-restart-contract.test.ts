import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'restart-now'],
      },
    ]);

    calls.length = 0;
    await controller.restart();
    expect(calls).toEqual([
      {
        command: process.execPath,
        args: [resolve(osRoot, 'scripts', 'consuelo-reload.js'), 'restart'],
      },
    ]);
  });

  it('reconciles preserved Caddy topology before lifecycle restart', () => {
    const lifecycle = source('scripts/lifecycle.ts');
    const service = source('scripts/lib/lifecycle/service.ts');

    expect(lifecycle).toContain('nodeHome: lifecyclePaths.nodeDir');
    expect(service).toContain('reconcileCaddyWorkerPoolConfig');
    expect(service).toContain("'com.consuelo.caddy'");
    expect(service).toContain("const caddy = await run('launchctl'");
    expect(service).toContain("'kickstart',");
    expect(service).toContain("'-k',");
    const workflow = source('../../.github/workflows/consuelo-os-runtime-publish.yaml');
    expect(workflow).toContain(
      '--migration "2026-08-13-reconcile-caddy-worker-pool:scripts/migrations/reconcile-caddy-worker-pool.ts"',
    );
    expect(workflow).toContain(
      '--migration "2026-08-13-reconcile-caddy-ha-watchdog:scripts/migrations/reconcile-caddy-ha-watchdog.ts"',
    );
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
