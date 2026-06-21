import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { removeSafeTempDir } from './safe-temp-cleanup';

const packageRoot = process.cwd();
const systemPath = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(delimiter);
const tempHomes: string[] = [];

function createTempHome(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  tempHomes.push(home);
  return home;
}

function runBootstrapDryRun(home: string, overrides: Record<string, string> = {}) {
  return spawnSync(
    '/bin/bash',
    [
      join(packageRoot, 'scripts', 'bootstrap.sh'),
      '--dry-run',
      '--yes',
      '--json',
      '--mode',
      'local',
      '--skip-daemons',
    ],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        CONSUELO_HOME: join(home, '.consuelo', 'os'),
        CONSUELO_OS_SOURCE_DIR: join(home, 'source'),
        CONSUELO_OS_ALLOW_GLOBAL_RUNTIME_LOOKUP: '0',
        PATH: systemPath,
        ...overrides,
      },
    },
  );
}

function parseBootstrapSummary(stdout: string) {
  return JSON.parse(stdout) as {
    bunStatus: string;
    portlessStatus: string;
    cloudflaredStatus: string;
    dependencies: {
      runtime: Record<string, { status: string; path: string | null }>;
      operator: Record<string, { classification: string }>;
    };
  };
}

function writeExecutable(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, { mode: 0o755 });
  chmodSync(filePath, 0o755);
}

function readBootstrap(): string {
  return readFileSync(join(packageRoot, 'scripts', 'bootstrap.sh'), 'utf8');
}

function extractShellFunction(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `${name}() {`);
  if (start === -1) {
    throw new Error(`missing shell function: ${name}`);
  }
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === '}') {
      return lines.slice(start, index + 1).join('\n');
    }
  }
  throw new Error(`unterminated shell function: ${name}`);
}

function parseShaWithBootstrap(checksumText: string) {
  const bootstrap = readBootstrap();
  const script = [
    extractShellFunction(bootstrap, 'is_sha256'),
    extractShellFunction(bootstrap, 'parse_sha256_token'),
    'checksum="$(parse_sha256_token "$CHECKSUM_TEXT")"',
    'is_sha256 "$checksum" || exit 41',
    'printf "%s\\n" "$checksum"',
  ].join('\n');

  return spawnSync('/bin/bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, CHECKSUM_TEXT: checksumText, PATH: systemPath },
  });
}

function installerEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.PORTLESS_BIN;
  delete env.PORTLESS_ALLOW_PATH_LOOKUP;
  delete env.PORTLESS_DAEMON_PATH;
  delete env.CONSUELO_OS_REQUIRE_PORTLESS;
  delete env.CONSUELO_OS_INSTALL_PORTLESS;
  delete env.PORTLESS_ENABLED;
  delete env.CONSUELO_DAEMON_HOME;
  delete env.CONSUELO_DAEMON_LOG_DIR;
  delete env.CONSUELO_SECURITY_GENERATED_DIR;
  delete env.CONSUELO_HOME;
  return { ...env, ...overrides };
}

function writeCloudflaredPlist(filePath: string, label: string): void {
  writeFileSync(
    filePath,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>Label</key>',
      `  <string>${label}</string>`,
      '  <key>ProgramArguments</key>',
      '  <array>',
      '    <string>/tmp/cloudflared</string>',
      '    <string>tunnel</string>',
      '    <string>run</string>',
      '  </array>',
      '</dict>',
      '</plist>',
      '',
    ].join('\n'),
  );
}

afterEach(() => {
  for (const home of tempHomes.splice(0)) {
    removeSafeTempDir(home, 'consuelo-os-installer-runtime-');
  }
});

