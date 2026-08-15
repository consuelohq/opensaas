#!/usr/bin/env bun

import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { reconcileCaddyWorkerPoolConfig } from '../lib/caddy-worker-pool-reconciliation';

const CADDY_SERVICE_LABEL = 'com.consuelo.caddy';
const WATCHDOG_SERVICE_LABEL = 'com.consuelo.watchdog';
const WATCHDOG_PORT = '46320';
const WATCHDOG_URL = `http://127.0.0.1:${WATCHDOG_PORT}/health`;

function sanitizeLabel(raw: string): string {
  let sanitized = raw.replace(/[^A-Za-z0-9._-]/g, '_');
  while (sanitized.includes('..')) sanitized = sanitized.replaceAll('..', '_');
  sanitized = sanitized.replace(/^[./]+/, '');
  return sanitized || WATCHDOG_SERVICE_LABEL;
}

export function reconcileWatchdogPlistSource(source: string): string {
  const withoutOldValues = source.replace(
    /\s*<key>WORKSPACE_WATCHDOG_LOCAL_(?:PORT|URL)<\/key>\s*<string>[^<]*<\/string>/g,
    '',
  );
  const environmentStart = /(<key>EnvironmentVariables<\/key>\s*<dict>)/;
  if (!environmentStart.test(withoutOldValues)) {
    throw new Error('watchdog plist is missing its EnvironmentVariables dictionary');
  }
  return withoutOldValues.replace(
    environmentStart,
    `$1
    <key>WORKSPACE_WATCHDOG_LOCAL_PORT</key>
    <string>${WATCHDOG_PORT}</string>
    <key>WORKSPACE_WATCHDOG_LOCAL_URL</key>
    <string>${WATCHDOG_URL}</string>`,
  );
}

function commandSucceeded(command: string, args: string[]): boolean {
  return Bun.spawnSync([command, ...args], {
    stdout: 'ignore',
    stderr: 'ignore',
  }).exitCode === 0;
}

function restartLoadedService(label: string, plistPath?: string): void {
  if (process.platform !== 'darwin') return;
  const userId = process.getuid?.();
  if (userId === undefined) return;
  const domain = `gui/${userId}`;
  const service = `${domain}/${label}`;
  if (!commandSucceeded('launchctl', ['print', service])) return;
  if (plistPath) {
    if (!commandSucceeded('launchctl', ['bootout', service])) {
      throw new Error(`failed to unload ${label} for HA reconciliation`);
    }
    if (!commandSucceeded('launchctl', ['bootstrap', domain, plistPath])) {
      throw new Error(`failed to reload ${label} after HA reconciliation`);
    }
    return;
  }
  if (!commandSucceeded('launchctl', ['kickstart', '-k', service])) {
    throw new Error(`failed to restart ${label} after HA reconciliation`);
  }
}

function reconcileWatchdogPlist(home: string): { changed: boolean; path: string } {
  const label = sanitizeLabel(
    process.env.WORKSPACE_WATCHDOG_LABEL ?? WATCHDOG_SERVICE_LABEL,
  );
  const plistPath = join(home, 'node', 'security', 'generated', `${label}.plist`);
  if (!existsSync(plistPath)) return { changed: false, path: plistPath };
  const current = readFileSync(plistPath, 'utf8');
  const expected = reconcileWatchdogPlistSource(current);
  if (current === expected) return { changed: false, path: plistPath };
  const temporaryPath = `${plistPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, expected, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, plistPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  restartLoadedService(label, plistPath);
  return { changed: true, path: plistPath };
}

function main(): void {
  const homeInput = (process.argv[2] ?? process.env.CONSUELO_HOME ?? '').trim();
  if (!homeInput) throw new Error('Consuelo home is required');
  const home = resolve(homeInput);
  const caddy = reconcileCaddyWorkerPoolConfig({
    nodeHome: join(home, 'node'),
  });
  if (caddy.changed) restartLoadedService(CADDY_SERVICE_LABEL);
  const watchdog = reconcileWatchdogPlist(home);
  process.stdout.write(JSON.stringify({
    ok: true,
    caddyChanged: caddy.changed,
    watchdogChanged: watchdog.changed,
    watchdogPlist: basename(watchdog.path),
  }) + '\n');
}

if (import.meta.main) main();
