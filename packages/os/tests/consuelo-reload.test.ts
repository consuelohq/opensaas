import {
  spawnSync,
} from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const reloadScript = resolve(osRoot, 'scripts/consuelo-reload.js');
const temporaryHomes: string[] = [];

function executable(path: string, source: string): void {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function createHarness(input: { bootstrapExit?: number; launchdLoaded?: boolean } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-reload-test-'));
  temporaryHomes.push(home);
  const bin = join(home, 'bin');
  const launchAgents = join(home, 'Library', 'LaunchAgents');
  const marker = join(home, 'launchd-bootstrapped');
  const launchLog = join(home, 'launchctl.log');
  mkdirSync(bin, { recursive: true });
  mkdirSync(launchAgents, { recursive: true });
  writeFileSync(join(launchAgents, 'com.consuelo.system.plist'), '<plist/>');

  executable(join(bin, 'launchctl'), `#!/bin/sh
printf '%s\\n' "$*" >> "${launchLog}"
case "$1" in
  print) ${input.launchdLoaded ? 'exit 0' : 'exit 113'} ;;
  bootstrap)
    ${input.bootstrapExit ? `exit ${input.bootstrapExit}` : `touch "${marker}"; exit 0`}
    ;;
  kickstart) touch "${marker}"; exit 0 ;;
  bootout) exit 0 ;;
esac
exit 0
`);
  executable(join(bin, 'curl'), `#!/bin/sh
if [ -f "${marker}" ]; then
  printf '%s\\n' '{"status":"ok","name":"consuelo-os"}'
  exit 0
fi
exit 22
`);
  for (const command of ['pgrep', 'lsof']) {
    executable(join(bin, command), '#!/bin/sh\nexit 1\n');
  }
  executable(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');

  return {
    home,
    marker,
    launchLog,
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      CONSUELO_RELOAD_WAIT_ATTEMPTS: '1',
    },
  };
}

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('Consuelo OS reload lifecycle', () => {
  it('should bootstrap an installed LaunchAgent when it is currently unloaded', () => {
    const harness = createHarness();
    const result = spawnSync(process.execPath, [reloadScript, 'start'], {
      cwd: osRoot,
      env: harness.env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(existsSync(harness.marker)).toBe(true);
    expect(result.stdout).toContain('started: healthy');
  });

  it('should exit nonzero when LaunchAgent bootstrap fails', () => {
    const harness = createHarness({ bootstrapExit: 70 });
    const result = spawnSync(process.execPath, [reloadScript, 'start'], {
      cwd: osRoot,
      env: harness.env,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('launchctl bootstrap failed');
  });

  it('should kickstart a loaded LaunchAgent without booting out its own job', () => {
    const harness = createHarness({ launchdLoaded: true });
    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_OS_RELOAD_LAUNCHD: '1' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const launchCommands = readFileSync(harness.launchLog, 'utf8');
    expect(launchCommands).toContain('kickstart -k gui/');
    expect(launchCommands).not.toContain('bootout');
    expect(launchCommands).not.toContain('bootstrap');
    expect(result.stdout).toContain('reloaded: healthy');
  });

  it('should bootstrap an unloaded LaunchAgent before kickstarting a reload', () => {
    const harness = createHarness();
    const result = spawnSync(process.execPath, [reloadScript, 'restart-now'], {
      cwd: osRoot,
      env: { ...harness.env, CONSUELO_OS_RELOAD_LAUNCHD: '1' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const launchCommands = readFileSync(harness.launchLog, 'utf8');
    expect(launchCommands).toContain('print gui/');
    expect(launchCommands).toContain('bootstrap gui/');
    expect(launchCommands).toContain('kickstart -k gui/');
    expect(result.stdout).toContain('reloaded: healthy');
  });
});
