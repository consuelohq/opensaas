import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runtimeLinkTypeForPlatform } from '../scripts/lib/lifecycle/runtime-links';
import {
  runtimeBundleIdFromDirectoryName,
  runtimeReleaseDirectoryName,
} from '../scripts/lib/lifecycle/runtime-release-path';
import {
  assertSupportedWindowsHost,
  createWindowsServiceController,
  resolveWindowsPlatformPaths,
  type WindowsPlatformFileSystem,
  type WindowsProcessResult,
} from '../scripts/lib/windows-platform';

const osRoot = resolve(import.meta.dirname, '..');

function createMemoryFileSystem(
  existing: string[] = [],
): WindowsPlatformFileSystem & {
  directories: string[];
  files: Map<string, string>;
  removed: string[];
} {
  const paths = new Set(existing);
  const directories: string[] = [];
  const files = new Map<string, string>();
  const removed: string[] = [];
  return {
    directories,
    files,
    removed,
    exists(path) {
      return paths.has(path) || files.has(path);
    },
    mkdir(path) {
      directories.push(path);
      paths.add(path);
    },
    writeFile(path, contents) {
      files.set(path, contents);
      paths.add(path);
    },
    remove(path) {
      removed.push(path);
      files.delete(path);
      paths.delete(path);
    },
  };
}

describe('Windows platform preflight and paths', () => {
  it('supports current x64 Windows client/server builds and rejects unsupported hosts', () => {
    expect(() =>
      assertSupportedWindowsHost({
        architecture: 'x64',
        build: 26100,
        platform: 'win32',
        productName: 'Windows Server 2025',
      }),
    ).not.toThrow();

    expect(() =>
      assertSupportedWindowsHost({
        architecture: 'arm64',
        build: 26100,
        platform: 'win32',
        productName: 'Windows 11',
      }),
    ).toThrow(/x64/i);
    expect(() =>
      assertSupportedWindowsHost({
        architecture: 'x64',
        build: 17763,
        platform: 'win32',
        productName: 'Windows Server 2019',
      }),
    ).toThrow(/unsupported Windows build 17763/i);
    expect(() =>
      assertSupportedWindowsHost({
        architecture: 'x64',
        build: 26100,
        platform: 'linux',
        productName: 'Linux',
      }),
    ).toThrow(/requires native Windows/i);
  });

  it('maps the logical Consuelo home onto arbitrary Windows user profiles with spaces', () => {
    const paths = resolveWindowsPlatformPaths({
      userProfile: 'D:\\Profiles\\Ko User',
    });

    expect(paths.home).toBe('D:\\Profiles\\Ko User\\.consuelo');
    expect(paths.runtimeCurrent).toBe(
      'D:\\Profiles\\Ko User\\.consuelo\\runtime\\current',
    );
    expect(paths.serviceConfig).toBe(
      'D:\\Profiles\\Ko User\\.consuelo\\node\\service\\windows-service.json',
    );
    expect(paths.logs).toBe('D:\\Profiles\\Ko User\\.consuelo\\node\\logs');
  });

  it('uses directory junctions for Windows activation without changing POSIX links', () => {
    expect(runtimeLinkTypeForPlatform('win32')).toBe('junction');
    expect(runtimeLinkTypeForPlatform('darwin')).toBe('dir');
    expect(runtimeLinkTypeForPlatform('linux')).toBe('dir');
  });

  it('maps digest identities to PATH-safe release directories on every platform without changing bundle identity', () => {
    const bundleId = `sha256:${'a'.repeat(64)}`;
    const directoryName = `sha256-${'a'.repeat(64)}`;

    expect(runtimeReleaseDirectoryName(bundleId, 'win32')).toBe(directoryName);
    expect(runtimeReleaseDirectoryName(bundleId, 'darwin')).toBe(directoryName);
    expect(runtimeReleaseDirectoryName(bundleId, 'linux')).toBe(directoryName);
    expect(runtimeBundleIdFromDirectoryName(directoryName, 'win32')).toBe(
      bundleId,
    );
    expect(runtimeBundleIdFromDirectoryName(directoryName, 'darwin')).toBe(
      bundleId,
    );
    expect(runtimeBundleIdFromDirectoryName(directoryName, 'linux')).toBe(
      bundleId,
    );
    expect(runtimeBundleIdFromDirectoryName(bundleId, 'darwin')).toBe(bundleId);
    expect(runtimeBundleIdFromDirectoryName(bundleId, 'linux')).toBe(bundleId);
  });
});

