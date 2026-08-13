import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const temporaryHomes: string[] = [];

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

function resolveBunExecutable(): string {
  const executable = process.env.BUN_BINARY || 'bun';
  const probe = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    throw new Error(`Bun runtime prerequisite is unavailable: ${probe.error?.message ?? probe.stderr ?? 'unknown error'}`);
  }
  return executable;
}

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolveAvailable, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => error ? reject(error) : resolveAvailable());
    });
  });
}

async function contiguousPorts(): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const base = 48_000 + Math.floor(Math.random() * 8_000);
    try {
      await assertPortAvailable(base);
      await assertPortAvailable(base + 1);
      return base;
    } catch {
      // Try another pair.
    }
  }
  throw new Error('could not find two contiguous test ports');
}

async function waitFor<T>(read: () => T | undefined, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await sleep(50);
  }
  throw new Error('worker pool condition timed out');
}

type PoolSnapshot = {
  desiredWorkers: number;
  supervisorPid?: number;
  workers: Array<{
    workerId: string;
    workerInstanceId: string;
    pid?: number;
    port: number;
    state: string;
    restartCount: number;
  }>;
};

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('OS worker pool process integration', () => {
  it('starts two real workers and replaces only the crashed slot', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-worker-pool-'));
    temporaryHomes.push(home);
    const basePort = await contiguousPorts();
    const statePath = join(home, 'node', 'runs', 'os-worker-pool.json');
    const supervisor = spawn(
      resolveBunExecutable(),
      [resolve(osRoot, 'scripts/server/supervisor.ts')],
      {
        cwd: osRoot,
        env: {
          ...process.env,
          CONSUELO_HOME: home,
          CONSUELO_OS_PORT: String(basePort),
          CONSUELO_OS_WORKER_COUNT: '2',
          CONSUELO_OS_WORKER_RESTART_DELAY_MS: '25',
          CONSUELO_OS_DRAIN_TIMEOUT_MS: '2000',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const supervisorExited = new Promise<number>((resolveExit, rejectExit) => {
      supervisor.once('error', rejectExit);
      supervisor.once('exit', (code) => resolveExit(code ?? 1));
    });

    try {
      const first = await waitFor<PoolSnapshot>(() => {
        try {
          const snapshot = JSON.parse(readFileSync(statePath, 'utf8')) as PoolSnapshot;
          return snapshot.workers.length === 2
            && snapshot.workers.every((worker) => worker.state === 'ready')
            ? snapshot
            : undefined;
        } catch {
          return undefined;
        }
      });

      expect(first.desiredWorkers).toBe(2);
      expect(first.supervisorPid).toBe(supervisor.pid);
      expect(first.workers.map((worker) => worker.port)).toEqual([basePort, basePort + 1]);
      const failed = first.workers.find((worker) => worker.workerId === 'worker-0');
      const stable = first.workers.find((worker) => worker.workerId === 'worker-1');
      expect(failed?.pid).toBeTypeOf('number');
      expect(stable?.pid).toBeTypeOf('number');

      process.kill(failed!.pid!, 'SIGTERM');

      const replaced = await waitFor<PoolSnapshot>(() => {
        try {
          const snapshot = JSON.parse(readFileSync(statePath, 'utf8')) as PoolSnapshot;
          const worker = snapshot.workers.find((item) => item.workerId === 'worker-0');
          return worker?.state === 'ready'
            && worker.restartCount >= 1
            && worker.pid !== failed?.pid
            ? snapshot
            : undefined;
        } catch {
          return undefined;
        }
      });

      expect(replaced.workers.find((worker) => worker.workerId === 'worker-1')?.pid).toBe(stable?.pid);
      await expect(fetch(`http://127.0.0.1:${basePort}/ready`)).resolves.toMatchObject({ ok: true });
      await expect(fetch(`http://127.0.0.1:${basePort + 1}/ready`)).resolves.toMatchObject({ ok: true });

      const beforeRolling = new Map(
        replaced.workers.map((worker) => [worker.workerId, worker.workerInstanceId]),
      );
      process.kill(supervisor.pid!, 'SIGUSR2');
      const rolled = await waitFor<PoolSnapshot>(() => {
        try {
          const snapshot = JSON.parse(readFileSync(statePath, 'utf8')) as PoolSnapshot;
          return snapshot.workers.length === 2
            && snapshot.workers.every((worker) =>
              worker.state === 'ready'
              && worker.workerInstanceId !== beforeRolling.get(worker.workerId)
            )
            ? snapshot
            : undefined;
        } catch {
          return undefined;
        }
      });

      expect(rolled.supervisorPid).toBe(supervisor.pid);
      await expect(fetch(`http://127.0.0.1:${basePort}/ready`)).resolves.toMatchObject({ ok: true });
      await expect(fetch(`http://127.0.0.1:${basePort + 1}/ready`)).resolves.toMatchObject({ ok: true });
    } finally {
      supervisor.kill('SIGTERM');
      await supervisorExited;
    }
  }, 60_000);

  it('reclaims orphaned workers when launchd restarts a killed supervisor', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-worker-pool-orphans-'));
    temporaryHomes.push(home);
    const basePort = await contiguousPorts();
    const statePath = join(home, 'node', 'runs', 'os-worker-pool.json');
    const environment = {
      ...process.env,
      CONSUELO_HOME: home,
      CONSUELO_OS_PORT: String(basePort),
      CONSUELO_OS_WORKER_COUNT: '2',
      CONSUELO_OS_WORKER_RESTART_DELAY_MS: '25',
      CONSUELO_OS_DRAIN_TIMEOUT_MS: '2000',
      CONSUELO_OS_ORPHAN_RECLAIM_TIMEOUT_MS: '5000',
    };
    const firstSupervisor = spawn(
      resolveBunExecutable(),
      [resolve(osRoot, 'scripts/server/supervisor.ts')],
      { cwd: osRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const first = await waitFor<PoolSnapshot>(() => {
      try {
        const snapshot = JSON.parse(readFileSync(statePath, 'utf8')) as PoolSnapshot;
        return snapshot.supervisorPid === firstSupervisor.pid
          && snapshot.workers.length === 2
          && snapshot.workers.every((worker) => worker.state === 'ready')
          ? snapshot
          : undefined;
      } catch {
        return undefined;
      }
    });
    const orphanPids = first.workers.map((worker) => worker.pid!);

    firstSupervisor.kill('SIGKILL');
    await new Promise<void>((resolveExit) => firstSupervisor.once('exit', () => resolveExit()));

    const secondSupervisor = spawn(
      resolveBunExecutable(),
      [resolve(osRoot, 'scripts/server/supervisor.ts')],
      { cwd: osRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let secondSupervisorStderr = '';
    secondSupervisor.stderr?.on('data', (chunk) => {
      secondSupervisorStderr += String(chunk);
    });
    const secondSupervisorExited = new Promise<number>((resolveExit, rejectExit) => {
      secondSupervisor.once('error', rejectExit);
      secondSupervisor.once('exit', (code) => resolveExit(code ?? 1));
    });

    try {
      const recovered = await waitFor<PoolSnapshot>(() => {
        try {
          const snapshot = JSON.parse(readFileSync(statePath, 'utf8')) as PoolSnapshot;
          return snapshot.supervisorPid === secondSupervisor.pid
            && snapshot.workers.length === 2
            && snapshot.workers.every((worker) =>
              worker.state === 'ready' && !orphanPids.includes(worker.pid!),
            )
            ? snapshot
            : undefined;
        } catch {
          return undefined;
        }
      }, 15_000);

      expect(recovered.workers.map((worker) => worker.port)).toEqual([basePort, basePort + 1]);
      expect(secondSupervisorStderr).not.toContain('EADDRINUSE');
      await expect(fetch(`http://127.0.0.1:${basePort}/ready`)).resolves.toMatchObject({ ok: true });
      await expect(fetch(`http://127.0.0.1:${basePort + 1}/ready`)).resolves.toMatchObject({ ok: true });
    } finally {
      secondSupervisor.kill('SIGTERM');
      await secondSupervisorExited;
      for (const orphanPid of orphanPids) {
        try { process.kill(orphanPid, 'SIGKILL'); } catch {}
      }
    }
  }, 60_000);
});
