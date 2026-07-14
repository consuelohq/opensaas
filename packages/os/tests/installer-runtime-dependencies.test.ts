import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { SpawnSyncReturns } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { removeSafeTempDir } from './safe-temp-cleanup';

const PACKAGE_ROOT = process.cwd();
const SYSTEM_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(delimiter);
const tempHomes: string[] = [];

function createTempHome(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  tempHomes.push(home);
  return home;
}

function runBootstrapDryRun(
  home: string,
  overrides: Record<string, string> = {},
): SpawnSyncReturns<string> {
  return spawnSync(
    '/bin/bash',
    [
      join(PACKAGE_ROOT, 'scripts', 'bootstrap.sh'),
      '--dry-run',
      '--yes',
      '--json',
      '--mode',
      'local',
      '--skip-daemons',
    ],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        CONSUELO_HOME: join(home, '.consuelo', 'os'),
        CONSUELO_OS_SOURCE_DIR: join(home, 'source'),
        CONSUELO_OS_ALLOW_GLOBAL_RUNTIME_LOOKUP: '0',
        PATH: SYSTEM_PATH,
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
    sourceStatus: string;
    dependencyStatus: string;
    onboardingStatus: string;
    dependencies: {
      runtime: Record<string, { status: string; path: string | null }>;
      operator: Record<string, { classification: string }>;
    };
  };
}

function writeExecutable(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, { mode: 0o755 });
}

function readBootstrap(): string {
  return readFileSync(join(PACKAGE_ROOT, 'scripts', 'bootstrap.sh'), 'utf8');
}

