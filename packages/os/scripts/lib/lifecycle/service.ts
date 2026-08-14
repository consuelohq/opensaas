import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  LifecycleHealthAcceptance,
  LifecycleServiceController,
} from './types';
import { reconcileCaddyWorkerPoolConfig } from '../caddy-worker-pool-reconciliation';

const CADDY_SERVICE_LABEL = 'com.consuelo.caddy';
const LEGACY_SYSTEM_DAEMON_RETIREMENT_SCRIPT = 'retire-legacy-system-daemons.sh';

export type LifecycleProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type LifecycleProcessRunner = (
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
) => Promise<LifecycleProcessResult>;

async function defaultRunner(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<LifecycleProcessResult> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error(
      `failed to execute lifecycle service command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function commandFailure(result: LifecycleProcessResult, fallback: string): Error {
  return new Error(result.stderr.trim() || result.stdout.trim() || fallback);
}

export function createReloadServiceController(input: {
  osRoot: string;
  nodeHome?: string;
  run?: LifecycleProcessRunner;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  userId?: number;
}): LifecycleServiceController {
  const reloadScript = resolve(input.osRoot, 'scripts', 'consuelo-reload.js');
  const legacySystemDaemonRetirementScript = resolve(input.osRoot, 'scripts', LEGACY_SYSTEM_DAEMON_RETIREMENT_SCRIPT);
  const uninstallScript = resolve(input.osRoot, 'scripts', 'uninstall-system-daemons.sh');
  const run = input.run ?? defaultRunner;
  const platform = input.platform ?? process.platform;
  let caddyTopologyChanged = false;
  const reconcileCaddy = (): void => {
    if (platform !== 'darwin' || !input.nodeHome) return;
    caddyTopologyChanged =
      reconcileCaddyWorkerPoolConfig({
        nodeHome: input.nodeHome,
        env: input.environment ?? process.env,
      }).changed || caddyTopologyChanged;
  };
  return {
    async preflight() {
      if (!existsSync(reloadScript)) {
        throw new Error(`canonical reload adapter is missing: ${reloadScript}`);
      }
      if (platform === 'darwin') {
        if (!existsSync(legacySystemDaemonRetirementScript)) {
          throw new Error(`legacy system-daemon retirement adapter is missing: ${legacySystemDaemonRetirementScript}`);
        }
        const legacy = await run('bash', [legacySystemDaemonRetirementScript, '--check']);
        if (legacy.exitCode === 2) {
          throw new Error('Legacy root Consuelo LaunchDaemons are still installed. Retire them once with: ' + `sudo bash '${legacySystemDaemonRetirementScript}' --apply` + ', then rerun the lifecycle command.');
        }
        if (legacy.exitCode !== 0) {
          throw commandFailure(legacy, `legacy system-daemon check exited ${legacy.exitCode}`);
        }
      }
      reconcileCaddy();
    },
    async restart(options = {}) {
      try {
        reconcileCaddy();
        const command = options.waitForCompletion ? 'restart-now' : 'restart';
        const result = await run(process.execPath, [reloadScript, command]);
        if (result.exitCode !== 0) {
          throw commandFailure(result, `reload adapter exited ${result.exitCode}`);
        }
        if (caddyTopologyChanged) {
          const userId = input.userId ?? process.getuid?.();
          if (userId === undefined) {
            throw new Error('cannot resolve the user id for Caddy restart');
          }
          const caddy = await run('launchctl', [
            'kickstart',
            '-k',
            'gui/' + String(userId) + '/' + CADDY_SERVICE_LABEL,
          ]);
          if (caddy.exitCode !== 0) {
            throw commandFailure(caddy, `Caddy restart exited ${caddy.exitCode}`);
          }
          caddyTopologyChanged = false;
        }
      } catch (error: unknown) {
        throw new Error(
          `canonical reload adapter failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
    async uninstall(options = {}) {
      try {
        if (platform === 'darwin') {
          if (!existsSync(uninstallScript)) {
            throw new Error(`canonical uninstall adapter is missing: ${uninstallScript}`);
          }
          const args = [uninstallScript, ...(options.dryRun ? ['--dry-run'] : [])];
          const result = await run('bash', args, {
            ...process.env,
            ...(options.home ? { CONSUELO_HOME: options.home } : {}),
          });
          if (result.exitCode !== 0) {
            throw commandFailure(result, `uninstall adapter exited ${result.exitCode}`);
          }
          return;
        }
        if (options.dryRun) return;
        if (platform === 'linux') {
          const ownedUnits = [
            'consuelo-os.service',
            'consuelo-portless.service',
            'consuelo-watchdog.service',
          ];
          for (const unit of ownedUnits) {
            const result = await run('systemctl', ['--user', 'disable', '--now', unit]);
            const detail = `${result.stdout}\n${result.stderr}`;
            if (
              result.exitCode !== 0
              && !/not loaded|not found|does not exist|no such file/i.test(detail)
            ) {
              throw commandFailure(result, `systemctl failed for ${unit}`);
            }
          }
          return;
        }
        if (platform === 'win32') {
          const ownedServices = ['ConsueloOS', 'ConsueloPortless', 'ConsueloWatchdog'];
          for (const service of ownedServices) {
            await run('sc.exe', ['stop', service]);
            const deleted = await run('sc.exe', ['delete', service]);
            const detail = `${deleted.stdout}\n${deleted.stderr}`;
            if (deleted.exitCode !== 0 && !/does not exist|1060/i.test(detail)) {
              throw commandFailure(deleted, `service deletion failed for ${service}`);
            }
          }
        }
      } catch (error: unknown) {
        throw new Error(
          `canonical service uninstall failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  };
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export function createHttpHealthAcceptance(input: {
  url: string;
  attempts?: number;
  intervalMs?: number;
  expectedName?: string;
  expectedBundleId?: string;
  fetchImpl?: typeof fetch;
}): LifecycleHealthAcceptance {
  const attempts = input.attempts ?? 40;
  const intervalMs = input.intervalMs ?? 500;
  const expectedName = input.expectedName ?? 'consuelo-os';
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async accept(expected = {}) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetchImpl(input.url, { signal: AbortSignal.timeout(2_000) });
          if (response.ok) {
            const body = (await response.json()) as { name?: string; bundleId?: string; version?: string };
            const expectedBundleId = expected.bundleId ?? input.expectedBundleId;
            if (
              body.name === expectedName
              && (!expectedBundleId || body.bundleId === expectedBundleId)
              && (!expected.version || body.version === expected.version)
            ) return true;
          }
        } catch {
          // A bounded retry follows; health failure remains a typed engine result.
        }
        if (attempt + 1 < attempts) await sleep(intervalMs);
      }
      return false;
    },
  };
}
