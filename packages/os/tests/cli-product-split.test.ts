import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runLifecycleCli } from '../scripts/lifecycle';
import type {
  LifecycleEngine,
  LifecycleOperationResult,
} from '../scripts/lib/lifecycle';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const osRoot = resolve(repoRoot, 'packages', 'os');
const dialerRoot = resolve(repoRoot, 'packages', 'cli');
const temporaryPaths: string[] = [];

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function lifecycleResult(
  operation: LifecycleOperationResult['operation'],
  detail: Record<string, unknown> = {},
): LifecycleOperationResult {
  return { operation, changed: true, detail };
}

function fakeLifecycleEngine(): LifecycleEngine {
  return {
    status: vi.fn(async () => ({
      operation: 'status',
      changed: false,
      installState: 'valid',
      preferences: { channel: 'stable', notifications: { mode: 'on' } },
    })),
    install: vi.fn(async () => lifecycleResult('install')),
    update: vi.fn(async () => lifecycleResult('update')),
    restart: vi.fn(async () => lifecycleResult('restart')),
    repair: vi.fn(async () => lifecycleResult('repair')),
    rollback: vi.fn(async () => lifecycleResult('rollback')),
    uninstall: vi.fn(async () => lifecycleResult('uninstall')),
    devReset: vi.fn(async () => lifecycleResult('reset')),
    setChannel: vi.fn(async () => lifecycleResult('channel')),
    setUpdateNotifications: vi.fn(async () => lifecycleResult('notifications')),
  };
}

