import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function writeExecutable(path: string, contents: string): void {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(command, args, {
    env,
    encoding: 'utf8',
    timeout: 2_000,
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('macOS runtime service reliability', () => {
  it('should wire opt-in availability and OS-owned watchdog state when installing and uninstalling daemons', () => {
    const install = readFileSync(
      resolve(osRoot, 'scripts/install-system-daemons.sh'),
      'utf8',
    );
    const uninstall = readFileSync(
      resolve(osRoot, 'scripts/uninstall-system-daemons.sh'),
      'utf8',
    );

    expect(install).toContain('com.consuelo.availability');
    expect(install).toContain('$consuelo_data_home/node/runtime/watchdog');
    expect(install).toContain('bootstrap_agent "$availability_label"');
    expect(install).toContain('bootout_agent "$availability_label"');
    expect(install).toContain('remove_disabled_agent "$availability_label" "$availability_agent_plist"');
    expect(uninstall).toContain('remove_agent "$availability_label"');
  });

  it('should omit the host power assertion when availability is not explicitly enabled', () => {
    const fixtureRoot = temporaryDirectory('consuelo-daemon-generator-disabled-');
    const scriptsDirectory = join(fixtureRoot, 'scripts');
    const home = join(fixtureRoot, 'home');
    const consueloHome = join(home, '.consuelo');
    mkdirSync(scriptsDirectory, { recursive: true });
    mkdirSync(home, { recursive: true });
    copyFileSync(
      resolve(osRoot, 'scripts/generate-system-daemons.sh'),
      join(scriptsDirectory, 'generate-system-daemons.sh'),
    );

    const result = run('bash', [join(scriptsDirectory, 'generate-system-daemons.sh')], {
      ...process.env,
      HOME: home,
      USER: process.env.USER ?? 'nobody',
      CONSUELO_HOME: consueloHome,
      PORTLESS_ENABLED: '0',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(
      existsSync(join(consueloHome, 'node', 'security', 'generated', 'com.consuelo.availability.plist')),
    ).toBe(false);
  });

  it('should load the persisted Caddy binary when regenerating daemons from a clean shell', () => {
    const fixtureRoot = temporaryDirectory('consuelo-daemon-generator-caddy-');
    const scriptsDirectory = join(fixtureRoot, 'scripts');
    const home = join(fixtureRoot, 'home');
    const consueloHome = join(home, '.consuelo');
    const caddyBin = join(consueloHome, 'bin', 'caddy');
    mkdirSync(scriptsDirectory, { recursive: true });
    mkdirSync(join(consueloHome, 'bin'), { recursive: true });
    copyFileSync(
      resolve(osRoot, 'scripts/generate-system-daemons.sh'),
      join(scriptsDirectory, 'generate-system-daemons.sh'),
    );
    writeExecutable(caddyBin, '#!/bin/bash\nexit 0\n');
    writeFileSync(join(consueloHome, '.env'), `CADDY_BIN=${caddyBin}\n`);

    const result = run('bash', [join(scriptsDirectory, 'generate-system-daemons.sh')], {
      ...process.env,
      HOME: home,
      USER: process.env.USER ?? 'nobody',
      CONSUELO_HOME: consueloHome,
      CADDY_BIN: '',
      PORTLESS_ENABLED: '0',
    });

    expect(result.status, result.stderr).toBe(0);
    const caddyPlist = readFileSync(
      join(consueloHome, 'node', 'security', 'generated', 'com.consuelo.caddy.plist'),
      'utf8',
    );
    expect(caddyPlist).toContain('<key>CADDY_BIN</key>');
    expect(caddyPlist).toContain(`<string>${caddyBin}</string>`);
  });

  it('should generate an AC-only availability assertion and scheduled watchdog when availability is explicitly enabled', () => {
    const fixtureRoot = temporaryDirectory('consuelo-daemon-generator-');
    const scriptsDirectory = join(fixtureRoot, 'scripts');
    const home = join(fixtureRoot, 'home');
    const consueloHome = join(home, '.consuelo');
    mkdirSync(scriptsDirectory, { recursive: true });
    mkdirSync(home, { recursive: true });
    copyFileSync(
      resolve(osRoot, 'scripts/generate-system-daemons.sh'),
      join(scriptsDirectory, 'generate-system-daemons.sh'),
    );

    const result = run('bash', [join(scriptsDirectory, 'generate-system-daemons.sh')], {
      ...process.env,
      HOME: home,
      USER: process.env.USER ?? 'nobody',
      CONSUELO_HOME: consueloHome,
      CONSUELO_AVAILABILITY_ENABLED: '1',
      PORTLESS_ENABLED: '0',
    });

    expect(result.status, result.stderr).toBe(0);
    // Generated plists live outside the runtime release so they cannot break its fingerprint.
    const generatedDirectory = join(consueloHome, 'node', 'security', 'generated');
    const availability = readFileSync(
      join(generatedDirectory, 'com.consuelo.availability.plist'),
      'utf8',
    );
    const watchdog = readFileSync(
      join(generatedDirectory, 'com.consuelo.watchdog.plist'),
      'utf8',
    );

    expect(availability).toContain('<string>/usr/bin/caffeinate</string>');
    expect(availability).toContain('<string>-s</string>');
    expect(availability).toContain('<key>KeepAlive</key>');
    expect(availability).not.toContain('<string>-d</string>');
    expect(watchdog).toContain('<key>StartInterval</key>');
    expect(watchdog).toContain('<integer>30</integer>');
    expect(watchdog).not.toContain('<key>KeepAlive</key>');
    expect(watchdog).toContain('<key>CONSUELO_HOME</key>');
    expect(watchdog).toContain(`<string>${consueloHome}</string>`);
  });

  it('should persist probe failures and restart only when the failure threshold is reached', () => {
    const fixtureRoot = temporaryDirectory('consuelo-watchdog-threshold-');
    const fakeBin = join(fixtureRoot, 'bin');
    const home = join(fixtureRoot, 'home');
    const consueloHome = join(home, '.consuelo');
    const launchLog = join(fixtureRoot, 'launchctl.log');
    mkdirSync(fakeBin, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeExecutable(join(fakeBin, 'lsof'), '#!/bin/bash\nexit 1\n');
    writeExecutable(join(fakeBin, 'curl'), '#!/bin/bash\nexit 0\n');
    writeExecutable(
      join(fakeBin, 'launchctl'),
      '#!/bin/bash\nprintf "%s\\n" "$*" >> "$WATCHDOG_LAUNCH_LOG"\n',
    );
    writeExecutable(join(fakeBin, 'sleep'), '#!/bin/bash\nexit 99\n');

    const environment = {
      ...process.env,
      HOME: home,
      CONSUELO_HOME: consueloHome,
      WORKSPACE_WATCHDOG_PATH: `${fakeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
      WORKSPACE_WATCHDOG_DISABLE_EXTERNAL: '1',
      WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD: '2',
      WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS: '0',
      WATCHDOG_LAUNCH_LOG: launchLog,
    };
    const watchdog = resolve(osRoot, 'scripts/workspace-watchdog.sh');

    const first = run('bash', [watchdog], environment);
    expect(first.status, `${first.stdout}\n${first.stderr}`).toBe(0);
    const stateDirectory = join(consueloHome, 'node', 'runtime', 'watchdog');
    expect(readFileSync(join(stateDirectory, 'local-tcp-failure-count'), 'utf8').trim()).toBe('1');
    expect(existsSync(join(home, 'Library', 'Caches', 'Consuelo'))).toBe(false);
    expect(existsSync(launchLog)).toBe(false);

    const second = run('bash', [watchdog], environment);
    expect(second.status, `${second.stdout}\n${second.stderr}`).toBe(0);
    expect(readFileSync(join(stateDirectory, 'local-tcp-failure-count'), 'utf8').trim()).toBe('0');
    expect(readFileSync(launchLog, 'utf8')).toContain(
      'kickstart -k gui/',
    );
    expect(readFileSync(launchLog, 'utf8')).toContain('com.consuelo.system');
  });

  it('should open a recovery circuit when restart attempts exceed the bounded window', () => {
    const fixtureRoot = temporaryDirectory('consuelo-watchdog-circuit-');
    const fakeBin = join(fixtureRoot, 'bin');
    const home = join(fixtureRoot, 'home');
    const consueloHome = join(home, '.consuelo');
    const launchLog = join(fixtureRoot, 'launchctl.log');
    mkdirSync(fakeBin, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeExecutable(join(fakeBin, 'lsof'), '#!/bin/bash\nexit 1\n');
    writeExecutable(join(fakeBin, 'curl'), '#!/bin/bash\nexit 0\n');
    writeExecutable(
      join(fakeBin, 'launchctl'),
      '#!/bin/bash\nprintf "%s\\n" "$*" >> "$WATCHDOG_LAUNCH_LOG"\n',
    );
    writeExecutable(join(fakeBin, 'sleep'), '#!/bin/bash\nexit 99\n');

    const environment = {
      ...process.env,
      HOME: home,
      CONSUELO_HOME: consueloHome,
      WORKSPACE_WATCHDOG_PATH: `${fakeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
      WORKSPACE_WATCHDOG_DISABLE_EXTERNAL: '1',
      WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD: '1',
      WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS: '0',
      WORKSPACE_WATCHDOG_MAX_RESTARTS_PER_WINDOW: '2',
      WORKSPACE_WATCHDOG_RESTART_WINDOW_SECONDS: '600',
      WATCHDOG_LAUNCH_LOG: launchLog,
    };
    const watchdog = resolve(osRoot, 'scripts/workspace-watchdog.sh');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = run('bash', [watchdog], environment);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }

    const launches = readFileSync(launchLog, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);
    expect(launches).toHaveLength(2);
    expect(
      existsSync(
        join(
          consueloHome,
          'node',
          'runtime',
          'watchdog',
          'com.consuelo.system.degraded',
        ),
      ),
    ).toBe(true);
  });
});
