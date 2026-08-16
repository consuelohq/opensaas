#!/usr/bin/env bun

import { join, resolve } from 'node:path';

import { reconcileCaddyWorkerPoolConfig } from '../lib/caddy-worker-pool-reconciliation';

const homeInput = (process.argv[2] ?? process.env.CONSUELO_HOME ?? '').trim();
if (!homeInput) throw new Error('Consuelo home is required');
const home = resolve(homeInput);

const nodeHome = join(home, 'node');
const result = reconcileCaddyWorkerPoolConfig({ nodeHome });

if (result.reason !== 'gateway-not-configured' && process.platform === 'darwin') {
  const userId = process.getuid?.();
  if (userId !== undefined) {
    const service = 'gui/' + String(userId) + '/com.consuelo.caddy';
    const loaded = Bun.spawnSync(['launchctl', 'print', service], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    if (loaded.exitCode === 0) {
      const reloaded = Bun.spawnSync(
        ['launchctl', 'kill', 'SIGUSR1', service],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      if (reloaded.exitCode !== 0) {
        throw new Error(
          reloaded.stderr.toString().trim()
            || reloaded.stdout.toString().trim()
            || 'failed to signal Caddy after topology reconciliation',
        );
      }
    }
  }
}

process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