function readDaemonInstaller(): string {
  return readFileSync(
    join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
    'utf8',
  );
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

function parseShaWithBootstrap(checksumText: string): SpawnSyncReturns<string> {
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
    env: { ...process.env, CHECKSUM_TEXT: checksumText, PATH: SYSTEM_PATH },
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

function resolveCutoverLocalHealthUrl(
  envFile: string,
  overrides: Record<string, string> = {},
): SpawnSyncReturns<string> {
  const installer = readDaemonInstaller();
  const script = [
    extractShellFunction(installer, 'load_env_file'),
    extractShellFunction(installer, 'resolve_cutover_local_port'),
    extractShellFunction(installer, 'resolve_cutover_local_health_url'),
    'resolve_cutover_local_health_url "$ENV_FILE"',
  ].join('\n');
  const env = installerEnv({});
  delete env.CONSUELO_OS_PORT;
  delete env.PORT;
  delete env.WORKSPACE_DAEMON_PORT;
  delete env.WORKSPACE_CUTOVER_LOCAL_HEALTH_URL;

  return spawnSync('/bin/bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...env, ENV_FILE: envFile, ...overrides },
  });
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
  it('should probe the configured daemon port during cutover', () => {
    const home = createTempHome('consuelo-os-installer-runtime-cutover-port-');
    const envFile = join(home, '.env');
    writeFileSync(envFile, 'CONSUELO_OS_PORT=47001\n');

    const configured = resolveCutoverLocalHealthUrl(envFile, { PORT: '47002' });
    expect(configured.status).toBe(0);
    expect(configured.stdout.trim()).toBe('http://127.0.0.1:47001/health');

    const daemonOverride = resolveCutoverLocalHealthUrl(envFile, {
      WORKSPACE_DAEMON_PORT: '47003',
    });
    expect(daemonOverride.status).toBe(0);
    expect(daemonOverride.stdout.trim()).toBe('http://127.0.0.1:47003/health');

    const explicitHealthUrl = resolveCutoverLocalHealthUrl(envFile, {
      WORKSPACE_CUTOVER_LOCAL_HEALTH_URL: 'http://127.0.0.1:48000/health',
    });
    expect(explicitHealthUrl.status).toBe(0);
    expect(explicitHealthUrl.stdout.trim()).toBe(
      'http://127.0.0.1:48000/health',
    );

    const defaultPort = resolveCutoverLocalHealthUrl(join(home, 'missing.env'));
    expect(defaultPort.status).toBe(0);
    expect(defaultPort.stdout.trim()).toBe('http://127.0.0.1:46321/health');
  });

  it('should use bounded retrying curl when fetching source and runtime network artifacts', () => {
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
    expect(bootstrap).toContain(
      'curl_retry "$REPO_ARCHIVE_URL" -o "$archive_file"',
    );
    expect(bootstrap).toContain('checksum_text="$(curl_retry "$sha_url")"');
    expect(bootstrap).toContain('curl_retry "$url" -o "$tmp_file"');
    expect(bootstrap).toContain('curl_retry "$url" -o "$archive_file"');
  });

  it('should parse SHA-256 metadata deterministically when checksum files use supported shapes', () => {
    const sha =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    for (const checksumText of [sha, `${sha}  portless`, `${sha} *portless`]) {
      const result = parseShaWithBootstrap(checksumText);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(sha);
    }

    for (const checksumText of [
      '',
      'not-a-sha',
      `${sha.slice(0, 63)} portless`,
      `${sha}g portless`,
    ]) {
      const result = parseShaWithBootstrap(checksumText);
      expect(result.status).not.toBe(0);
    }

    const bootstrap = readBootstrap();
    expect(bootstrap).not.toContain('set -- $checksum_text');
  });

  it('should persist portless only when available before public daemon installation', () => {
    const bootstrap = readBootstrap();

    expect(bootstrap).toContain(
      'persist_env_value "$env_file" BUN_BIN "$BUN_BIN"',
    );
    expect(bootstrap).toContain(
      'persist_env_value "$env_file" PORTLESS_ENABLED "1"',
    );
    expect(bootstrap).toContain('remove_env_value "$env_file" PORTLESS_BIN');
    expect(bootstrap).toContain(
      'persist_env_value "$env_file" PORTLESS_ENABLED "0"',
    );
    expect(bootstrap).toContain(
      'persist_env_value "$env_file" CLOUDFLARED_BIN "$CLOUDFLARED_BIN"',
    );
    expect(bootstrap.indexOf('ensure_portless')).toBeLessThan(
      bootstrap.indexOf('persist_runtime_paths'),
    );
    expect(bootstrap.indexOf('persist_runtime_paths')).toBeLessThan(
      bootstrap.indexOf('maybe_install_daemons'),
    );
  });

  it('should use the regular local port when portless is absent on a clean dry-run PATH', () => {
    const home = createTempHome('consuelo-os-installer-runtime-bootstrap-');
    const result = runBootstrapDryRun(home);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'dry-run: Bun is missing and would be installed',
    );
    expect(result.stderr).toContain(
      'portless is not installed; Consuelo OS will use http://127.0.0.1:46321',
    );
    expect(result.stderr).toContain(
      'dry-run: cloudflared is missing and would be installed',
    );
    expect(result.stderr).not.toMatch(/wrangler.*required/i);
    expect(result.stderr).not.toMatch(
      /CLOUDFLARE_(ACCOUNT_ID|API_TOKEN).*required/,
    );

    const summary = parseBootstrapSummary(result.stdout);
    expect(summary.bunStatus).toBe('would_install');
    expect(summary.portlessStatus).toBe('optional_missing');
    expect(summary.cloudflaredStatus).toBe('would_install');
    expect(summary.dependencies.runtime.portless.status).toBe(
      'optional_missing',
    );
    expect(summary.dependencies.runtime.portless.path).toBeNull();
    expect(summary.dependencies.runtime.cloudflared.status).toBe(
      'would_install',
    );
    expect(summary.dependencies.operator.wrangler.classification).toBe(
      'operator_only',
    );
  });

  it('should keep a hosted clean-machine dry-run non-mutating when source is absent', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-hosted-dry-run-',
    );
    const sourceDir = join(home, 'source');
    const workingDir = join(home, 'working');
    const binDir = join(home, 'bin');
    const bunCaptureFile = join(home, 'bun-invoked');
    mkdirSync(workingDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeExecutable(
      join(binDir, 'bun'),
      '#!/bin/sh\nprintf invoked > "$BUN_CAPTURE_FILE"\nexit 42\n',
    );

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'bootstrap.sh'),
        '--dry-run',
        '--yes',
        '--json',
        '--mode',
        'local',
        '--skip-daemons',
      ],
      {
        cwd: workingDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          CONSUELO_HOME: join(home, '.consuelo', 'os'),
          CONSUELO_OS_SOURCE_DIR: sourceDir,
          CONSUELO_OS_ALLOW_GLOBAL_RUNTIME_LOOKUP: '0',
          BUN_CAPTURE_FILE: bunCaptureFile,
          PATH: [binDir, SYSTEM_PATH].join(delimiter),
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      `dry-run: would download Consuelo OS source from https://github.com/consuelohq/opensaas/archive/refs/heads/main.tar.gz to ${sourceDir}`,
    );
    expect(result.stderr).toContain(
      `dry-run: would install Consuelo OS runtime dependencies with: bun --cwd ${sourceDir}/packages/os install`,
    );
    expect(result.stderr).toContain(
      `dry-run: would run: bun --cwd ${sourceDir}/packages/os ./scripts/install.ts --dry-run --yes --json`,
    );
    expect(result.stderr).not.toContain('ENOENT');
    expect(existsSync(sourceDir)).toBe(false);
    expect(existsSync(bunCaptureFile)).toBe(false);

    const summary = parseBootstrapSummary(result.stdout);
    expect(summary.sourceStatus).toBe('would_download');
    expect(summary.dependencyStatus).toBe('would_install');
    expect(summary.onboardingStatus).toBe('would_run');
  });

  it('should keep portless as an optional enhancement when it is already installed', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-bootstrap-existing-portless-',
    );
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

  it('should use PORTLESS_BIN before PATH when starting the portless daemon launcher', () => {
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
      [join(PACKAGE_ROOT, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          PORTLESS_BIN: portlessBin,
          PORTLESS_CAPTURE_FILE: captureFile,
          PATH: SYSTEM_PATH,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(captureFile, 'utf8')).toContain(
      `${portlessBin} proxy start --https --foreground`,
    );
  });

  it('should keep direct daemon dry-run usable when PATH portless exists and no env file exists', () => {
    const home = createTempHome('consuelo-os-installer-runtime-direct-daemon-');
    const binDir = join(home, 'bin');
    const portlessBin = join(binDir, 'portless');
    mkdirSync(binDir, { recursive: true });
    writeExecutable(portlessBin, '#!/bin/sh\nexit 0\n');

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
        '--dry-run',
        '--quiet',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PORTLESS_DAEMON_PATH: [binDir, SYSTEM_PATH].join(delimiter),
          PATH: [binDir, SYSTEM_PATH].join(delimiter),
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('com.consuelo.portless.system');
    const plist = readFileSync(
      join(
        PACKAGE_ROOT,
        'scripts',
        'generated',
        'com.consuelo.portless.system.plist',
      ),
      'utf8',
    );
    expect(plist).toContain('<key>PORTLESS_ALLOW_PATH_LOOKUP</key>');
    expect(plist).toContain('<string>1</string>');
  });

  it('should skip the optional portless LaunchAgent when portless is absent', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-direct-no-portless-',
    );

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
        '--dry-run',
        '--quiet',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PORTLESS_DAEMON_PATH: SYSTEM_PATH,
          PATH: SYSTEM_PATH,
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('com.consuelo.portless.system');
  });
  it('should use PATH portless only when direct daemon repair mode allows lookup', () => {
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
      [join(PACKAGE_ROOT, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          PORTLESS_ALLOW_PATH_LOOKUP: '1',
          PORTLESS_DAEMON_PATH: [binDir, SYSTEM_PATH].join(delimiter),
          PORTLESS_CAPTURE_FILE: captureFile,
          PATH: [binDir, SYSTEM_PATH].join(delimiter),
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('using portless from PATH');
    expect(readFileSync(captureFile, 'utf8')).toContain(
      `${portlessBin} proxy start --https --foreground`,
    );
  });

  it('should fail clearly when direct daemon repair cannot find portless', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-portless-missing-',
    );

    const result = spawnSync(
      '/bin/bash',
      [join(PACKAGE_ROOT, 'scripts', 'start-portless-daemon.sh')],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          PORTLESS_ALLOW_PATH_LOOKUP: '1',
          PORTLESS_DAEMON_PATH: SYSTEM_PATH,
          PATH: SYSTEM_PATH,
        }),
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('portless binary not found on PATH');
    expect(result.stderr).toContain('Set PORTLESS_BIN');
  });

  it('should include cloudflared in daemon dry-run output only when a generated plist exists', () => {
    const home = createTempHome('consuelo-os-installer-runtime-daemons-');
    const generatedDir = join(home, 'security', 'generated');
    mkdirSync(generatedDir, { recursive: true });

    const absentResult = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
        '--dry-run',
        '--quiet',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...installerEnv({
            HOME: home,
            CONSUELO_DAEMON_HOME: home,
            CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
            PORTLESS_DAEMON_PATH: SYSTEM_PATH,
            PATH: SYSTEM_PATH,
          }),
        },
      },
    );
    expect(absentResult.status).toBe(0);
    expect(absentResult.stdout).not.toContain('com.consuelo.portless.system');
    expect(absentResult.stdout).not.toContain(
      'com.consuelo.os.cloudflared.connector-123',
    );

    writeCloudflaredPlist(
      join(generatedDir, 'com.consuelo.os.cloudflared.connector-123.plist'),
      'com.consuelo.os.cloudflared.connector-123',
    );
    const presentResult = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
        '--dry-run',
        '--quiet',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...installerEnv({
            HOME: home,
            CONSUELO_DAEMON_HOME: home,
            CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
            PORTLESS_DAEMON_PATH: SYSTEM_PATH,
            PATH: SYSTEM_PATH,
          }),
        },
      },
    );

    expect(presentResult.status).toBe(0);
    expect(presentResult.stdout).not.toContain('com.consuelo.portless.system');
    expect(presentResult.stdout).toContain(
      'com.consuelo.os.cloudflared.connector-123',
    );
  });

  it('should derive and require the assigned opaque connector health endpoint after local cutover', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-connector-health-',
    );
    const osHome = join(home, '.consuelo');
    const connectorId = 'connector_test_health';
    mkdirSync(osHome, { recursive: true });
    writeFileSync(
      join(osHome, 'config.json'),
      JSON.stringify({ connector: { id: connectorId } }),
    );
    const installer = readDaemonInstaller();
    const script = [
      extractShellFunction(installer, 'derive_connector_health_url'),
      'derive_connector_health_url',
    ].join('\n');
    const result = spawnSync('/bin/bash', ['-c', script], {
      encoding: 'utf8',
      env: installerEnv({
        BUN_BIN: process.execPath,
        CONSUELO_CONNECTOR_ORIGIN_BASE_DOMAIN: 'consuelohq.com',
        consuelo_data_home: osHome,
        PATH: SYSTEM_PATH,
      }),
    });
    const digest = createHash('sha256')
      .update(`consuelo:connector-origin:v1\0${connectorId}`)
      .digest('hex')
      .slice(0, 32);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(
      `https://c-${digest}.consuelohq.com/health`,
    );
    expect(
      installer.indexOf('wait_for_health "$local_health_url"'),
    ).toBeLessThan(
      installer.indexOf('wait_for_health "$connector_health_url"'),
    );
    expect(
      installer.indexOf('wait_for_health "$connector_health_url"'),
    ).toBeLessThan(installer.lastIndexOf('print_success_summary'));
  });

  it('should discover connector LaunchAgents from the flattened Consuelo home by default', () => {
    const home = createTempHome('consuelo-os-installer-runtime-flat-home-');
    const osHome = join(home, '.consuelo');
    const generatedDir = join(osHome, 'node', 'security', 'generated');
    const connectorLabel = 'com.consuelo.os.cloudflared.connector-flat-home';
    mkdirSync(generatedDir, { recursive: true });
    writeCloudflaredPlist(
      join(generatedDir, `${connectorLabel}.plist`),
      connectorLabel,
    );

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'install-system-daemons.sh'),
        '--dry-run',
        '--quiet',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: installerEnv({
          HOME: home,
          CONSUELO_HOME: osHome,
          CONSUELO_DAEMON_HOME: home,
          PORTLESS_DAEMON_PATH: SYSTEM_PATH,
          PATH: SYSTEM_PATH,
        }),
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(connectorLabel);
    const systemPlist = readFileSync(
      join(PACKAGE_ROOT, 'scripts', 'generated', 'com.consuelo.system.plist'),
      'utf8',
    );
    expect(systemPlist).toContain('<key>WORKSPACE_DAEMON_CONSUELO_HOME</key>');
    expect(systemPlist).toContain(`<string>${osHome}</string>`);
  });

  it('should discover generated connector LaunchAgents during uninstall from the flattened home', () => {
    const home = createTempHome(
      'consuelo-os-installer-runtime-flat-uninstall-',
    );
    const osHome = join(home, '.consuelo');
    const generatedDir = join(osHome, 'node', 'security', 'generated');
    const connectorLabel =
      'com.consuelo.os.cloudflared.connector-flat-uninstall';
    mkdirSync(generatedDir, { recursive: true });
    writeCloudflaredPlist(
      join(generatedDir, `${connectorLabel}.plist`),
      connectorLabel,
    );

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'uninstall-system-daemons.sh'),
        '--dry-run',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          CONSUELO_HOME: osHome,
          CONSUELO_DAEMON_HOME: home,
          PATH: SYSTEM_PATH,
        },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(connectorLabel);
  });

  it('should include dynamic cloudflared LaunchAgents when running uninstall dry-run', () => {
    const home = createTempHome('consuelo-os-installer-runtime-uninstall-');
    const launchAgentDir = join(home, 'Library', 'LaunchAgents');
    mkdirSync(launchAgentDir, { recursive: true });
    writeCloudflaredPlist(
      join(launchAgentDir, 'com.consuelo.os.cloudflared.connector-123.plist'),
      'com.consuelo.os.cloudflared.connector-123',
    );

    const result = spawnSync(
      '/bin/bash',
      [
        join(PACKAGE_ROOT, 'scripts', 'uninstall-system-daemons.sh'),
        '--dry-run',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          PATH: SYSTEM_PATH,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('com.consuelo.portless.system');
    expect(result.stdout).toContain(
      'com.consuelo.os.cloudflared.connector-123',
    );
  });
});
