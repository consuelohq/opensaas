#!/usr/bin/env bun

import { join, resolve } from 'node:path';

import {
  reconcileCaddyWorkerPoolConfig,
  type CaddyWorkerPoolReconciliationResult,
} from '../lib/caddy-worker-pool-reconciliation';

type LaunchctlResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type RunLaunchctl = (args: string[]) => LaunchctlResult;

function defaultRunLaunchctl(args: string[]): LaunchctlResult {
  const result = Bun.spawnSync(['launchctl', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

export function reloadCaddyAfterTopologyChange(input: {
  result: CaddyWorkerPoolReconciliationResult;
  platform?: NodeJS.Platform;
  userId?: number;
  runLaunchctl?: RunLaunchctl;
}): void {
  if (!input.result.changed || input.result.reason === 'gateway-not-configured') return;
  if ((input.platform ?? process.platform) !== 'darwin') return;

  const userId = input.userId ?? process.getuid?.();
  if (userId === undefined) return;

  const runLaunchctl = input.runLaunchctl ?? defaultRunLaunchctl;
  const service = 'gui/' + String(userId) + '/com.consuelo.caddy';
  const loaded = runLaunchctl(['print', service]);
  if (loaded.exitCode !== 0) return;

  const reloaded = runLaunchctl(['kill', 'SIGUSR1', service]);
  if (reloaded.exitCode !== 0) {
    throw new Error(
      reloaded.stderr.trim()
        || reloaded.stdout.trim()
        || 'failed to signal Caddy after topology reconciliation',
    );
  }
}

export function main(): void {
  const homeInput = (process.argv[2] ?? process.env.CONSUELO_HOME ?? '').trim();
  if (!homeInput) throw new Error('Consuelo home is required');
  const home = resolve(homeInput);

  const result = reconcileCaddyWorkerPoolConfig({
    nodeHome: join(home, 'node'),
  });
  reloadCaddyAfterTopologyChange({ result });

  process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
}

if (import.meta.main) main();
