import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import type { LifecycleServiceController } from '../lifecycle/types';

export type LinuxLibc = 'glibc' | 'musl' | 'unknown';
export type LinuxServiceManager = 'systemd-user' | 'session-process';
export type LinuxServiceState = 'healthy' | 'stopped' | 'failed' | 'unknown';

export type LinuxHost = {
  platform: NodeJS.Platform | string;
  architecture: NodeJS.Architecture | string;
  libc: LinuxLibc;
  supported?: boolean;
  reason?: string;
};

export type LinuxCommand = {
  executable: string;
  args: string[];
  environment?: NodeJS.ProcessEnv;
  cwd?: string;
};

export type LinuxCommandResult = { exitCode: number; stdout: string; stderr: string };
export type LinuxCommandRunner = (command: LinuxCommand) => Promise<LinuxCommandResult>;

export type LinuxPlatformPaths = {
  home: string;
  systemdUserDir: string;
  unitPath: string;
  runtimeEntryPath: string;
  runsDir: string;
  logsDir: string;
  sessionStatePath: string;
};

export type LinuxPlatformStatus = {
  schemaVersion: 1;
  platform: 'linux';
  architecture: string;
  libc: LinuxLibc;
  manager: LinuxServiceManager;
  state: LinuxServiceState;
  unitPath?: string;
  pid?: number;
  detail?: string;
};

export type LinuxAuthHandoff = {
  mode: 'browser' | 'headless';
  verificationUrl: string;
  userCode: string;
  browserOpened: boolean;
};

export type LinuxPlatformAdapter = LifecycleServiceController & {
  install(): Promise<{ manager: LinuxServiceManager }>;
  status(): Promise<LinuxPlatformStatus>;
  handoffAuth(input: { verificationUrl: string; userCode: string }): Promise<LinuxAuthHandoff>;
};

const UNIT_NAME = 'consuelo-os.service';
const SUPPORTED_ARCHITECTURES = new Set(['x64', 'arm64']);

