import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  LifecycleHealthAcceptance,
  LifecycleServiceController,
} from './types';
const LEGACY_SYSTEM_DAEMON_RETIREMENT_SCRIPT = 'retire-legacy-system-daemons.sh';
// Caddy and Cloudflared are the public MCP availability boundary. Ordinary
// runtime activation may rotate the OS worker pool behind Caddy, but it must
// not tear down the ingress that carries the client's HTTP connection.
const MAC_RESTARTABLE_SIDECAR_SERVICE_LABELS = new Set([
  'com.consuelo.portless.system',
  'com.consuelo.watchdog',
  'com.consuelo.availability',
]);
const MAC_RESTARTABLE_SIDECAR_SERVICE_PREFIXES = [
  'com.consuelo.os.node-heartbeat.',
];
const MAC_GATEWAY_BOOTSTRAP_ATTEMPTS = 4;
const MAC_GATEWAY_BOOTSTRAP_RETRY_MS = 200;

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

function installedMacRestartableSidecarLaunchAgents(environment?: NodeJS.ProcessEnv): Array<{
  label: string;
  plistPath: string;
}> {
  const userHome = environment?.HOME?.trim();
  if (!userHome) return [];
  const launchAgentDir = join(userHome, 'Library', 'LaunchAgents');
  if (!existsSync(launchAgentDir)) return [];
  return readdirSync(launchAgentDir)
    .filter((name) => name.endsWith('.plist'))
    .map((name) => ({
      label: name.slice(0, -'.plist'.length),
      plistPath: join(launchAgentDir, name),
    }))
    .filter(({ label }) =>
      MAC_RESTARTABLE_SIDECAR_SERVICE_LABELS.has(label)
      || MAC_RESTARTABLE_SIDECAR_SERVICE_PREFIXES.some((prefix) => label.startsWith(prefix)),
    )
    .sort((left, right) => left.label.localeCompare(right.label));
}
export function createReloadServiceController(input: {
  osRoot: string;
  activeRuntimeRoot?: string;
  home?: string;
  nodeHome?: string;
  runtimeExecutable?: string;
  run?: LifecycleProcessRunner;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  userId?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}): LifecycleServiceController {
  const bootstrapReloadScript = resolve(input.osRoot, 'scripts', 'consuelo-reload.js');
  const activeRuntimeRoot = input.activeRuntimeRoot ?? input.osRoot;
  const activeReloadScript = resolve(activeRuntimeRoot, 'scripts', 'consuelo-reload.js');
  const activeDaemonInstaller = resolve(activeRuntimeRoot, 'scripts', 'install-system-daemons.sh');
  const caddyReconcileScript = resolve(
    activeRuntimeRoot,
    'scripts',
    'migrations',
    'reconcile-caddy-worker-pool.ts',
  );
  const lifecycleHome = input.home ?? (input.nodeHome ? resolve(input.nodeHome, '..') : undefined);
  const runtimeExecutable = input.runtimeExecutable ?? process.execPath;
  const legacySystemDaemonRetirementScript = resolve(input.osRoot, 'scripts', LEGACY_SYSTEM_DAEMON_RETIREMENT_SCRIPT);
  const uninstallScript = resolve(input.osRoot, 'scripts', 'uninstall-system-daemons.sh');
  const run = input.run ?? defaultRunner;
  const platform = input.platform ?? process.platform;
  const sleepImpl = input.sleep ?? sleep;
  const reconcileCaddy = async (): Promise<void> => {
    if (platform !== 'darwin' || !lifecycleHome) return;
    try {
      const result = await run(
        runtimeExecutable,
        [caddyReconcileScript, lifecycleHome],
        input.environment ?? process.env,
      );
      if (result.exitCode !== 0) {
        throw commandFailure(result, `Caddy reconciliation exited ${result.exitCode}`);
      }
    } catch (error: unknown) {
      throw new Error(
        `activated runtime Caddy reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  };
  return {
    async preflight() {
      if (!existsSync(bootstrapReloadScript)) {
        throw new Error(`canonical reload adapter is missing: ${bootstrapReloadScript}`);
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
      if (existsSync(caddyReconcileScript)) await reconcileCaddy();
    },
    async restart(options = {}) {
      try {
        if (platform === 'darwin') {
          const definitions = await run(
            'bash',
            [activeDaemonInstaller, '--definitions-only', '--quiet'],
            input.environment ?? process.env,
          );
          if (definitions.exitCode !== 0) {
            throw commandFailure(definitions, `LaunchAgent definition refresh exited ${definitions.exitCode}`);
          }
        }
        await reconcileCaddy();
        const command = options.waitForCompletion
          ? (options.allowDestructiveFallback ? 'reload-now' : 'rolling-reload-now')
          : (options.allowDestructiveFallback ? 'reload' : 'rolling-reload');
        const result = await run(runtimeExecutable, [activeReloadScript, command]);
        if (result.exitCode !== 0) {
          throw commandFailure(result, `reload adapter exited ${result.exitCode}`);
        }
        if (platform === 'darwin' && options.waitForCompletion) {
          const userId = input.userId ?? process.getuid?.();
          if (userId === undefined) {
            throw new Error('cannot resolve the user id for gateway restart');
          }
          const domain = 'gui/' + String(userId);
          for (const gateway of installedMacRestartableSidecarLaunchAgents(input.environment)) {
            await run('launchctl', ['bootout', domain + '/' + gateway.label]);
            let bootstrapped = false;
            let lastBootstrap: LifecycleProcessResult | undefined;
            for (let attempt = 1; attempt <= MAC_GATEWAY_BOOTSTRAP_ATTEMPTS; attempt += 1) {
              const bootstrap = await run('launchctl', [
                'bootstrap',
                domain,
                gateway.plistPath,
              ]);
              lastBootstrap = bootstrap;
              if (bootstrap.exitCode === 0) {
                bootstrapped = true;
                break;
              }

              const detail = `${bootstrap.stdout}\n${bootstrap.stderr}`;
              const transientExitFive = bootstrap.exitCode === 5
                || /Bootstrap failed:\s*5|Input\/output error/i.test(detail);
              if (!transientExitFive) break;

              // launchd can briefly keep the old job in its teardown transaction after
              // bootout. A bootstrap during that window reports exit 5 even though the
              // plist is valid. If the job is already visible again, accept it; otherwise
              // wait briefly and retry the same immutable plist.
              const loaded = await run('launchctl', [
                'print',
                domain + '/' + gateway.label,
              ]);
              if (loaded.exitCode === 0) {
                bootstrapped = true;
                break;
              }
              if (attempt < MAC_GATEWAY_BOOTSTRAP_ATTEMPTS) {
                await sleepImpl(MAC_GATEWAY_BOOTSTRAP_RETRY_MS);
              }
            }
            if (!bootstrapped) {
              const result = lastBootstrap ?? {
                exitCode: 1,
                stdout: '',
                stderr: '',
              };
              const detail = result.stderr.trim() || result.stdout.trim()
                || 'launchctl bootstrap exited ' + String(result.exitCode);
              throw new Error('gateway bootstrap failed for ' + gateway.label + ': ' + detail);
            }
            const kickstart = await run('launchctl', [
              'kickstart',
              '-k',
              domain + '/' + gateway.label,
            ]);
            if (kickstart.exitCode !== 0) {
              throw commandFailure(
                kickstart,
                'gateway restart exited ' + String(kickstart.exitCode) + ': ' + gateway.label,
              );
            }
          }
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