describe('public installer runtime dependencies', () => {
  it('uses bounded retrying curl for source and runtime network fetches', () => {
    const bootstrap = readBootstrap();

    for (const flag of [
      '-fsSL',
      '--retry 3',
      '--retry-delay 1',
      '--retry-connrefused',
      '--connect-timeout 10',
      '--max-time 120',
    ]) {
      expect(bootstrap).toContain(flag);
    }
    expect(bootstrap).toContain('curl_retry "$REPO_ARCHIVE_URL" -o "$archive_file"');
    expect(bootstrap).toContain('checksum_text="$(curl_retry "$sha_url")"');
    expect(bootstrap).toContain('curl_retry "$url" -o "$tmp_file"');
    expect(bootstrap).toContain('curl_retry "$url" -o "$archive_file"');
  });

  it('parses SHA-256 metadata deterministically without shell word splitting', () => {
    const sha = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    for (const checksumText of [sha, `${sha}  portless`, `${sha} *portless`]) {
      const result = parseShaWithBootstrap(checksumText);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(sha);
    }

    for (const checksumText of ['', 'not-a-sha', `${sha.slice(0, 63)} portless`, `${sha}g portless`]) {
      const result = parseShaWithBootstrap(checksumText);
      expect(result.status).not.toBe(0);
    }

    const bootstrap = readBootstrap();
    expect(bootstrap).not.toContain('set -- $checksum_text');
  });

  it('persists portless only when available before public daemon installation', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain('persist_env_value "$env_file" BUN_BIN "$BUN_BIN"');
    expect(bootstrap).toContain('persist_env_value "$env_file" PORTLESS_ENABLED "1"');
    expect(bootstrap).toContain('remove_env_value "$env_file" PORTLESS_BIN');
    expect(bootstrap).toContain('persist_env_value "$env_file" PORTLESS_ENABLED "0"');
    expect(bootstrap).toContain('persist_env_value "$env_file" CLOUDFLARED_BIN "$CLOUDFLARED_BIN"');
    expect(bootstrap.indexOf('ensure_portless')).toBeLessThan(
      bootstrap.indexOf('persist_runtime_paths'),
    );
    expect(bootstrap.indexOf('persist_runtime_paths')).toBeLessThan(
      bootstrap.indexOf('maybe_install_daemons'),
    );
  });

  it('uses the regular local port when portless is absent on a clean dry-run PATH', () => {
    const home = createTempHome('consuelo-os-installer-runtime-bootstrap-');
    const result = runBootstrapDryRun(home);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('dry-run: Bun is missing and would be installed');
    expect(result.stderr).toContain('portless is not installed; Consuelo OS will use http://127.0.0.1:8960');
    expect(result.stderr).toContain('dry-run: cloudflared is missing and would be installed');
    expect(result.stderr).not.toMatch(/wrangler.*required/i);
    expect(result.stderr).not.toMatch(/CLOUDFLARE_(ACCOUNT_ID|API_TOKEN).*required/);

    const summary = parseBootstrapSummary(result.stdout);
    expect(summary.bunStatus).toBe('would_install');
    expect(summary.portlessStatus).toBe('optional_missing');
    expect(summary.cloudflaredStatus).toBe('would_install');
    expect(summary.dependencies.runtime.portless.status).toBe('optional_missing');
    expect(summary.dependencies.runtime.portless.path).toBeNull();
    expect(summary.dependencies.runtime.cloudflared.status).toBe('would_install');
    expect(summary.dependencies.operator.wrangler.classification).toBe('operator_only');
  });

  it('keeps portless as an optional enhancement when it is already installed', () => {
    const home = createTempHome('consuelo-os-installer-runtime-bootstrap-existing-portless-');
    const binDir = join(home, 'bin');
    const portlessBin = join(binDir, 'portless');
    mkdirSync(binDir, { recursive: true });
    writeExecutable(portlessBin, '#!/bin/sh\nexit 0\n');

    const result = runBootstrapDryRun(home, { PORTLESS_BIN: portlessBin });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('portless found: ' + portlessBin);
    const summary = parseBootstrapSummary(result.stdout);
    expect(summary.portlessStatus).toBe('present');
    expect(summary.dependencies.runtime.portless.path).toBe(portlessBin);
  });

  it('uses PORTLESS_BIN before PATH in the portless daemon launcher', () => {
    const home = createTempHome('consuelo-os-installer-runtime-portless-');
    const binDir = join(home, 'bin');
    const captureFile = join(home, 'portless-args.txt');
    const portlessBin = join(binDir, 'portless');
    mkdirSync(binDir, { recursive: true });
    writeExecutable(
      portlessBin,
      '#!/bin/sh\nprintf "%s\\n" "$0 $*" > "$PORTLESS_CAPTURE_FILE"\n',
    );

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          PORTLESS_BIN: portlessBin,
          PORTLESS_CAPTURE_FILE: captureFile,
          PATH: systemPath,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(captureFile, 'utf8')).toContain(
      `${portlessBin} proxy start --https --foreground`,
    );
  });

  it('keeps direct daemon dry-run usable with PATH portless when no env file exists', () => {
    const home = createTempHome('consuelo-os-installer-runtime-direct-daemon-');
    const binDir = join(home, 'bin');
    const portlessBin = join(binDir, 'portless');
    mkdirSync(binDir, { recursive: true });
    writeExecutable(portlessBin, '#!/bin/sh\nexit 0\n');

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'install-system-daemons.sh'), '--dry-run', '--quiet'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PORTLESS_DAEMON_PATH: [binDir, systemPath].join(delimiter),
          PATH: [binDir, systemPath].join(delimiter),
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('com.consuelo.portless.system');
    const plist = readFileSync(
      join(packageRoot, 'scripts', 'generated', 'com.consuelo.portless.system.plist'),
      'utf8',
    );
    expect(plist).toContain('<key>PORTLESS_ALLOW_PATH_LOOKUP</key>');
    expect(plist).toContain('<string>1</string>');
  });


  it('skips the optional portless LaunchAgent when portless is absent', () => {
    const home = createTempHome('consuelo-os-installer-runtime-direct-no-portless-');

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'install-system-daemons.sh'), '--dry-run', '--quiet'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PORTLESS_DAEMON_PATH: systemPath,
          PATH: systemPath,
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('com.consuelo.portless.system');
  });
  it('uses PATH portless only when direct daemon repair mode allows lookup', () => {
    const home = createTempHome('consuelo-os-installer-runtime-portless-path-');
    const binDir = join(home, 'bin');
    const captureFile = join(home, 'portless-path-args.txt');
    const portlessBin = join(binDir, 'portless');
    mkdirSync(binDir, { recursive: true });
    writeExecutable(
      portlessBin,
      '#!/bin/sh\nprintf "%s\\n" "$0 $*" > "$PORTLESS_CAPTURE_FILE"\n',
    );

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          PORTLESS_ALLOW_PATH_LOOKUP: '1',
          PORTLESS_DAEMON_PATH: [binDir, systemPath].join(delimiter),
          PORTLESS_CAPTURE_FILE: captureFile,
          PATH: [binDir, systemPath].join(delimiter),
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('using portless from PATH');
    expect(readFileSync(captureFile, 'utf8')).toContain(
      `${portlessBin} proxy start --https --foreground`,
    );
  });

  it('fails clearly when direct daemon repair cannot find portless', () => {
    const home = createTempHome('consuelo-os-installer-runtime-portless-missing-');

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          PORTLESS_ALLOW_PATH_LOOKUP: '1',
          PORTLESS_DAEMON_PATH: systemPath,
          PATH: systemPath,
        }),
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('portless binary not found on PATH');
    expect(result.stderr).toContain('Set PORTLESS_BIN');
  });


  it('includes cloudflared in daemon dry-run output only when a generated plist exists', () => {
    const home = createTempHome('consuelo-os-installer-runtime-daemons-');
    const generatedDir = join(home, 'security', 'generated');
    mkdirSync(generatedDir, { recursive: true });

    const absentResult = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'install-system-daemons.sh'), '--dry-run', '--quiet'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...installerEnv({
            HOME: home,
            CONSUELO_DAEMON_HOME: home,
            CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
            PORTLESS_DAEMON_PATH: systemPath,
            PATH: systemPath,
          }),
        },
      },
    );
    expect(absentResult.status).toBe(0);
    expect(absentResult.stdout).not.toContain('com.consuelo.portless.system');
    expect(absentResult.stdout).not.toContain('com.consuelo.os.cloudflared.connector-123');

    writeCloudflaredPlist(
      join(generatedDir, 'com.consuelo.os.cloudflared.connector-123.plist'),
      'com.consuelo.os.cloudflared.connector-123',
    );
    const presentResult = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'install-system-daemons.sh'), '--dry-run', '--quiet'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...installerEnv({
            HOME: home,
            CONSUELO_DAEMON_HOME: home,
            CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
            PORTLESS_DAEMON_PATH: systemPath,
            PATH: systemPath,
          }),
        },
      },
    );

    expect(presentResult.status).toBe(0);
    expect(presentResult.stdout).not.toContain('com.consuelo.portless.system');
    expect(presentResult.stdout).toContain('com.consuelo.os.cloudflared.connector-123');
  });

  it('includes dynamic cloudflared LaunchAgents in uninstall dry-run output', () => {
    const home = createTempHome('consuelo-os-installer-runtime-uninstall-');
    const launchAgentDir = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgentDir, { recursive: true });
    writeCloudflaredPlist(
      join(launchAgentDir, 'com.consuelo.os.cloudflared.connector-123.plist'),
      'com.consuelo.os.cloudflared.connector-123',
    );

    const result = spawnSync(
      '/bin/bash',
      [join(packageRoot, 'scripts', 'uninstall-system-daemons.sh'), '--dry-run'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PATH: systemPath,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('com.consuelo.portless.system');
    expect(result.stdout).toContain('com.consuelo.os.cloudflared.connector-123');
  });
});
