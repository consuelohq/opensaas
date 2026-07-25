import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { win32 } from 'node:path';

import type { LifecycleServiceController } from './lifecycle/types';

export const WINDOWS_SERVICE_NAME = 'ConsueloOS';
export const MINIMUM_WINDOWS_BUILD = 19045;

export type WindowsHostInfo = {
  platform: string;
  architecture: string;
  build: number;
  productName: string;
};

export type WindowsProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type WindowsProcessRunner = (
  command: string,
  args: string[],
) => Promise<WindowsProcessResult>;

export type WindowsPlatformFileSystem = {
  exists(path: string): boolean;
  mkdir(path: string): void;
  writeFile(path: string, contents: string): void;
  remove(path: string): void;
};

export type WindowsServiceStatus = {
  state:
    | 'absent'
    | 'stopped'
    | 'start-pending'
    | 'stop-pending'
    | 'running'
    | 'unknown';
  raw: string;
};

export type WindowsServiceController = LifecycleServiceController & {
  install(options?: { start?: boolean }): Promise<void>;
  status(): Promise<WindowsServiceStatus>;
  diagnostics(): Promise<{
    serviceName: string;
    state: WindowsServiceStatus['state'];
    bunExecutable: string;
    serviceHostExecutable: string;
    serviceConfig: string;
    runtimeCurrent: string;
    logs: string;
  }>;
};

const defaultFileSystem: WindowsPlatformFileSystem = {
  exists: existsSync,
  mkdir(path) {
    mkdirSync(path, { recursive: true });
  },
  writeFile(path, contents) {
    writeFileSync(path, contents, { encoding: 'utf8', mode: 0o600 });
  },
  remove(path) {
    rmSync(path, { force: true, recursive: true });
  },
};

