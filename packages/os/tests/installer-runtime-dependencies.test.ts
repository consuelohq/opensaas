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

function runBootstrapDryRun(home: string) {
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
  it('reports Bun, portless, and cloudflared handling on a clean dry-run PATH', () => {
    const home = createTempHome('consuelo-os-installer-runtime-bootstrap-');
    const result = runBootstrapDryRun(home);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('dry-run: Bun is missing and would be installed');
    expect(result.stderr).toContain('dry-run: portless is missing and would be installed');
    expect(result.stderr).toContain('dry-run: cloudflared is missing and would be installed');
    expect(result.stderr).not.toMatch(/wrangler.*required/i);
    expect(result.stderr).not.toMatch(/CLOUDFLARE_(ACCOUNT_ID|API_TOKEN).*required/);

    const summary = parseBootstrapSummary(result.stdout);
    expect(summary.bunStatus).toBe('would_install');
    expect(summary.portlessStatus).toBe('would_install');
    expect(summary.cloudflaredStatus).toBe('would_install');
    expect(summary.dependencies.runtime.portless.status).toBe('would_install');
    expect(summary.dependencies.runtime.cloudflared.status).toBe('would_install');
    expect(summary.dependencies.operator.wrangler.classification).toBe('operator_only');
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
          ...process.env,
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
          PATH: systemPath,
        },
      },
    );
    expect(absentResult.status).toBe(0);
    expect(absentResult.stdout).toContain('com.consuelo.portless.system');
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
          ...process.env,
          HOME: home,
          CONSUELO_DAEMON_HOME: home,
          CONSUELO_SECURITY_GENERATED_DIR: generatedDir,
          PATH: systemPath,
        },
      },
    );

    expect(presentResult.status).toBe(0);
    expect(presentResult.stdout).toContain('com.consuelo.portless.system');
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