async function defaultRun(command: LinuxCommand): Promise<LinuxCommandResult> {
  try {
    const child = Bun.spawn([command.executable, ...command.args], {
      cwd: command.cwd,
      env: command.environment ?? process.env,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    return { exitCode: 127, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
}

async function defaultSpawnSessionProcess(command: LinuxCommand): Promise<number> {
  const child = spawn(command.executable, command.args, {
    cwd: command.cwd,
    env: command.environment ?? process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  if (child.pid === undefined) throw new Error('failed to start Linux session process');
  return child.pid;
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseLibc(value: string): LinuxLibc {
  if (/musl/i.test(value)) return 'musl';
  if (/glibc|gnu libc/i.test(value)) return 'glibc';
  return 'unknown';
}

function hostSupport(host: LinuxHost): LinuxHost & { supported: boolean } {
  if (host.platform !== 'linux') return { ...host, supported: false, reason: `platform ${host.platform} is not Linux` };
  if (!SUPPORTED_ARCHITECTURES.has(host.architecture)) return { ...host, supported: false, reason: `architecture ${host.architecture} is unsupported` };
  if (host.libc !== 'glibc' && host.libc !== 'musl') return { ...host, supported: false, reason: 'libc could not be identified as glibc or musl' };
  return { ...host, supported: true };
}

export async function detectLinuxHost(input: {
  platform?: NodeJS.Platform | string;
  architecture?: NodeJS.Architecture | string;
  run?: LinuxCommandRunner;
} = {}): Promise<LinuxHost & { supported: boolean }> {
  try {
    const platform = input.platform ?? process.platform;
    const architecture = input.architecture ?? process.arch;
    if (platform !== 'linux' || !SUPPORTED_ARCHITECTURES.has(architecture)) {
      return hostSupport({ platform, architecture, libc: 'unknown' });
    }
    const run = input.run ?? defaultRun;
    const getconf = await run({ executable: 'getconf', args: ['GNU_LIBC_VERSION'] });
    let libc = getconf.exitCode === 0 ? parseLibc(`${getconf.stdout}\n${getconf.stderr}`) : 'unknown';
    if (libc === 'unknown') {
      const ldd = await run({ executable: 'ldd', args: ['--version'] });
      libc = parseLibc(`${ldd.stdout}\n${ldd.stderr}`);
    }
    return hostSupport({ platform, architecture, libc });
  } catch (error: unknown) {
    throw new Error(`Linux host detection failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

export function resolveLinuxPlatformPaths(home: string, environment: NodeJS.ProcessEnv = process.env): LinuxPlatformPaths {
  const resolvedHome = resolve(home);
  const inferredUserHome = basename(resolvedHome) === '.consuelo'
    ? dirname(resolvedHome)
    : resolvedHome;
  const configHome = resolve(environment.XDG_CONFIG_HOME ?? join(inferredUserHome, '.config'));
  const systemdUserDir = join(configHome, 'systemd', 'user');
  return {
    home: resolvedHome,
    systemdUserDir,
    unitPath: join(systemdUserDir, UNIT_NAME),
    runtimeEntryPath: join(resolvedHome, 'runtime', 'current', 'scripts', 'server', 'main.ts'),
    runsDir: join(resolvedHome, 'node', 'runs'),
    logsDir: join(resolvedHome, 'node', 'logs'),
    sessionStatePath: join(resolvedHome, 'node', 'runs', 'linux-session-process.json'),
  };
}

function systemdEscape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function renderSystemdUserUnit(input: { home: string; bunExecutable: string }): string {
  const paths = resolveLinuxPlatformPaths(input.home);
  return [
    '[Unit]',
    'Description=Consuelo OS user runtime',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `Environment="CONSUELO_HOME=${systemdEscape(paths.home)}"`,
    `ExecStart="${systemdEscape(resolve(input.bunExecutable))}" "${systemdEscape(paths.runtimeEntryPath)}"`,
    'Restart=on-failure',
    'RestartSec=2',
    'UMask=0077',
    'NoNewPrivileges=true',
    'PrivateTmp=true',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

function ensurePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function writePrivateFile(path: string, content: string): void {
  ensurePrivateDirectory(dirname(path));
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function commandError(command: LinuxCommand, result: LinuxCommandResult): Error {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
  return new Error(`${command.executable} ${command.args.join(' ')} failed: ${detail}`);
}

function readSessionPid(path: string): number | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { pid?: unknown };
    return typeof parsed.pid === 'number' && Number.isInteger(parsed.pid) && parsed.pid > 0 ? parsed.pid : undefined;
  } catch {
    return undefined;
  }
}

export function createLinuxPlatformAdapter(input: {
  home: string;
  bunExecutable?: string;
  host?: LinuxHost;
  run?: LinuxCommandRunner;
  spawnSessionProcess?: (command: LinuxCommand) => Promise<number>;
  isProcessAlive?: (pid: number) => boolean;
  environment?: NodeJS.ProcessEnv;
}): LinuxPlatformAdapter {
  const environment = input.environment ?? process.env;
  const paths = resolveLinuxPlatformPaths(input.home, environment);
  const run = input.run ?? defaultRun;
  const bunExecutable = resolve(input.bunExecutable ?? process.execPath);
  const spawnSessionProcess = input.spawnSessionProcess ?? defaultSpawnSessionProcess;
  const isProcessAlive = input.isProcessAlive ?? defaultIsProcessAlive;
  let detectedHost: (LinuxHost & { supported: boolean }) | undefined;

  const host = async (): Promise<LinuxHost & { supported: boolean }> => {
    try {
      detectedHost ??= input.host ? hostSupport(input.host) : await detectLinuxHost({ run });
      return detectedHost;
    } catch (error: unknown) {
      throw new Error(`Linux host inspection failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  };

  const assertSupported = async (): Promise<LinuxHost & { supported: true }> => {
    try {
      const current = await host();
      if (!current.supported) throw new Error(`unsupported Linux host: ${current.reason ?? 'unknown compatibility failure'}`);
      return current as LinuxHost & { supported: true };
    } catch (error: unknown) {
      throw error;
    }
  };

  const systemdAvailable = async (): Promise<boolean> => {
    try {
      const result = await run({ executable: 'systemctl', args: ['--user', 'show-environment'], environment });
      return result.exitCode === 0;
    } catch (error: unknown) {
      throw new Error(`systemd user-manager probe failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  };

  const activeManager = async (): Promise<LinuxServiceManager> => {
    try {
      const sessionPid = readSessionPid(paths.sessionStatePath);
      if (sessionPid && isProcessAlive(sessionPid)) return 'session-process';
      if (sessionPid) rmSync(paths.sessionStatePath, { force: true });
      return (await systemdAvailable()) ? 'systemd-user' : 'session-process';
    } catch (error: unknown) {
      throw new Error(`Linux service-manager selection failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  };

  const runtimeCommand = (): LinuxCommand => ({
    executable: bunExecutable,
    args: [paths.runtimeEntryPath],
    environment: { ...environment, CONSUELO_HOME: paths.home },
    cwd: paths.home,
  });

  const startSessionProcess = async (): Promise<number> => {
    try {
      const existingPid = readSessionPid(paths.sessionStatePath);
      if (existingPid && isProcessAlive(existingPid)) return existingPid;
      const pid = await spawnSessionProcess(runtimeCommand());
      writePrivateFile(paths.sessionStatePath, `${JSON.stringify({ schemaVersion: 1, pid }, null, 2)}\n`);
      return pid;
    } catch (error: unknown) {
      throw new Error(`Linux session fallback failed to start: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  };

  const stopSessionProcess = (): void => {
    const pid = readSessionPid(paths.sessionStatePath);
    if (pid && isProcessAlive(pid)) {
      try { process.kill(pid, 'SIGTERM'); } catch { /* process exited between check and signal */ }
    }
    rmSync(paths.sessionStatePath, { force: true });
  };

  const preflight = async (): Promise<void> => {
    try {
      await assertSupported();
    } catch (error: unknown) {
      throw error;
    }
  };

  return {
    preflight,
    async install() {
      try {
        await preflight();
        ensurePrivateDirectory(paths.home);
        ensurePrivateDirectory(paths.runsDir);
        ensurePrivateDirectory(paths.logsDir);
        if (await systemdAvailable()) {
          writePrivateFile(paths.unitPath, renderSystemdUserUnit({ home: paths.home, bunExecutable }));
          for (const command of [
            { executable: 'systemctl', args: ['--user', 'daemon-reload'], environment },
            { executable: 'systemctl', args: ['--user', 'enable', '--now', UNIT_NAME], environment },
          ]) {
            const result = await run(command);
            if (result.exitCode !== 0) throw commandError(command, result);
          }
          return { manager: 'systemd-user' };
        }
        await startSessionProcess();
        return { manager: 'session-process' };
      } catch (error: unknown) {
        throw new Error(`Linux service installation failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
    async restart() {
      try {
        await preflight();
        if ((await activeManager()) === 'systemd-user') {
          if (!existsSync(paths.unitPath)) {
            writePrivateFile(paths.unitPath, renderSystemdUserUnit({ home: paths.home, bunExecutable }));
            for (const command of [
              { executable: 'systemctl', args: ['--user', 'daemon-reload'], environment },
              { executable: 'systemctl', args: ['--user', 'enable', '--now', UNIT_NAME], environment },
            ]) {
              const result = await run(command);
              if (result.exitCode !== 0) throw commandError(command, result);
            }
          } else {
            const command = { executable: 'systemctl', args: ['--user', 'restart', UNIT_NAME], environment };
            const result = await run(command);
            if (result.exitCode !== 0) throw commandError(command, result);
          }
          return;
        }
        stopSessionProcess();
        await startSessionProcess();
      } catch (error: unknown) {
        throw new Error(`Linux service restart failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
    async status() {
      try {
        const currentHost = await assertSupported();
        if ((await activeManager()) === 'systemd-user') {
          const command = { executable: 'systemctl', args: ['--user', 'is-active', UNIT_NAME], environment };
          const result = await run(command);
          const active = result.exitCode === 0 && result.stdout.trim() === 'active';
          return {
            schemaVersion: 1,
            platform: 'linux',
            architecture: currentHost.architecture,
            libc: currentHost.libc,
            manager: 'systemd-user',
            state: active ? 'healthy' : result.stdout.trim() === 'inactive' ? 'stopped' : 'failed',
            unitPath: paths.unitPath,
            ...(!active ? { detail: result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}` } : {}),
          };
        }
        const pid = readSessionPid(paths.sessionStatePath);
        const alive = pid !== undefined && isProcessAlive(pid);
        return {
          schemaVersion: 1,
          platform: 'linux',
          architecture: currentHost.architecture,
          libc: currentHost.libc,
          manager: 'session-process',
          state: alive ? 'healthy' : pid ? 'failed' : 'stopped',
          ...(pid ? { pid } : {}),
        };
      } catch (error: unknown) {
        throw new Error(`Linux service status failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
    async handoffAuth(auth) {
      try {
        const displayAvailable = Boolean(environment.DISPLAY || environment.WAYLAND_DISPLAY);
        if (displayAvailable) {
          const result = await run({ executable: 'xdg-open', args: [auth.verificationUrl], environment });
          if (result.exitCode === 0) return { ...auth, mode: 'browser', browserOpened: true };
        }
        return { ...auth, mode: 'headless', browserOpened: false };
      } catch (error: unknown) {
        throw new Error(`Linux authentication handoff failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
    async uninstall(options = {}) {
      try {
        await assertSupported();
        if (options.dryRun) return;
        if (await systemdAvailable()) {
          const disable = { executable: 'systemctl', args: ['--user', 'disable', '--now', UNIT_NAME], environment };
          const result = await run(disable);
          const detail = `${result.stdout}\n${result.stderr}`;
          if (result.exitCode !== 0 && !/not loaded|not found|does not exist|no such file/i.test(detail)) throw commandError(disable, result);
          rmSync(paths.unitPath, { force: true });
          const reload = { executable: 'systemctl', args: ['--user', 'daemon-reload'], environment };
          const reloaded = await run(reload);
          if (reloaded.exitCode !== 0) throw commandError(reload, reloaded);
        }
        stopSessionProcess();
        rmSync(paths.unitPath, { force: true });
      } catch (error: unknown) {
        throw new Error(`Linux service uninstall failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    },
  };
}
