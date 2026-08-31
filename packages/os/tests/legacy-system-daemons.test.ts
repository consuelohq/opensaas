import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const helper = resolve(osRoot, 'scripts', 'retire-legacy-system-daemons.sh');
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'consuelo-legacy-launchdaemons-'));
  temporaryDirectories.push(directory);
  return directory;
}

function plist(label: string, script: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
    + '<plist version="1.0"><dict>\n'
    + '<key>Label</key><string>' + label + '</string>\n'
    + '<key>ProgramArguments</key><array><string>/bin/bash</string><string>' + script + '</string></array>\n'
    + '<key>KeepAlive</key><true/>\n'
    + '</dict></plist>\n';
}

function writeLegacy(dir: string, label: string, script: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, label + '.plist'), plist(label, script));
}

function run(args: string[], dir: string) {
  return spawnSync('bash', [helper, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CONSUELO_LEGACY_LAUNCH_DAEMON_DIR: dir },
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform !== 'darwin')('legacy root LaunchDaemon retirement', () => {
  it('reports a clean machine when no legacy Consuelo LaunchDaemons remain', () => {
    const dir = temporaryDirectory();
    const result = run(['--check'], dir);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('No recognized legacy Consuelo system LaunchDaemons found');
  });

  it('detects only the exact historical root daemon contracts', () => {
    const dir = temporaryDirectory();
    writeLegacy(dir, 'com.consuelo.workspace.system', '/Users/example/Dev/opensaas/packages/workspace/scripts/start-brain-daemon.sh');
    writeLegacy(dir, 'com.consuelo.portless.system', '/Users/example/Dev/opensaas/packages/workspace/scripts/start-portless-daemon.sh');
    writeLegacy(dir, 'com.consuelo.workspace.watchdog', '/Users/example/Dev/opensaas/packages/workspace/scripts/workspace-watchdog.sh');
    const result = run(['--check'], dir);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('com.consuelo.workspace.system');
    expect(result.stdout).toContain('com.consuelo.portless.system');
    expect(result.stdout).toContain('com.consuelo.workspace.watchdog');
  });

  it('fails closed when a known filename contains an unrecognized command', () => {
    const dir = temporaryDirectory();
    writeLegacy(dir, 'com.consuelo.workspace.watchdog', '/tmp/not-consuelo.sh');
    const result = run(['--check'], dir);
    expect(result.status).toBe(3);
    expect(result.stderr).toMatch(/refusing|unrecognized/i);
  });

  it('keeps dry-run non-mutating and prints exact retirement actions', () => {
    const dir = temporaryDirectory();
    const path = join(dir, 'com.consuelo.workspace.system.plist');
    writeLegacy(dir, 'com.consuelo.workspace.system', '/Users/example/Dev/opensaas/packages/workspace/scripts/start-brain-daemon.sh');
    const before = spawnSync('cat', [path], { encoding: 'utf8' }).stdout;
    const result = run(['--dry-run'], dir);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('would:');
    expect(result.stdout).toContain('system/com.consuelo.workspace.system');
    expect(result.stdout).toContain('retire ' + path);
    expect(spawnSync('cat', [path], { encoding: 'utf8' }).stdout).toBe(before);
  });

  it('places the privilege gate before the mutating retirement phase', () => {
    const source = readFileSync(helper, 'utf8');
    const privilegeGate = source.indexOf('if [ "$(id -u)" -ne 0 ]; then');
    const mutationPhase = source.indexOf('stamp="$(date -u');

    expect(privilegeGate).toBeGreaterThanOrEqual(0);
    expect(mutationPhase).toBeGreaterThan(privilegeGate);
  });
});
