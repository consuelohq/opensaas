#!/usr/bin/env bun

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from '../lib/consuelo-home';
import { startDefaultNativeLifecycleEndpoint } from '../lib/native-lifecycle-endpoint';
import {
  createWorkerPoolSupervisor,
  resolveWorkerPoolConfiguration,
  type WorkerPoolSnapshot,
  type WorkerProcessHandle,
  type WorkerSpec,
} from '../lib/worker-pool';
import { startWorkspaceNodeHeartbeatScheduler } from '../lib/workspace-node-heartbeat-scheduler';
import { sendWorkspaceNodeHeartbeatFromConfig } from '../workspace-node-heartbeat';

const WORKER_READY_ATTEMPTS = 40;
const WORKER_READY_INTERVAL_MS = 250;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

async function probeWorkerReady(spec: WorkerSpec): Promise<boolean> {
  const url = `http://127.0.0.1:${spec.port}/ready`;
  for (let attempt = 0; attempt < WORKER_READY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const body = (await response.json()) as {
          status?: string;
          workerId?: string;
          workerInstanceId?: string;
        };
        if (
          body.status === 'ready'
          && body.workerId === spec.workerId
          && body.workerInstanceId === spec.workerInstanceId
        ) return true;
      }
    } catch {
      // Startup is bounded below; a later attempt may observe the worker.
    }
    if (attempt + 1 < WORKER_READY_ATTEMPTS) await sleep(WORKER_READY_INTERVAL_MS);
  }
  return false;
}

if (import.meta.main) {
  process.env.CONSUELO_OS_DAEMON_PROCESS = '1';
  const configuration = resolveWorkerPoolConfiguration();
  const layout = resolveConsueloHomeLayout();
  const osRoot = path.resolve(import.meta.dir, '..', '..');
  const workerEntry = path.join(import.meta.dir, 'main.ts');
  const snapshotPath = path.join(layout.nodeRunsDir, 'os-worker-pool.json');
  mkdirSync(layout.nodeRunsDir, { recursive: true, mode: 0o700 });

  const writeSnapshot = (snapshot: WorkerPoolSnapshot): void => {
    const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    renameSync(temporaryPath, snapshotPath);
  };

  const pool = createWorkerPoolSupervisor({
    configuration,
    supervisorPid: process.pid,
    probeReady: probeWorkerReady,
    writeSnapshot,
    spawnWorker(spec): WorkerProcessHandle {
      const subprocess = Bun.spawn([process.execPath, workerEntry], {
        cwd: osRoot,
        env: {
          ...process.env,
          CONSUELO_OS_WORKER_PROCESS: '1',
          CONSUELO_OS_WORKER_ID: spec.workerId,
          CONSUELO_OS_WORKER_INSTANCE_ID: spec.workerInstanceId,
          CONSUELO_OS_SUPERVISOR_PID: String(process.pid),
          CONSUELO_OS_PORT: String(spec.port),
          PORT: String(spec.port),
        },
        stdin: 'ignore',
        stdout: 'inherit',
        stderr: 'inherit',
      });
      return {
        pid: subprocess.pid,
        exited: subprocess.exited,
        kill(signal) {
          subprocess.kill(signal);
          return true;
        },
      };
    },
  });

  const lifecycleEndpoint = process.platform === 'darwin'
    ? await startDefaultNativeLifecycleEndpoint()
    : undefined;
  const heartbeatScheduler = process.platform === 'win32'
    ? startWorkspaceNodeHeartbeatScheduler({
        configPath: path.join(
          layout.nodeSecurityGeneratedDir,
          'workspace-node-heartbeat.json',
        ),
        send: sendWorkspaceNodeHeartbeatFromConfig,
        onError(error: unknown) {
          const message = error instanceof Error
            ? error.message
            : 'workspace node heartbeat failed';
          process.stderr.write(`[Consuelo OS] ${message}\n`);
        },
      })
    : undefined;

  try {
    await pool.start();
  } catch (error: unknown) {
    await pool.stop();
    heartbeatScheduler?.stop();
    await lifecycleEndpoint?.close();
    throw error;
  }

  let closing = false;
  const stopSupervisor = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    let failure: unknown;
    try {
      await pool.stop();
    } catch (error: unknown) {
      failure = error;
    }
    try {
      heartbeatScheduler?.stop();
    } catch (error: unknown) {
      failure ??= error;
    }
    try {
      await lifecycleEndpoint?.close();
    } catch (error: unknown) {
      failure ??= error;
    }
    if (failure !== undefined) {
      throw new Error('Consuelo OS supervisor cleanup failed', { cause: failure });
    }
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void stopSupervisor()
        .then(() => process.exit(0))
        .catch(() => {
          process.stderr.write('[Consuelo OS] supervisor cleanup failed\n');
          process.exit(1);
        });
    });
  }

  process.stderr.write(
    `[Consuelo OS] supervisor ${process.pid} managing ${configuration.desiredWorkers} worker(s) from port ${configuration.basePort}\n`,
  );
}