describe('Windows Service Control Manager adapter', () => {
  const host = {
    architecture: 'x64' as const,
    build: 26100,
    platform: 'win32' as const,
    productName: 'Windows Server 2025',
  };
  const home = 'D:\\Profiles\\Ko User\\.consuelo';
  const bunExecutable = `${home}\\bin\\bun.exe`;
  const serviceHostExecutable = `${home}\\bin\\Consuelo.Windows.Service.exe`;

  it('fails unsupported hosts before any filesystem or service mutation', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host: { ...host, architecture: 'arm64' },
      isElevated: true,
      run: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      serviceHostExecutable,
    });

    await expect(controller.install()).rejects.toThrow(/x64/i);
    expect(calls).toEqual([]);
    expect(fileSystem.directories).toEqual([]);
    expect(fileSystem.files.size).toBe(0);
  });

  it('persists an absolute Bun path, registers an automatic restricted service, and applies user-only ACLs', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const run = async (
      command: string,
      args: string[],
    ): Promise<WindowsProcessResult> => {
      calls.push({ command, args });
      if (command === 'sc.exe' && args[0] === 'query') {
        return {
          exitCode: 0,
          stdout: 'STATE              : 4  RUNNING',
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: true,
      run,
      serviceHostExecutable,
    });

    await controller.install();

    const config = JSON.parse(
      fileSystem.files.get(`${home}\\node\\service\\windows-service.json`) ??
        '{}',
    ) as Record<string, unknown>;
    expect(config).toMatchObject({
      schemaVersion: 1,
      bunExecutable,
      consueloHome: home,
      runtimeCurrent: `${home}\\runtime\\current`,
      entrypoint: 'scripts/server/main.ts',
    });
    expect(JSON.stringify(config)).not.toMatch(
      /token|secret|password|credential/i,
    );

    const rendered = calls
      .map(({ command, args }) => `${command} ${args.join(' ')}`)
      .join('\n');
    expect(rendered).toContain('sc.exe create ConsueloOS');
    expect(rendered).toContain('start= auto');
    expect(rendered).toContain('obj= NT SERVICE\\ConsueloOS');
    expect(rendered).not.toContain('NT AUTHORITY\\LocalService');
    expect(rendered).toContain('sc.exe sidtype ConsueloOS restricted');
    expect(rendered).toContain('sc.exe failure ConsueloOS');
    expect(rendered).toContain('sc.exe sdset ConsueloOS');
    expect(rendered).toContain('icacls.exe');
    expect(rendered).toContain('*S-1-5-21-1000:(OI)(CI)F');
    expect(rendered).toContain('*S-1-5-18:(OI)(CI)F');
    expect(rendered).toContain('NT SERVICE\\ConsueloOS:(OI)(CI)M');
    const homeAcl = rendered.indexOf(
      `icacls.exe ${home} /inheritance:r /grant:r *S-1-5-21-1000:(OI)(CI)F *S-1-5-18:(OI)(CI)F NT SERVICE\\ConsueloOS:(OI)(CI)M`,
    );
    const descendantInheritance = rendered.indexOf(
      `icacls.exe ${home}\\* /inheritance:e /t /c`,
    );
    expect(homeAcl).toBeGreaterThan(-1);
    expect(descendantInheritance).toBeGreaterThan(homeAcl);
    expect(rendered).not.toContain(
      `icacls.exe ${home} /inheritance:r /grant:r *S-1-5-21-1000:(OI)(CI)F *S-1-5-18:(OI)(CI)F NT SERVICE\\ConsueloOS:(OI)(CI)M /t`,
    );
    const traversalAcl = rendered.indexOf(
      'icacls.exe D:\\Profiles\\Ko User /grant:r NT SERVICE\\ConsueloOS:(X) /c',
    );
    const parentTraversalAcl = rendered.indexOf(
      'icacls.exe D:\\Profiles /grant:r NT SERVICE\\ConsueloOS:(X) /c',
    );
    const serviceStart = rendered.indexOf('sc.exe start ConsueloOS');
    expect(traversalAcl).toBeGreaterThan(-1);
    expect(parentTraversalAcl).toBeGreaterThan(-1);
    expect(traversalAcl).toBeLessThan(serviceStart);
    expect(parentTraversalAcl).toBeLessThan(serviceStart);
    expect(rendered).not.toContain(
      'icacls.exe D:\\ /grant:r NT SERVICE\\ConsueloOS:(X)',
    );
    expect(rendered).not.toMatch(/token|secret|password|credential/i);
  });

  it('requires elevation only for registration/removal and reports actionable guidance', async () => {
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: false,
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
      serviceHostExecutable,
    });

    await expect(controller.install()).rejects.toThrow(
      /Run PowerShell as Administrator/i,
    );
    await expect(controller.preflight()).resolves.toBeUndefined();
  });

  it('resolves and validates the interactive Windows SID only when installation needs it', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      fileSystem,
      home,
      host,
      isElevated: true,
      run: async (command, args) => {
        calls.push({ command, args });
        if (
          command === 'powershell.exe' &&
          args.at(-1)?.includes('WindowsIdentity')
        ) {
          return {
            exitCode: 0,
            stdout: 'S-1-5-21-4242\n',
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      serviceHostExecutable,
    });

    await controller.install({ start: false });

    const rendered = calls
      .map(({ command, args }) => `${command} ${args.join(' ')}`)
      .join('\n');
    expect(rendered).toContain(
      '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    );
    expect(rendered).toContain('S-1-5-21-4242');
    expect(rendered).not.toContain('S-1-0-0');
    expect(rendered).not.toContain('undefined');
  });

  it('collects bounded SCM, ACL, and event diagnostics when service startup fails', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: true,
      run: async (command, args) => {
        calls.push({ command, args });
        if (command === 'sc.exe' && args[0] === 'start') {
          return {
            exitCode: 5,
            stdout: '',
            stderr: '[SC] StartService FAILED 5: Access is denied.',
          };
        }
        if (command === 'sc.exe' && args[0] === 'qc') {
          return {
            exitCode: 0,
            stdout: 'SERVICE_START_NAME : NT SERVICE\\ConsueloOS',
            stderr: '',
          };
        }
        if (command === 'powershell.exe') {
          return {
            exitCode: 0,
            stdout: '[{"Id":7000,"Message":"Access denied"}]',
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: 'diagnostic-ok', stderr: '' };
      },
      serviceHostExecutable,
    });

    await expect(controller.install()).rejects.toThrow(
      /Windows service startup diagnostics/i,
    );
    const rendered = calls
      .map(({ command, args }) => `${command} ${args.join(' ')}`)
      .join('\n');
    expect(rendered).toContain('sc.exe qc ConsueloOS');
    expect(rendered).toContain('sc.exe sdshow ConsueloOS');
    expect(rendered).toContain('sc.exe qsidtype ConsueloOS');
    expect(rendered).toContain(`icacls.exe ${serviceHostExecutable}`);
    expect(rendered).toContain(`icacls.exe ${bunExecutable}`);
    expect(rendered).toContain(
      `icacls.exe ${home}\\node\\service\\windows-service.json`,
    );
    expect(rendered).toContain(`icacls.exe ${home}\\runtime\\current`);
    expect(rendered).toContain(
      'powershell.exe -NoProfile -NonInteractive -Command',
    );
    expect(rendered).toContain('Get-WinEvent');
    expect(rendered).toContain('Service Control Manager');
  });

  it('rejects a service Bun executable outside the protected Consuelo home', async () => {
    const externalBun = 'D:\\Profiles\\Ko User\\.bun\\bin\\bun.exe';
    const calls: Array<{ command: string; args: string[] }> = [];
    const fileSystem = createMemoryFileSystem([
      externalBun,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable: externalBun,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: true,
      run: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      serviceHostExecutable,
    });

    await expect(controller.install()).rejects.toThrow(
      /Bun executable must be inside the protected Consuelo home/i,
    );
    expect(calls).toEqual([]);
  });

  it('supports bounded restart, status, diagnostics, dry-run uninstall, and idempotent removal', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    let stopPollsRemaining = 0;
    let serviceState: 'running' | 'stopped' = 'running';
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: true,
      pollIntervalMs: 0,
      run: async (command, args) => {
        calls.push({ command, args });
        if (command === 'sc.exe' && args[0] === 'stop') {
          stopPollsRemaining = 2;
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (command === 'sc.exe' && args[0] === 'start') {
          serviceState = 'running';
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (command === 'sc.exe' && args[0] === 'query') {
          if (stopPollsRemaining > 1) {
            stopPollsRemaining -= 1;
            return {
              exitCode: 0,
              stdout: 'STATE              : 3  STOP_PENDING',
              stderr: '',
            };
          }
          if (stopPollsRemaining === 1) {
            stopPollsRemaining = 0;
            serviceState = 'stopped';
            return {
              exitCode: 0,
              stdout: 'STATE              : 1  STOPPED',
              stderr: '',
            };
          }
          return {
            exitCode: 0,
            stdout:
              serviceState === 'running'
                ? 'STATE              : 4  RUNNING'
                : 'STATE              : 1  STOPPED',
            stderr: '',
          };
        }
        if (command === 'sc.exe' && args[0] === 'delete') {
          return {
            exitCode: 1060,
            stdout: '',
            stderr: 'service does not exist',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      serviceHostExecutable,
    });

    await controller.restart({ waitForCompletion: true });
    await expect(controller.status()).resolves.toMatchObject({
      state: 'running',
    });
    await expect(controller.diagnostics()).resolves.toMatchObject({
      bunExecutable,
      serviceHostExecutable,
      serviceName: 'ConsueloOS',
    });
    const beforeDryRun = calls.length;
    await controller.uninstall({ dryRun: true, home });
    expect(calls).toHaveLength(beforeDryRun);
    expect(fileSystem.removed).toEqual([]);
    await expect(controller.uninstall({ home })).resolves.toBeUndefined();
    const uninstallRendered = calls
      .map(({ command, args }) => `${command} ${args.join(' ')}`)
      .join('\n');
    const homeAclCleanup = uninstallRendered.indexOf(
      `icacls.exe ${home} /remove:g NT SERVICE\\ConsueloOS /t /c`,
    );
    const traversalAclCleanup = uninstallRendered.indexOf(
      'icacls.exe D:\\Profiles\\Ko User /remove:g NT SERVICE\\ConsueloOS /c',
    );
    const serviceDelete = uninstallRendered.indexOf('sc.exe delete ConsueloOS');
    expect(homeAclCleanup).toBeGreaterThan(-1);
    expect(traversalAclCleanup).toBeGreaterThan(-1);
    expect(homeAclCleanup).toBeLessThan(serviceDelete);
    expect(traversalAclCleanup).toBeLessThan(serviceDelete);
    expect(fileSystem.removed).toEqual([
      `${home}\\node\\service\\windows-service.json`,
      serviceHostExecutable,
      bunExecutable,
    ]);
  });

  it('waits for a requested service stop before ACL and binary cleanup', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    let queryCount = 0;
    const fileSystem = createMemoryFileSystem([
      bunExecutable,
      serviceHostExecutable,
    ]);
    const controller = createWindowsServiceController({
      bunExecutable,
      currentUserSid: 'S-1-5-21-1000',
      fileSystem,
      home,
      host,
      isElevated: true,
      pollIntervalMs: 0,
      run: async (command, args) => {
        calls.push({ command, args });
        if (command === 'sc.exe' && args[0] === 'query') {
          queryCount += 1;
          return queryCount === 1
            ? {
                exitCode: 0,
                stdout: 'STATE              : 3  STOP_PENDING',
                stderr: '',
              }
            : {
                exitCode: 0,
                stdout: 'STATE              : 1  STOPPED',
                stderr: '',
              };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      serviceHostExecutable,
    });

    await controller.uninstall({ home });

    const rendered = calls.map(
      ({ command, args }) => `${command} ${args.join(' ')}`,
    );
    const stopIndex = rendered.indexOf('sc.exe stop ConsueloOS');
    const firstQuery = rendered.indexOf('sc.exe query ConsueloOS');
    const lastQuery = rendered.lastIndexOf('sc.exe query ConsueloOS');
    const aclCleanup = rendered.findIndex((line) =>
      line.startsWith(`icacls.exe ${home} /remove:g`),
    );
    expect(stopIndex).toBeGreaterThan(-1);
    expect(firstQuery).toBeGreaterThan(stopIndex);
    expect(lastQuery).toBeGreaterThan(firstQuery);
    expect(aclCleanup).toBeGreaterThan(lastQuery);
  });
});

describe('Windows native service and workflow source contracts', () => {
  it('composes Linux and Windows through the shared lifecycle service boundary', () => {
    const lifecycle = readFileSync(
      resolve(osRoot, 'scripts', 'lifecycle.ts'),
      'utf8',
    );

    expect(lifecycle).toContain('createLinuxPlatformAdapter');
    expect(lifecycle).toContain('createWindowsServiceController');
    expect(lifecycle).toContain("platform === 'linux'");
    expect(lifecycle).toContain("platform === 'win32'");
    expect(lifecycle).toContain('createDefaultLifecycleServiceController');
    expect(lifecycle).not.toContain("|| 'S-1-0-0'");
  });

  it('ships a non-interactive SCM service host that owns the Bun process tree', () => {
    const service = readFileSync(
      resolve(osRoot, 'native', 'windows-service', 'Program.cs'),
      'utf8',
    );

    expect(service).toContain('ServiceBase');
    expect(service).toContain('JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE');
    expect(service).toContain('UseShellExecute = false');
    expect(service).toContain('CreateNoWindow = true');
    expect(service).toContain('CONSUELO_HOME');
    expect(service).toContain(
      'var homeParent = Directory.GetParent(settings.ConsueloHome);',
    );
    expect(service).toContain('if (homeParent == null)');
    expect(service).toContain('try { child.Kill(); }');
    expect(service).toContain('child.CancelOutputRead()');
    expect(service).toContain('child.CancelErrorRead()');
    expect(service).toContain('private readonly object logLock');
    expect(service).toContain('WriteLine(false, eventArgs.Data)');
    expect(service).toContain('WriteLine(true, eventArgs.Data)');
    expect(service).not.toMatch(/token|secret|password|credential/i);
  });

  it('provides predictable Debug and Release x64 service build outputs', () => {
    const project = readFileSync(
      resolve(
        osRoot,
        'native',
        'windows-service',
        'Consuelo.Windows.Service.csproj',
      ),
      'utf8',
    );

    expect(project).toContain("'Debug|x64'");
    expect(project).toContain('<OutputPath>bin\\Debug\\</OutputPath>');
    expect(project).toContain('<DebugType>full</DebugType>');
    expect(project).toContain("'Release|x64'");
  });

  it('runs the native Windows acceptance lane on windows-2025', () => {
    const workflow = readFileSync(
      resolve(
        osRoot,
        '..',
        '..',
        '.github',
        'workflows',
        'consuelo-os-distribution-environments.yaml',
      ),
      'utf8',
    );

    expect(workflow).toContain('runner: windows-2025');
    expect(workflow).toContain('debian-linux-platform:');
    expect(workflow).toContain('tests/linux-platform.test.ts');
    expect(workflow).toContain('Build the Windows service host');
    expect(workflow).toContain('vswhere.exe');
    expect(workflow).toContain('Microsoft.Component.MSBuild');
    expect(workflow).toContain('Run native Windows platform acceptance');
    expect(workflow).toContain(
      'scripts/testing/windows-platform-acceptance.ps1',
    );
    const nativeAcceptance = workflow.indexOf(
      'Run native Windows platform acceptance',
    );
    const cleanup = workflow.indexOf(
      'Remove Windows service build intermediates',
    );
    const distributionContracts = workflow.indexOf(
      'Run distribution harness contracts',
    );
    expect(cleanup).toBeGreaterThan(nativeAcceptance);
    expect(cleanup).toBeLessThan(distributionContracts);
    expect(workflow).toContain(
      'bun x vitest run tests/distribution --testTimeout 15000',
    );
    expect(workflow).toContain('packages/os/native/windows-service/bin');
    expect(workflow).toContain('packages/os/native/windows-service/obj');
  });

  it('keeps Windows heartbeats inside the SCM-managed runtime', () => {
    const installState = readFileSync(
      resolve(osRoot, 'scripts', 'lib', 'install-state.ts'),
      'utf8',
    );
    const serverMain = readFileSync(
      resolve(osRoot, 'scripts', 'server', 'main.ts'),
      'utf8',
    );

    expect(installState).toContain("else if (input.platform === 'darwin')");
    expect(serverMain).toContain("process.platform === 'win32'");
    expect(serverMain).toContain('startWorkspaceNodeHeartbeatScheduler');
    expect(serverMain).toContain('workspace-node-heartbeat.json');
  });
});
