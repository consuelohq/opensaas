import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createLinuxPlatformAdapter,
  detectLinuxHost,
  renderSystemdUserUnit,
  resolveLinuxPlatformPaths,
  type LinuxCommand,
} from '../scripts/lib/platforms/linux';

let home = '';
let commands: LinuxCommand[] = [];
let environment: NodeJS.ProcessEnv = {};

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-linux-platform-'));
  commands = [];
  environment = { HOME: join(home, 'login-home') };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function runner(responses: Array<{ exitCode: number; stdout?: string; stderr?: string }> = []) {
  return async (command: LinuxCommand) => {
    commands.push(command);
    const response = responses.shift() ?? { exitCode: 0 };
    return { stdout: '', stderr: '', ...response };
  };
}

describe('Linux platform adapter', () => {
  it('detects supported glibc and musl hosts without relying on PATH-provided Bun', async () => {
    await expect(detectLinuxHost({
      platform: 'linux',
      architecture: 'x64',
      run: runner([{ exitCode: 0, stdout: 'glibc 2.39\n' }]),
    })).resolves.toMatchObject({ architecture: 'x64', libc: 'glibc', supported: true });

    await expect(detectLinuxHost({
      platform: 'linux',
      architecture: 'arm64',
      run: runner([
        { exitCode: 1 },
        { exitCode: 0, stderr: 'musl libc (x86_64)\nVersion 1.2.5\n' },
      ]),
    })).resolves.toMatchObject({ architecture: 'arm64', libc: 'musl', supported: true });
  });

  it('fails before service mutation for unsupported OS, architecture, or libc', async () => {
    for (const host of [
      { platform: 'darwin' as const, architecture: 'arm64' as const, libc: 'glibc' as const },
      { platform: 'linux' as const, architecture: 's390x' as const, libc: 'glibc' as const },
      { platform: 'linux' as const, architecture: 'x64' as const, libc: 'unknown' as const },
    ]) {
      const adapter = createLinuxPlatformAdapter({
        home,
        environment,
        host,
        run: runner(),
        bunExecutable: '/opt/consuelo/bin/bun',
      });
      await expect(adapter.install()).rejects.toThrow(/unsupported linux host/i);
      expect(commands).toEqual([]);
      expect(existsSync(resolveLinuxPlatformPaths(home, environment).unitPath)).toBe(false);
    }
  });

  it('renders and installs a strict systemd user service using immutable runtime/current', async () => {
    const adapter = createLinuxPlatformAdapter({
      home,
      environment,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0 },
      ]),
      bunExecutable: '/opt/consuelo/bin/bun',
    });

    await adapter.install();

    const paths = resolveLinuxPlatformPaths(home, environment);
    expect(readFileSync(paths.unitPath, 'utf8')).toBe(renderSystemdUserUnit({
      home,
      bunExecutable: '/opt/consuelo/bin/bun',
    }));
    expect(statSync(paths.unitPath).mode & 0o777).toBe(0o600);
    expect(statSync(paths.systemdUserDir).mode & 0o777).toBe(0o700);
    expect(readFileSync(paths.unitPath, 'utf8')).toContain(`${home}/runtime/current/scripts/server/main.ts`);
    expect(commands.map(({ executable, args }) => [executable, args])).toEqual([
      ['systemctl', ['--user', 'show-environment']],
      ['systemctl', ['--user', 'daemon-reload']],
      ['systemctl', ['--user', 'enable', '--now', 'consuelo-os.service']],
    ]);
  });

  it('materializes and enables the systemd unit when lifecycle activation restarts a fresh install', async () => {
    const adapter = createLinuxPlatformAdapter({
      home,
      environment,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0 },
      ]),
      bunExecutable: '/alternate/path/bun',
    });

    await adapter.restart({ waitForCompletion: true });

    expect(existsSync(resolveLinuxPlatformPaths(home, environment).unitPath)).toBe(true);
    expect(commands.map(({ executable, args }) => [executable, args])).toEqual([
      ['systemctl', ['--user', 'show-environment']],
      ['systemctl', ['--user', 'daemon-reload']],
      ['systemctl', ['--user', 'enable', '--now', 'consuelo-os.service']],
    ]);
  });

  it('keeps systemd user configuration under the login home when the OS data home is custom', async () => {
    const osHome = join(home, 'var-lib-consuelo');
    const userHome = join(home, 'home-consuelo');
    const customEnvironment = { HOME: userHome };
    const paths = resolveLinuxPlatformPaths(osHome, customEnvironment);
    expect(paths.systemdUserDir).toBe(
      join(userHome, '.config', 'systemd', 'user'),
    );

    const adapter = createLinuxPlatformAdapter({
      home: osHome,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0 },
      ]),
      bunExecutable: '/home/consuelo/.bun/bin/bun',
      environment: customEnvironment,
    });

    await adapter.restart({ waitForCompletion: true });

    expect(existsSync(paths.unitPath)).toBe(true);
    expect(commands.map(({ executable, args }) => [executable, args])).toEqual([
      ['systemctl', ['--user', 'show-environment']],
      ['systemctl', ['--user', 'daemon-reload']],
      ['systemctl', ['--user', 'enable', '--now', 'consuelo-os.service']],
    ]);
  });

  it('uses a bounded session-process fallback when systemd user services are unavailable', async () => {
    const adapter = createLinuxPlatformAdapter({
      home,
      environment,
      host: { platform: 'linux', architecture: 'arm64', libc: 'musl' },
      run: runner([{ exitCode: 1, stderr: 'Failed to connect to bus' }]),
      bunExecutable: '/custom/bun',
      spawnSessionProcess: async (command) => {
        commands.push(command);
        return 4242;
      },
      isProcessAlive: (pid) => pid === 4242,
    });

    await expect(adapter.install()).resolves.toMatchObject({ manager: 'session-process' });
    const paths = resolveLinuxPlatformPaths(home, environment);
    expect(JSON.parse(readFileSync(paths.sessionStatePath, 'utf8'))).toMatchObject({ pid: 4242 });
    expect(statSync(paths.sessionStatePath).mode & 0o777).toBe(0o600);
    await expect(adapter.status()).resolves.toMatchObject({
      manager: 'session-process',
      state: 'healthy',
      pid: 4242,
    });
  });

  it('opens browser auth when available and returns the same headless URL/code contract otherwise', async () => {
    const adapter = createLinuxPlatformAdapter({
      home,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([{ exitCode: 0 }]),
      bunExecutable: '/opt/bun',
      environment: { ...environment, DISPLAY: ':0' },
    });
    await expect(adapter.handoffAuth({
      verificationUrl: 'https://login.example/device',
      userCode: 'ABCD-EFGH',
    })).resolves.toEqual({
      mode: 'browser',
      verificationUrl: 'https://login.example/device',
      userCode: 'ABCD-EFGH',
      browserOpened: true,
    });
    expect(commands.at(-1)).toMatchObject({
      executable: 'xdg-open',
      args: ['https://login.example/device'],
    });

    commands = [];
    const headless = createLinuxPlatformAdapter({
      home,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner(),
      bunExecutable: '/opt/bun',
      environment,
    });
    await expect(headless.handoffAuth({
      verificationUrl: 'https://login.example/device',
      userCode: 'ABCD-EFGH',
    })).resolves.toEqual({
      mode: 'headless',
      verificationUrl: 'https://login.example/device',
      userCode: 'ABCD-EFGH',
      browserOpened: false,
    });
    expect(commands).toEqual([]);
  });

  it('reports structured diagnostics and removes only Consuelo-owned service artifacts', async () => {
    const paths = resolveLinuxPlatformPaths(home, environment);
    mkdirSync(paths.systemdUserDir, { recursive: true });
    mkdirSync(join(home, 'workspaces', 'user-workspace'), { recursive: true });
    writeFileSync(paths.unitPath, 'owned unit\n');
    writeFileSync(join(paths.systemdUserDir, 'user-owned.service'), 'keep\n');
    writeFileSync(join(home, 'workspaces', 'user-workspace', 'note.md'), 'keep\n');
    const adapter = createLinuxPlatformAdapter({
      home,
      environment,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([
        { exitCode: 0 },
        { exitCode: 0, stdout: 'active\n' },
        { exitCode: 0 },
        { exitCode: 0 },
      ]),
      bunExecutable: '/opt/bun',
    });

    await expect(adapter.status()).resolves.toMatchObject({
      schemaVersion: 1,
      platform: 'linux',
      architecture: 'x64',
      libc: 'glibc',
      manager: 'systemd-user',
      state: 'healthy',
    });
    await adapter.uninstall();

    expect(existsSync(paths.unitPath)).toBe(false);
    expect(readFileSync(join(paths.systemdUserDir, 'user-owned.service'), 'utf8')).toBe('keep\n');
    expect(readFileSync(join(home, 'workspaces', 'user-workspace', 'note.md'), 'utf8')).toBe('keep\n');
  });

  it('disables systemd and stops fallback state during mixed-manager uninstall', async () => {
    const paths = resolveLinuxPlatformPaths(home, environment);
    mkdirSync(paths.systemdUserDir, { recursive: true });
    mkdirSync(paths.runsDir, { recursive: true });
    writeFileSync(paths.unitPath, 'owned unit\n');
    writeFileSync(paths.sessionStatePath, `${JSON.stringify({ pid: 4242 })}\n`);
    const adapter = createLinuxPlatformAdapter({
      home,
      environment,
      host: { platform: 'linux', architecture: 'x64', libc: 'glibc' },
      run: runner([
        { exitCode: 0 },
        { exitCode: 0 },
        { exitCode: 0 },
      ]),
      bunExecutable: '/opt/bun',
      isProcessAlive: () => false,
    });

    await adapter.uninstall();

    expect(commands.map(({ executable, args }) => [executable, args])).toEqual([
      ['systemctl', ['--user', 'show-environment']],
      ['systemctl', ['--user', 'disable', '--now', 'consuelo-os.service']],
      ['systemctl', ['--user', 'daemon-reload']],
    ]);
    expect(existsSync(paths.unitPath)).toBe(false);
    expect(existsSync(paths.sessionStatePath)).toBe(false);
  });
});
