#!/usr/bin/env bun

import { join, resolve } from 'node:path';

import { reconcileCaddyWorkerPoolConfig } from '../lib/caddy-worker-pool-reconciliation';

const homeInput = (process.argv[2] ?? process.env.CONSUELO_HOME ?? '').trim();
if (!homeInput) throw new Error('Consuelo home is required');
const home = resolve(homeInput);

const result = reconcileCaddyWorkerPoolConfig({
  nodeHome: join(home, 'node'),
});

if (result.changed && process.platform === 'darwin') {
  const userId = process.getuid?.();
  if (userId !== undefined) {
    const service = 'gui/' + String(userId) + '/com.consuelo.caddy';
    const loaded = Bun.spawnSync(['launchctl', 'print', service], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    if (loaded.exitCode === 0) {
      const restarted = Bun.spawnSync(
        ['launchctl', 'kickstart', '-k', service],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      if (restarted.exitCode !== 0) {
        throw new Error(
          restarted.stderr.toString().trim()
            || restarted.stdout.toString().trim()
            || 'failed to restart Caddy after topology reconciliation',
        );
      }
    }
  }
}

process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
