import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { materializeLifecycleCommand } from '../scripts/lib/install-state';

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-lifecycle-command-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function resolveBunExecutable(): string {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const output = execFileSync(locator, ['bun'], { encoding: 'utf8' }).trim();
  const executable = output.split(/\r?\n/, 1)[0]?.trim();
  if (!executable) throw new Error('Bun executable was not found on PATH');
  return executable;
}

function writeFakeBun(): string {
  const fakeBun = join(home, 'managed-bun');
  writeFileSync(
    fakeBun,
    '#!/bin/bash\nprintf \'%s\\n\' "$@"\n',
    { mode: 0o755 },
  );
  writeFileSync(join(home, '.env'), `BUN_BIN=${fakeBun}\n`, { mode: 0o600 });
  return fakeBun;
}

function writeLifecycle(root: string): string {
  const script = join(root, 'scripts', 'lifecycle.ts');
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(script, '// lifecycle fixture\n');
  return script;
}

describe('lifecycle command materialization', () => {
  it('uses the exact verified recovery runtime before runtime/current exists', () => {
    writeFakeBun();
    const recoveryRoot = join(
      home,
      'runtime',
      'releases',
      "verified release's recovery copy",
    );
    const recoveryScript = writeLifecycle(recoveryRoot);

    const actions = materializeLifecycleCommand(home, false, {
      recoveryPackageRoot: recoveryRoot,
    });
    const command = join(home, 'bin', 'consuelo');

    expect(actions).toEqual([
      expect.objectContaining({
        path: command,
        status: 'created',
        message: 'OS lifecycle command installed',
      }),
    ]);
    expect(statSync(command).mode & 0o777).toBe(0o755);

    const invocation = execFileSync(command, ['status', '--json'], {
      encoding: 'utf8',
      env: {
        CONSUELO_HOME: home,
        PATH: '/usr/bin:/bin',
      },
    });

    expect(invocation.trim().split('\n')).toEqual([
      recoveryScript,
      'status',
      '--home',
      home,
      '--json',
    ]);
  });

  it('materializes the recovery command through the private installer entrypoint used by bootstrap', () => {
    const bunExecutable = resolveBunExecutable();
    writeFileSync(join(home, '.env'), `BUN_BIN=${bunExecutable}\n`, { mode: 0o600 });
    const recoveryRoot = resolve(import.meta.dirname, '..');

    execFileSync(
      bunExecutable,
      [
        'scripts/install.ts',
        '--materialize-lifecycle-command',
        '--home',
        home,
        '--recovery-package-root',
        recoveryRoot,
      ],
      { cwd: recoveryRoot, encoding: 'utf8' },
    );

    const command = join(home, 'bin', 'consuelo');
    expect(statSync(command).mode & 0o777).toBe(0o755);
    const status = JSON.parse(execFileSync(command, ['status', '--json'], {
      encoding: 'utf8',
      env: { CONSUELO_HOME: home, PATH: '/usr/bin:/bin' },
    }));
    expect(status).toMatchObject({
      command: 'status',
      ok: true,
      result: { installState: 'no-install' },
    });
  });

  it('runs real status and uninstall dry-run from the recovery runtime before onboarding', () => {
    const bunExecutable = resolveBunExecutable();
    writeFileSync(join(home, '.env'), `BUN_BIN=${bunExecutable}\n`, { mode: 0o600 });
    const recoveryRoot = resolve(import.meta.dirname, '..');
    materializeLifecycleCommand(home, false, {
      recoveryPackageRoot: recoveryRoot,
    });
    const command = join(home, 'bin', 'consuelo');

    const status = JSON.parse(execFileSync(command, ['status', '--json'], {
      encoding: 'utf8',
      env: { CONSUELO_HOME: home, PATH: '/usr/bin:/bin' },
    }));
    expect(status).toMatchObject({
      command: 'status',
      ok: true,
      result: { installState: 'no-install' },
    });

    const uninstall = JSON.parse(execFileSync(
      command,
      ['uninstall', '--dry-run', '--json'],
      {
        encoding: 'utf8',
        env: { CONSUELO_HOME: home, PATH: '/usr/bin:/bin' },
      },
    ));
    expect(uninstall).toMatchObject({
      command: 'uninstall',
      ok: true,
      result: {
        operation: 'uninstall',
        detail: { dryRun: true },
      },
    });
  });

  it('removes the recovery release pin when normal provisioning reconciles the command', () => {
    writeFakeBun();
    const recoveryRoot = join(home, 'runtime', 'releases', 'verified-recovery');
    writeLifecycle(recoveryRoot);
    materializeLifecycleCommand(home, false, {
      recoveryPackageRoot: recoveryRoot,
    });

    const currentRoot = join(home, 'runtime', 'current');
    const currentScript = writeLifecycle(currentRoot);
    const command = join(home, 'bin', 'consuelo');

    materializeLifecycleCommand(home, false);

    const source = readFileSync(command, 'utf8');
    expect(source).not.toContain(recoveryRoot);
    const invocation = execFileSync(command, ['uninstall', '--dry-run', '--json'], {
      encoding: 'utf8',
      env: {
        CONSUELO_HOME: home,
        PATH: '/usr/bin:/bin',
      },
    });
    expect(invocation.trim().split('\n')).toEqual([
      currentScript,
      'uninstall',
      '--home',
      home,
      '--dry-run',
      '--json',
    ]);
  });
});