async function defaultRunner(
  command: string,
  args: string[],
): Promise<WindowsProcessResult> {
  try {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error(
      `failed to execute Windows platform command: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export function detectWindowsHost(): WindowsHostInfo {
  const release = os.release();
  const buildText = release.split('.').at(-1) ?? '';
  const build = Number.parseInt(buildText, 10);
  return {
    platform: process.platform,
    architecture: os.arch(),
    build: Number.isFinite(build) ? build : 0,
    productName: 'Windows',
  };
}

export function assertSupportedWindowsHost(host: WindowsHostInfo): void {
  if (host.platform !== 'win32') {
    throw new Error(
      'Consuelo OS Windows support requires native Windows; WSL is not supported',
    );
  }
  if (host.architecture !== 'x64') {
    throw new Error(
      `Consuelo OS Windows support requires x64; received ${host.architecture}`,
    );
  }
  if (!Number.isInteger(host.build) || host.build < MINIMUM_WINDOWS_BUILD) {
    throw new Error(
      `unsupported Windows build ${host.build}; Windows 10 22H2, Windows 11, Windows Server 2022, or Windows Server 2025 is required`,
    );
  }
}

export function resolveWindowsPlatformPaths(input: {
  userProfile: string;
  home?: string;
}): {
  home: string;
  runtimeCurrent: string;
  serviceDirectory: string;
  serviceConfig: string;
  logs: string;
} {
  if (!input.userProfile.trim())
    throw new Error('Windows USERPROFILE is required');
  const home = input.home
    ? win32.resolve(input.home)
    : win32.join(input.userProfile, '.consuelo');
  const serviceDirectory = win32.join(home, 'node', 'service');
  return {
    home,
    runtimeCurrent: win32.join(home, 'runtime', 'current'),
    serviceDirectory,
    serviceConfig: win32.join(serviceDirectory, 'windows-service.json'),
    logs: win32.join(home, 'node', 'logs'),
  };
}

function failure(result: WindowsProcessResult, fallback: string): Error {
  return new Error(result.stderr.trim() || result.stdout.trim() || fallback);
}

function contextualError(operation: string, error: unknown): Error {
  return new Error(
    `${operation}: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

function isServiceAbsent(result: WindowsProcessResult): boolean {
  return (
    result.exitCode === 1060 ||
    /does not exist|failed 1060/i.test(`${result.stdout}\n${result.stderr}`)
  );
}

function isServiceAlreadyRunning(result: WindowsProcessResult): boolean {
  return (
    result.exitCode === 1056 ||
    /already running|failed 1056/i.test(`${result.stdout}\n${result.stderr}`)
  );
}

function isServiceAlreadyStopped(result: WindowsProcessResult): boolean {
  return (
    result.exitCode === 1062 ||
    /not started|failed 1062/i.test(`${result.stdout}\n${result.stderr}`)
  );
}

function parseServiceStatus(
  result: WindowsProcessResult,
): WindowsServiceStatus {
  const raw = `${result.stdout}\n${result.stderr}`.trim();
  if (isServiceAbsent(result)) return { state: 'absent', raw };
  if (result.exitCode !== 0)
    throw failure(result, `sc.exe query exited ${result.exitCode}`);
  if (/STATE\s*:\s*4\s+RUNNING/i.test(raw)) return { state: 'running', raw };
  if (/STATE\s*:\s*3\s+STOP_PENDING/i.test(raw))
    return { state: 'stop-pending', raw };
  if (/STATE\s*:\s*2\s+START_PENDING/i.test(raw))
    return { state: 'start-pending', raw };
  if (/STATE\s*:\s*1\s+STOPPED/i.test(raw)) return { state: 'stopped', raw };
  return { state: 'unknown', raw };
}

function assertAbsoluteWindowsExecutable(path: string, label: string): void {
  if (!win32.isAbsolute(path))
    throw new Error(`${label} must be an absolute Windows path`);
}

function isWindowsPathWithin(parent: string, candidate: string): boolean {
  const normalizedParent = win32
    .resolve(parent)
    .replace(/[\\/]+$/, '')
    .toLowerCase();
  const normalizedCandidate = win32.resolve(candidate).toLowerCase();
  return normalizedCandidate.startsWith(`${normalizedParent}\\`);
}

function assertProtectedServiceExecutable(input: {
  home: string;
  path: string;
  label: string;
}): void {
  assertAbsoluteWindowsExecutable(input.path, input.label);
  if (!isWindowsPathWithin(input.home, input.path)) {
    throw new Error(
      `${input.label} must be inside the protected Consuelo home: ${input.home}`,
    );
  }
}

export function createWindowsServiceController(input: {
  home: string;
  bunExecutable: string;
  serviceHostExecutable: string;
  currentUserSid: string;
  host?: WindowsHostInfo;
  isElevated?: boolean | (() => Promise<boolean>);
  serviceName?: string;
  run?: WindowsProcessRunner;
  fileSystem?: WindowsPlatformFileSystem;
  pollAttempts?: number;
  pollIntervalMs?: number;
}): WindowsServiceController {
  const host = input.host ?? detectWindowsHost();
  const run = input.run ?? defaultRunner;
  const fileSystem = input.fileSystem ?? defaultFileSystem;
  const serviceName = input.serviceName ?? WINDOWS_SERVICE_NAME;
  const pollAttempts = input.pollAttempts ?? 40;
  const pollIntervalMs = input.pollIntervalMs ?? 250;
  const paths = resolveWindowsPlatformPaths({
    userProfile: win32.dirname(input.home),
    home: input.home,
  });

  const queryStatus = async (): Promise<WindowsServiceStatus> => {
    try {
      return parseServiceStatus(await run('sc.exe', ['query', serviceName]));
    } catch (error: unknown) {
      throw contextualError(
        `failed to query Windows service ${serviceName}`,
        error,
      );
    }
  };

  const waitForState = async (
    expected: WindowsServiceStatus['state'],
  ): Promise<WindowsServiceStatus> => {
    try {
      let latest: WindowsServiceStatus = { state: 'unknown', raw: '' };
      for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
        latest = await queryStatus();
        if (latest.state === expected) return latest;
        if (attempt + 1 < pollAttempts) await sleep(pollIntervalMs);
      }
      throw new Error(
        `Windows service ${serviceName} did not reach ${expected}; last state was ${latest.state}`,
      );
    } catch (error: unknown) {
      throw contextualError(
        `failed while waiting for Windows service ${serviceName} to reach ${expected}`,
        error,
      );
    }
  };

  const preflight = (): Promise<void> => {
    try {
      assertSupportedWindowsHost(host);
      assertProtectedServiceExecutable({
        home: paths.home,
        path: input.bunExecutable,
        label: 'Bun executable',
      });
      assertProtectedServiceExecutable({
        home: paths.home,
        path: input.serviceHostExecutable,
        label: 'Windows service host',
      });
      if (!fileSystem.exists(input.bunExecutable)) {
        throw new Error(
          `persisted Bun executable is missing: ${input.bunExecutable}`,
        );
      }
      if (!fileSystem.exists(input.serviceHostExecutable)) {
        throw new Error(
          `Windows service host is missing: ${input.serviceHostExecutable}`,
        );
      }
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(
        contextualError('Windows platform preflight failed', error),
      );
    }
  };

  const resolveElevation = async (): Promise<boolean> => {
    try {
      if (typeof input.isElevated === 'boolean') return input.isElevated;
      if (typeof input.isElevated === 'function') return input.isElevated();
      const result = await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      ]);
      return result.exitCode === 0 && /^true$/i.test(result.stdout.trim());
    } catch (error: unknown) {
      throw contextualError(
        'failed to determine Windows elevation state',
        error,
      );
    }
  };

  const requireElevation = async (): Promise<void> => {
    try {
      if (!(await resolveElevation())) {
        throw new Error(
          'Windows service registration requires elevation. Run PowerShell as Administrator and retry.',
        );
      }
    } catch (error: unknown) {
      throw contextualError('Windows elevation check failed', error);
    }
  };

  return {
    preflight,
    async install(options = {}) {
      try {
        assertSupportedWindowsHost(host);
        await preflight();
        await requireElevation();

        fileSystem.mkdir(paths.home);
        fileSystem.mkdir(paths.serviceDirectory);
        fileSystem.mkdir(paths.logs);
        fileSystem.writeFile(
          paths.serviceConfig,
          `${JSON.stringify(
            {
              schemaVersion: 1,
              bunExecutable: input.bunExecutable,
              consueloHome: paths.home,
              runtimeCurrent: paths.runtimeCurrent,
              entrypoint: 'scripts/server/main.ts',
              logs: paths.logs,
            },
            null,
            2,
          )}\n`,
        );

        const binPath = `"${input.serviceHostExecutable}" --config "${paths.serviceConfig}"`;
        const created = await run('sc.exe', [
          'create',
          serviceName,
          'binPath=',
          binPath,
          'start=',
          'auto',
          'obj=',
          'NT AUTHORITY\\LocalService',
          'DisplayName=',
          'Consuelo OS',
        ]);
        if (
          created.exitCode !== 0 &&
          created.exitCode !== 1073 &&
          !/failed 1073/i.test(`${created.stdout}\n${created.stderr}`)
        ) {
          throw failure(
            created,
            `failed to create Windows service ${serviceName}`,
          );
        }
        if (created.exitCode !== 0) {
          const configured = await run('sc.exe', [
            'config',
            serviceName,
            'binPath=',
            binPath,
            'start=',
            'auto',
            'obj=',
            'NT AUTHORITY\\LocalService',
            'DisplayName=',
            'Consuelo OS',
          ]);
          if (configured.exitCode !== 0) {
            throw failure(
              configured,
              `failed to update Windows service ${serviceName}`,
            );
          }
        }

        for (const args of [
          ['sidtype', serviceName, 'restricted'],
          [
            'failure',
            serviceName,
            'reset=',
            '86400',
            'actions=',
            'restart/5000/restart/15000//0',
          ],
          ['failureflag', serviceName, '1'],
          ['description', serviceName, 'Consuelo OS local runtime service'],
        ]) {
          const result = await run('sc.exe', args);
          if (result.exitCode !== 0) {
            throw failure(
              result,
              `failed to configure Windows service ${serviceName}`,
            );
          }
        }

        const serviceDacl = await run('sc.exe', [
          'sdset',
          serviceName,
          `D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPWPDTLOCRRC;;;${input.currentUserSid})`,
        ]);
        if (serviceDacl.exitCode !== 0) {
          throw failure(
            serviceDacl,
            `failed to restrict Windows service control for ${serviceName}`,
          );
        }

        const acl = await run('icacls.exe', [
          paths.home,
          '/inheritance:r',
          '/grant:r',
          `*${input.currentUserSid}:(OI)(CI)F`,
          '*S-1-5-18:(OI)(CI)F',
          `NT SERVICE\\${serviceName}:(OI)(CI)M`,
          '/t',
          '/c',
        ]);
        if (acl.exitCode !== 0)
          throw failure(acl, 'failed to apply restrictive Consuelo ACLs');

        const profileTraversalAcl = await run('icacls.exe', [
          win32.dirname(paths.home),
          '/grant:r',
          `NT SERVICE\\${serviceName}:(RX)`,
          '/c',
        ]);
        if (profileTraversalAcl.exitCode !== 0) {
          throw failure(
            profileTraversalAcl,
            'failed to grant Windows service profile traversal',
          );
        }

        if (options.start !== false) {
          const started = await run('sc.exe', ['start', serviceName]);
          if (started.exitCode !== 0 && !isServiceAlreadyRunning(started)) {
            throw failure(
              started,
              `failed to start Windows service ${serviceName}`,
            );
          }
          await waitForState('running');
        }
      } catch (error: unknown) {
        throw contextualError(
          `failed to install Windows service ${serviceName}`,
          error,
        );
      }
    },
    async restart(options = {}) {
      try {
        await preflight();
        const stopped = await run('sc.exe', ['stop', serviceName]);
        if (
          stopped.exitCode !== 0 &&
          !isServiceAlreadyStopped(stopped) &&
          !isServiceAbsent(stopped)
        ) {
          throw failure(
            stopped,
            `failed to stop Windows service ${serviceName}`,
          );
        }
        if (!isServiceAlreadyStopped(stopped) && !isServiceAbsent(stopped)) {
          await waitForState('stopped');
        }
        const started = await run('sc.exe', ['start', serviceName]);
        if (started.exitCode !== 0 && !isServiceAlreadyRunning(started)) {
          throw failure(
            started,
            `failed to start Windows service ${serviceName}`,
          );
        }
        if (options.waitForCompletion) await waitForState('running');
      } catch (error: unknown) {
        throw contextualError(
          `failed to restart Windows service ${serviceName}`,
          error,
        );
      }
    },
    status: queryStatus,
    async diagnostics() {
      try {
        const status = await queryStatus();
        return {
          serviceName,
          state: status.state,
          bunExecutable: input.bunExecutable,
          serviceHostExecutable: input.serviceHostExecutable,
          serviceConfig: paths.serviceConfig,
          runtimeCurrent: paths.runtimeCurrent,
          logs: paths.logs,
        };
      } catch (error: unknown) {
        throw contextualError(
          `failed to collect Windows service diagnostics for ${serviceName}`,
          error,
        );
      }
    },
    async uninstall(options = {}) {
      try {
        if (options.dryRun) return;
        assertSupportedWindowsHost(host);
        await requireElevation();
        const stopped = await run('sc.exe', ['stop', serviceName]);
        if (
          stopped.exitCode !== 0 &&
          !isServiceAlreadyStopped(stopped) &&
          !isServiceAbsent(stopped)
        ) {
          throw failure(
            stopped,
            `failed to stop Windows service ${serviceName}`,
          );
        }
        const deleted = await run('sc.exe', ['delete', serviceName]);
        if (deleted.exitCode !== 0 && !isServiceAbsent(deleted)) {
          throw failure(
            deleted,
            `failed to delete Windows service ${serviceName}`,
          );
        }
        for (const path of [
          paths.serviceConfig,
          input.serviceHostExecutable,
          input.bunExecutable,
        ]) {
          if (isWindowsPathWithin(paths.home, path)) fileSystem.remove(path);
        }
      } catch (error: unknown) {
        throw contextualError(
          `failed to uninstall Windows service ${serviceName}`,
          error,
        );
      }
    },
  };
}
