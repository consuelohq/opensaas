import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createWorkerPoolSupervisor,
  resolveWorkerPoolConfiguration,
  type WorkerProcessHandle,
} from '../scripts/lib/worker-pool';
import { renderSystemdUserUnit } from '../scripts/lib/platforms/linux';
import { createWorkerRuntimeState } from '../scripts/server/worker-runtime-state';

const osRoot = resolve(import.meta.dirname, '..');

function deferredExit(): {
  promise: Promise<number>;
  resolve: (exitCode: number) => void;
} {
  let resolveExit!: (exitCode: number) => void;
  return {
    promise: new Promise<number>((resolve) => {
      resolveExit = resolve;
    }),
    resolve: resolveExit,
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('condition was not satisfied');
    await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  }
}

describe('OS worker pool lifecycle', () => {
  it('defaults to an HA pair and assigns deterministic bounded ports', () => {
    expect(resolveWorkerPoolConfiguration({})).toMatchObject({
      desiredWorkers: 2,
      basePort: 46321,
      workerPorts: [46321, 46322],
    });

    expect(
      resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '3',
        CONSUELO_OS_PORT: '47000',
      }),
    ).toMatchObject({
      desiredWorkers: 3,
      basePort: 47000,
      workerPorts: [47000, 47001, 47002],
    });

    expect(() =>
      resolveWorkerPoolConfiguration({ CONSUELO_OS_WORKER_COUNT: '0' }),
    ).toThrow(/worker count/i);
    expect(() =>
      resolveWorkerPoolConfiguration({ CONSUELO_OS_WORKER_COUNT: '17' }),
    ).toThrow(/worker count/i);
    expect(() =>
      resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '2',
        CONSUELO_OS_PORT: '65535',
      }),
    ).toThrow(/port/i);
  });

  it('replaces a crashed worker without restarting healthy siblings', async () => {
    let nextPid = 1000;
    let nextInstance = 0;
    const spawned: Array<{ workerId: string; workerInstanceId: string; pid: number }> = [];
    const exits = new Map<string, Array<{ resolve: (exitCode: number) => void }>>();

    const supervisor = createWorkerPoolSupervisor({
      configuration: resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '2',
        CONSUELO_OS_PORT: '47010',
        CONSUELO_OS_WORKER_RESTART_DELAY_MS: '0',
      }),
      instanceId: () => `instance-${++nextInstance}`,
      spawnWorker(spec): WorkerProcessHandle {
        const exit = deferredExit();
        const pid = nextPid++;
        const controls = exits.get(spec.workerId) ?? [];
        controls.push({ resolve: exit.resolve });
        exits.set(spec.workerId, controls);
        spawned.push({
          workerId: spec.workerId,
          workerInstanceId: spec.workerInstanceId,
          pid,
        });
        return {
          pid,
          exited: exit.promise,
          kill() {
            exit.resolve(0);
            return true;
          },
        };
      },
      probeReady: async () => true,
      writeSnapshot: () => {},
      sleep: async () => {},
    });

    await supervisor.start();
    const first = supervisor.snapshot();
    expect(first.desiredWorkers).toBe(2);
    expect(first.workers.map((worker) => worker.port)).toEqual([47010, 47011]);
    expect(first.workers.every((worker) => worker.state === 'ready')).toBe(true);

    const stablePid = first.workers.find((worker) => worker.workerId === 'worker-1')?.pid;
    exits.get('worker-0')?.[0]?.resolve(1);

    await waitFor(() => spawned.filter((worker) => worker.workerId === 'worker-0').length === 2);
    const replaced = supervisor.snapshot();
    expect(replaced.workers.find((worker) => worker.workerId === 'worker-0')?.pid).not.toBe(
      first.workers.find((worker) => worker.workerId === 'worker-0')?.pid,
    );
    expect(replaced.workers.find((worker) => worker.workerId === 'worker-1')?.pid).toBe(stablePid);
    expect(replaced.workers.find((worker) => worker.workerId === 'worker-0')?.restartCount).toBe(1);

    await supervisor.stop();
  });

  it('retries a slot after a transient replacement spawn failure', async () => {
    let nextPid = 2000;
    let spawnAttempts = 0;
    const exits: Array<{ resolve: (exitCode: number) => void }> = [];
    const supervisor = createWorkerPoolSupervisor({
      configuration: resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '1',
        CONSUELO_OS_PORT: '47020',
        CONSUELO_OS_WORKER_RESTART_DELAY_MS: '0',
      }),
      spawnWorker(): WorkerProcessHandle {
        spawnAttempts += 1;
        if (spawnAttempts === 2) throw new Error('transient spawn failure');
        const exit = deferredExit();
        exits.push({ resolve: exit.resolve });
        return {
          pid: nextPid++,
          exited: exit.promise,
          kill() { exit.resolve(0); return true; },
        };
      },
      probeReady: async () => true,
      writeSnapshot: () => {},
      sleep: async () => {},
    });

    await supervisor.start();
    exits[0]?.resolve(1);
    await waitFor(() => (supervisor.snapshot().workers[0]?.restartCount ?? 0) >= 2);
    expect(supervisor.snapshot().workers[0]).toMatchObject({
      state: 'ready',
      restartCount: 2,
    });
    expect(spawnAttempts).toBe(3);
    await supervisor.stop();
  });

  it('backs off replacement spawn failures and stops retrying after a bounded budget', async () => {
    let spawnAttempts = 0;
    let firstExit: ((exitCode: number) => void) | undefined;
    const sleeps: number[] = [];
    const supervisor = createWorkerPoolSupervisor({
      configuration: resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '1',
        CONSUELO_OS_PORT: '47025',
        CONSUELO_OS_WORKER_RESTART_DELAY_MS: '0',
      }),
      spawnWorker(): WorkerProcessHandle {
        spawnAttempts += 1;
        if (spawnAttempts > 1) throw new Error('permanent spawn failure');
        const exit = deferredExit();
        firstExit = exit.resolve;
        return {
          pid: 2500,
          exited: exit.promise,
          kill() { exit.resolve(0); return true; },
        };
      },
      probeReady: async () => true,
      writeSnapshot: () => {},
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
    });

    await supervisor.start();
    firstExit?.(1);
    await waitFor(() => {
      const worker = supervisor.snapshot().workers[0];
      return worker?.state === 'failed' && (worker.restartCount ?? 0) >= 5;
    });

    expect(spawnAttempts).toBeLessThanOrEqual(6);
    expect(sleeps.length).toBeLessThanOrEqual(6);
    expect(sleeps.some((delay) => delay > 0)).toBe(true);
    expect(sleeps).toEqual([...sleeps].sort((left, right) => left - right));
    await supervisor.stop();
  });

  it('rolls worker slots one at a time and waits for each replacement to become ready', async () => {
    let nextPid = 3000;
    let nextInstance = 0;
    const events: string[] = [];
    const supervisor = createWorkerPoolSupervisor({
      configuration: resolveWorkerPoolConfiguration({
        CONSUELO_OS_WORKER_COUNT: '2',
        CONSUELO_OS_PORT: '47030',
        CONSUELO_OS_WORKER_RESTART_DELAY_MS: '0',
      }),
      instanceId: () => `rolling-${++nextInstance}`,
      spawnWorker(spec): WorkerProcessHandle {
        const exit = deferredExit();
        const pid = nextPid++;
        events.push(`spawn:${spec.workerId}:${spec.workerInstanceId}`);
        return {
          pid,
          exited: exit.promise,
          kill(signal) {
            events.push(`kill:${spec.workerId}:${spec.workerInstanceId}:${signal ?? 'SIGTERM'}`);
            queueMicrotask(() => exit.resolve(0));
            return true;
          },
        };
      },
      probeReady: async (spec) => {
        events.push(`ready:${spec.workerId}:${spec.workerInstanceId}`);
        return true;
      },
      writeSnapshot: () => {},
      sleep: async () => {
        await new Promise<void>((resolveSleep) => setTimeout(resolveSleep, 0));
      },
    });

    await supervisor.start();
    const before = supervisor.snapshot();
    const originalWorker0 = before.workers[0]?.workerInstanceId;
    const originalWorker1 = before.workers[1]?.workerInstanceId;

    await supervisor.replaceAllRolling();

    const after = supervisor.snapshot();
    expect(after.workers.every((entry) => entry.state === 'ready')).toBe(true);
    expect(after.workers[0]?.workerInstanceId).not.toBe(originalWorker0);
    expect(after.workers[1]?.workerInstanceId).not.toBe(originalWorker1);
    expect(after.workers[0]?.restartCount).toBe(1);
    expect(after.workers[1]?.restartCount).toBe(1);

    const worker0ReplacementReady = events.findIndex((event) =>
      event === `ready:worker-0:${after.workers[0]?.workerInstanceId}`,
    );
    const worker1Drain = events.findIndex((event) =>
      event === `kill:worker-1:${originalWorker1}:SIGTERM`,
    );
    expect(worker0ReplacementReady).toBeGreaterThan(-1);
    expect(worker1Drain).toBeGreaterThan(worker0ReplacementReady);

    await supervisor.stop();
  });

  it('tracks active work and refuses new work after draining starts', async () => {
    const state = createWorkerRuntimeState({
      workerId: 'worker-0',
      workerInstanceId: 'instance-a',
    });

    expect(state.beginRequest()).toBe(true);
    expect(state.snapshot()).toMatchObject({
      workerId: 'worker-0',
      workerInstanceId: 'instance-a',
      activeRequests: 1,
      draining: false,
    });

    state.startDraining();
    expect(state.beginRequest()).toBe(false);
    const idle = state.waitForIdle(100);
    state.endRequest();
    await expect(idle).resolves.toBe(true);
    expect(state.snapshot()).toMatchObject({ activeRequests: 0, draining: true });
  });

  it('wires managed macOS/direct and Linux service launch paths to the supervisor', () => {
    const daemon = readFileSync(resolve(osRoot, 'scripts/start-consuelo-daemon.sh'), 'utf8');
    expect(daemon).toContain('scripts/server/supervisor.ts');

    const unit = renderSystemdUserUnit({ home: '/tmp/consuelo-home', bunExecutable: '/usr/bin/bun' });
    expect(unit).toContain('/runtime/current/scripts/server/supervisor.ts');
    expect(unit).not.toContain('/runtime/current/scripts/server/main.ts');
  });
});