function commandNames(help: string): string[] {
  return help
    .split('\n')
    .filter((line) => /^  [a-z][a-z-]*(?:\s|$)/.test(line))
    .map((line) => line.trim().split(/\s+/)[0]);
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe('Consuelo product CLI ownership', () => {
  it('assigns the OS lifecycle binary to the OS package and the preserved sales binary to the dialer package', () => {
    const rootPackage = readJson(join(repoRoot, 'package.json'));
    const osPackage = readJson(join(osRoot, 'package.json'));
    const dialerPackage = readJson(join(dialerRoot, 'package.json'));

    expect(
      (rootPackage.workspaces as { packages?: string[] }).packages,
    ).toContain('packages/os');
    expect(osPackage.name).toBe('@consuelo/os');
    expect(osPackage.bin).toEqual({ consuelo: 'scripts/lifecycle.ts' });
    expect(dialerPackage.name).toBe('@consuelo/dialer-cli');
    expect(dialerPackage.description).toMatch(/dialer|sales/i);
    expect(dialerPackage.bin).toEqual({
      'consuelo-dialer': 'bin/consuelo-dialer.js',
    });
    const navigationSupportCopy = readFileSync(
      join(
        repoRoot,
        'packages',
        'twenty-front',
        'src',
        'modules',
        'navigation',
        'constants',
        'navigation-drawer-support-menu.constants.ts',
      ),
      'utf8',
    );
    expect(navigationSupportCopy).toContain(
      "'npm install -g @consuelo/dialer-cli'",
    );
    expect(navigationSupportCopy).not.toContain(
      "'npm install -g @consuelo/cli'",
    );
    const lockfile = readFileSync(join(repoRoot, 'yarn.lock'), 'utf8');
    expect(lockfile).toContain('"@consuelo/os@workspace:packages/os":');
    expect(lockfile).toMatch(
      /"@consuelo\/os@workspace:packages\/os":[\s\S]*?effect: "npm:\^3\.21\.3"/,
    );
    expect(statSync(join(osRoot, 'scripts', 'lifecycle.ts')).mode & 0o111).not.toBe(0);
    expect(existsSync(join(dialerRoot, 'bin', 'consuelo.js'))).toBe(false);
  });

  it('keeps the OS runtime dependency graph free of dialer and GTM runtime packages', () => {
    const osPackage = readJson(join(osRoot, 'package.json'));
    const dependencies = {
      ...(osPackage.dependencies as Record<string, string> | undefined),
      ...(osPackage.optionalDependencies as Record<string, string> | undefined),
    };
    const banned = [
      '@consuelo/analytics',
      '@consuelo/coaching',
      '@consuelo/contacts',
      '@consuelo/dialer',
      '@consuelo/dialer-cli',
      'twenty-sdk',
      'twilio',
    ];

    for (const packageName of banned) {
      expect(dependencies).not.toHaveProperty(packageName);
    }

    const dialerPackage = readJson(join(dialerRoot, 'package.json'));
    expect(dialerPackage.dependencies).toMatchObject({
      '@consuelo/analytics': '*',
      '@consuelo/coaching': '*',
      '@consuelo/contacts': '*',
      '@consuelo/dialer': '*',
      'twenty-sdk': '*',
    });
  });

  it('preserves the existing sales command catalog under consuelo-dialer and removes the mixed OS group', () => {
    const result = spawnSync(
      'bun',
      [join(dialerRoot, 'src', 'index.ts'), '--help'],
      {
        cwd: repoRoot,
        env: { ...process.env, SENTRY_DSN: '' },
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Usage: consuelo-dialer');
    const preservedSalesCommands = [
      'init',
      'coach',
      'contacts',
      'calls',
      'queue',
      'kb',
      'files',
      'history',
      'config',
      'deploy',
      'dev',
      'migrate',
      'status',
      'analytics',
    ];
    const commands = commandNames(result.stdout);
    expect(
      commands.filter((command) => preservedSalesCommands.includes(command)),
    ).toEqual(preservedSalesCommands);
    expect(result.stdout).not.toMatch(/^  os\s/m);

    const entrySource = readFileSync(join(dialerRoot, 'src', 'index.ts'), 'utf8');
    expect(entrySource).toContain("const { ConfigService } = await import('twenty-sdk/cli')");
    expect(entrySource).toContain("const { registerCommands } = await import('twenty-sdk/cli')");
    expect(entrySource).toContain('registerCommands(program)');

    const knowledgeBaseSource = readFileSync(
      join(dialerRoot, 'src', 'commands', 'kb.ts'),
      'utf8',
    );
    expect(knowledgeBaseSource).toContain('consuelo-dialer files upload <path>');
  });

  it('removes the old mixed OS registration and stale product command/package references', () => {
    expect(existsSync(join(dialerRoot, 'src', 'commands', 'os.ts'))).toBe(false);

    const dialerSources = listFiles(join(dialerRoot, 'src'))
      .filter((path) => /\.(ts|tsx|js)$/.test(path))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(dialerSources).not.toMatch(/registerOs|commands\/os|@consuelo\/cli/);
    expect(dialerSources).not.toMatch(
      /(?:`|'|")consuelo (?:init|status|call|analytics|coach|files|contacts|kb|auth:login|--version)/,
    );

    const operationalRoots = [
      join(repoRoot, 'packages', 'cli'),
      join(repoRoot, 'packages', 'os', 'scripts'),
      join(repoRoot, 'packages', 'os', 'tests'),
      join(repoRoot, 'packages', 'documentation'),
    ].filter(existsSync);
    const oldPathReferences = operationalRoots.flatMap((root) =>
      listFiles(root)
        .filter((path) => /\.(ts|tsx|js|json|md|yml|yaml|sh)$/.test(path))
        .filter((path) => path !== import.meta.filename)
        .filter((path) => /\bconsuelo os (?:status|install|restart|update|channel|repair|rollback|node|uninstall|dev|updates)\b/.test(readFileSync(path, 'utf8'))),
    );
    expect(oldPathReferences).toEqual([]);
  });
});

describe('Consuelo Dialer config and telemetry boundary', () => {
  it('migrates legacy global and project config into a dialer-owned namespace without deleting the originals', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-dialer-home-'));
    const cwd = mkdtempSync(join(tmpdir(), 'consuelo-dialer-project-'));
    temporaryPaths.push(home, cwd);
    mkdirSync(join(home, '.consuelo'), { recursive: true });
    const legacyGlobal = join(home, '.consuelo', 'config.json');
    const legacyProject = join(cwd, 'consuelo.config.json');
    writeFileSync(legacyGlobal, JSON.stringify({ twilioAccountSid: 'AC123', managed: true }));
    writeFileSync(legacyProject, JSON.stringify({ version: '1', server: { port: 4100, host: '127.0.0.1' } }));

    const configModule = await import('../../cli/src/config');
    expect(configModule.resolveDialerConfigPaths).toBeTypeOf('function');
    const paths = configModule.resolveDialerConfigPaths({ home, cwd });

    expect(paths.global).toBe(join(home, '.consuelo', 'dialer', 'config.json'));
    expect(paths.project).toBe(join(cwd, 'consuelo-dialer.config.json'));
    expect(configModule.loadConfig({ home, cwd })).toMatchObject({
      twilioAccountSid: 'AC123',
      managed: true,
    });
    expect(configModule.loadFullConfig('project', { home, cwd })).toMatchObject({
      version: '1',
      server: { port: 4100, host: '127.0.0.1' },
    });
    expect(readJson(paths.global)).toMatchObject({ twilioAccountSid: 'AC123' });
    expect(readJson(paths.project)).toMatchObject({ version: '1' });
    expect(existsSync(legacyGlobal)).toBe(true);
    expect(existsSync(legacyProject)).toBe(true);
    expect(paths.global).not.toBe(join(home, '.consuelo', 'consuelo.yaml'));
  });

  it('uses dialer-specific output globals and keeps telemetry redaction inside the dialer package', () => {
    const outputSource = readFileSync(join(dialerRoot, 'src', 'output.ts'), 'utf8');
    const entrySource = readFileSync(join(dialerRoot, 'src', 'index.ts'), 'utf8');
    const sentrySource = readFileSync(join(dialerRoot, 'src', 'sentry.ts'), 'utf8');
    const loggerSource = readFileSync(join(repoRoot, 'packages', 'logger', 'src', 'index.ts'), 'utf8');

    expect(`${outputSource}\n${entrySource}`).toContain('__consuelo_dialer_json');
    expect(`${outputSource}\n${entrySource}`).toContain('__consuelo_dialer_quiet');
    expect(`${outputSource}\n${entrySource}`).not.toMatch(/__consuelo_(?:json|quiet|cli_mode)\b/);
    expect(loggerSource).toContain('__consuelo_dialer_cli_mode');
    expect(loggerSource).not.toContain('__consuelo_cli_mode');
    expect(sentrySource).toContain("process.argv.includes('--no-telemetry')");
    expect(sentrySource).toMatch(/twilioAuthToken|llmApiKey|apiKey|token|password/);
    expect(readFileSync(join(osRoot, 'scripts', 'lifecycle.ts'), 'utf8')).not.toMatch(/@sentry|twilio|twenty-sdk/i);
  });

  it('treats concurrent completion of legacy config migration as success', async () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-dialer-migration-race-'));
    temporaryPaths.push(root);
    const legacySource = join(root, 'legacy.json');
    const destination = join(root, 'dialer', 'config.json');
    writeFileSync(legacySource, JSON.stringify({ twilioAccountSid: 'AC-race' }));

    const configModule = await import('../../cli/src/config');
    expect(configModule.migrateLegacyConfig).toBeTypeOf('function');

    const competingCopy = ((source: string, target: string) => {
      mkdirSync(join(root, 'dialer'), { recursive: true });
      writeFileSync(target, readFileSync(source));
      throw Object.assign(new Error('destination exists'), { code: 'EEXIST' });
    }) as typeof import('node:fs').copyFileSync;

    expect(() => configModule.migrateLegacyConfig(
      destination,
      legacySource,
      competingCopy,
    )).not.toThrow();
    expect(readJson(destination)).toEqual({ twilioAccountSid: 'AC-race' });

    const diskFailure = Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    expect(() => configModule.migrateLegacyConfig(
      join(root, 'other', 'config.json'),
      legacySource,
      (() => { throw diskFailure; }) as typeof import('node:fs').copyFileSync,
    )).toThrow(diskFailure);
  });
});

describe('Consuelo OS lifecycle CLI surface', () => {
  it('exposes the final OS command surface from the package binary help', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(['--help'], {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    const help = stdout.join('');
    for (const command of [
      'install',
      'status',
      'restart',
      'update',
      'channel',
      'repair',
      'rollback',
      'node',
      'uninstall',
      'dev reset',
    ]) {
      expect(help).toContain(`consuelo ${command}`);
    }
    expect(help).not.toContain('consuelo os');
  });

  it('delegates restart to Worker 04 and preserves structured success and typed failures', async () => {
    const healthy = fakeLifecycleEngine();
    const stdout: string[] = [];
    const stderr: string[] = [];

    expect(await runLifecycleCli(['restart', '--json'], {
      engine: healthy,
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    })).toBe(0);
    expect(healthy.restart).toHaveBeenCalledOnce();
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      command: 'restart',
      ok: true,
      result: { operation: 'restart' },
    });
    expect(stderr).toEqual([]);

    for (const message of [
      'service is stopped',
      'launchctl failed',
      'Consuelo OS did not become healthy after reload',
    ]) {
      const failed = fakeLifecycleEngine();
      failed.restart = vi.fn(async () => { throw new Error(message); });
      const failure: string[] = [];
      expect(await runLifecycleCli(['restart', '--json'], {
        engine: failed,
        stdout: () => {},
        stderr: (value) => failure.push(value),
      })).toBe(1);
      expect(JSON.parse(failure.join(''))).toMatchObject({
        schemaVersion: 1,
        command: 'restart',
        ok: false,
        error: { message },
      });
    }
  });

  it('reads safe node metadata from the typed node store without routing through a sales config loader', async () => {
    const engine = fakeLifecycleEngine();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const nodeStatus = vi.fn(async () => ({
      operation: 'node' as const,
      changed: false,
      detail: {
        id: 'node_home',
        name: 'Home Mac',
        role: 'home',
        active: true,
        capabilities: ['darwin', 'local-runtime'],
        workspaces: [{ id: 'workspace_internal' }],
      },
    }));

    expect(await runLifecycleCli(['node', '--json'], {
      engine,
      nodeStatus,
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    })).toBe(0);
    expect(nodeStatus).toHaveBeenCalledOnce();
    expect(engine.status).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(''))).toEqual({
      schemaVersion: 1,
      command: 'node',
      ok: true,
      result: {
        operation: 'node',
        changed: false,
        detail: {
          id: 'node_home',
          name: 'Home Mac',
          role: 'home',
          active: true,
          capabilities: ['darwin', 'local-runtime'],
          workspaces: [{ id: 'workspace_internal' }],
        },
      },
    });
    expect(JSON.stringify(stdout)).not.toMatch(/token|secret|credential|privateKey/i);
    expect(stderr).toEqual([]);
  });
});
