#!/usr/bin/env bun

import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
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
const ORPHAN_EXIT_POLL_INTERVAL_MS = 100;

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

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function waitForProcessExit(
  pids: number[],
  timeoutMs: number,
): Promise<number[]> {
  try {
    const deadline = Date.now() + timeoutMs;
    let remaining = pids.filter(processExists);
    while (remaining.length > 0 && Date.now() < deadline) {
      await sleep(ORPHAN_EXIT_POLL_INTERVAL_MS);
      remaining = remaining.filter(processExists);
    }
    return remaining;
  } catch (error: unknown) {
    throw new Error('Consuelo OS failed while waiting for orphan workers to exit', {
      cause: error,
    });
  }
}

async function canBindPort(port: number): Promise<boolean> {
  try {
    return await new Promise((resolveResult) => {
      const server = createServer();
      server.unref();
      server.once('error', () => resolveResult(false));
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
        server.close(() => resolveResult(true));
      });
    });
  } catch (error: unknown) {
    throw new Error(`Consuelo OS failed while testing worker port ${port}`, {
      cause: error,
    });
  }
}

async function waitForPortsAvailable(
  ports: number[],
  timeoutMs: number,
): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let unavailable: number[] = [];
  do {
    const results = await Promise.all(
      ports.map(async (port) => ({ port, available: await canBindPort(port) })),
    );
    unavailable = results
      .filter((result) => !result.available)
      .map((result) => result.port);
    if (unavailable.length === 0 || Date.now() >= deadline) break;
    await sleep(ORPHAN_EXIT_POLL_INTERVAL_MS);
  } while (true);
  return unavailable;
}

async function isRecordedWorker(
  worker: WorkerPoolSnapshot['workers'][number],
): Promise<boolean> {
  if (!worker.pid || !processExists(worker.pid)) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${worker.port}/ready`, {
      signal: AbortSignal.timeout(500),
    });
    const body = (await response.json()) as {
      workerId?: string;
      workerInstanceId?: string;
    };
    return body.workerId === worker.workerId
      && body.workerInstanceId === worker.workerInstanceId;
  } catch {
    return false;
  }
}

async function reclaimOrphanedWorkers(
  snapshotPath: string,
  timeoutMs: number,
): Promise<void> {
  let previous: WorkerPoolSnapshot;
  try {
    previous = JSON.parse(readFileSync(snapshotPath, 'utf8')) as WorkerPoolSnapshot;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw new Error('Consuelo OS could not read the previous worker-pool snapshot', {
      cause: error,
    });
  }
  if (previous.schemaVersion !== 1 || !Array.isArray(previous.workers)) {
    throw new Error('Consuelo OS previous worker-pool snapshot is invalid');
  }
  const verifiedWorkers = (
    await Promise.all(previous.workers.map(async (worker) => ({
      worker,
      verified: await isRecordedWorker(worker),
    })))
  ).filter((candidate) => candidate.verified && candidate.worker.pid);
  if (
    verifiedWorkers.length > 0
    && previous.supervisorPid
    && previous.supervisorPid !== process.pid
    && processExists(previous.supervisorPid)
  ) {
    throw new Error(
      `Consuelo OS supervisor ${previous.supervisorPid} is already running`,
    );
  }
  const recordedPorts = [...new Set(previous.workers.map((worker) => worker.port))];
  if (recordedPorts.some((port) => (
    !Number.isInteger(port) || port < 1 || port > 65_535
  ))) {
    throw new Error('Consuelo OS previous worker-pool snapshot has invalid ports');
  }
  try {
    const verifiedPids = verifiedWorkers
      .map(({ worker }) => worker.pid)
      .filter((pid): pid is number => (
        Number.isInteger(pid) && pid !== process.pid && processExists(pid)
      ));
    if (verifiedPids.length > 0) {
      process.stderr.write(
        `[Consuelo OS] reclaiming ${verifiedWorkers.length} verified orphaned worker(s) from supervisor ${previous.supervisorPid ?? 'unknown'}\n`,
      );
      for (const { worker } of verifiedWorkers) {
        try {
          process.kill(worker.pid!, 'SIGTERM');
        } catch {}
      }
    }

    let remaining = await waitForProcessExit(verifiedPids, timeoutMs);
    const verifiedPidSet = new Set(verifiedPids);
    for (const pid of remaining) {
      if (!verifiedPidSet.has(pid)) continue;
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    remaining = await waitForProcessExit(remaining, 2_000);
    if (remaining.length > 0) {
      throw new Error(
        `Consuelo OS cannot safely start while recorded orphan workers remain: ${remaining.join(', ')}`,
      );
    }
    const unavailablePorts = await waitForPortsAvailable(recordedPorts, timeoutMs);
    if (unavailablePorts.length > 0) {
      throw new Error(
        `Consuelo OS cannot safely start while recorded worker ports remain occupied: ${unavailablePorts.join(', ')}`,
      );
    }
  } catch (error: unknown) {
    throw new Error('Consuelo OS orphan-worker recovery failed', { cause: error });
  }
}

if (import.meta.main) {
  process.env.CONSUELO_OS_DAEMON_PROCESS = '1';
  const configuration = resolveWorkerPoolConfiguration();
  const layout = resolveConsueloHomeLayout();
  // Resolve worker code through runtime/current for every spawn. The
  // supervisor intentionally outlives individual workers during a rolling
  // update, so capturing import.meta.dir here can pin replacements to the
  // previous immutable release after the current symlink advances.
  const workerRuntime = (): { root: string; entry: string } => {
    const root = realpathSync(layout.runtimeCurrentDir);
    return { root, entry: path.join(root, 'scripts', 'server', 'main.ts') };
  };
  const snapshotPath = path.join(layout.nodeRunsDir, 'os-worker-pool.json');
  const orphanReclaimTimeoutMs = Number(
    process.env.CONSUELO_OS_ORPHAN_RECLAIM_TIMEOUT_MS
      ?? configuration.drainTimeoutMs + 3_000,
  );
  if (!Number.isInteger(orphanReclaimTimeoutMs) || orphanReclaimTimeoutMs < 1) {
    throw new Error('CONSUELO_OS_ORPHAN_RECLAIM_TIMEOUT_MS must be a positive integer');
  }
  mkdirSync(layout.nodeRunsDir, { recursive: true, mode: 0o700 });
  await reclaimOrphanedWorkers(snapshotPath, orphanReclaimTimeoutMs);

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
    supportsRuntimeCurrentRollingReload: true,
    probeReady: probeWorkerReady,
    writeSnapshot,
    spawnWorker(spec): WorkerProcessHandle {
      const runtime = workerRuntime();
      const subprocess = Bun.spawn([process.execPath, runtime.entry], {
        cwd: runtime.root,
        env: {
          ...process.env,
          CONSUELO_OS_WORKER_PROCESS: '1',
          CONSUELO_OS_WORKER_ID: spec.workerId,
          CONSUELO_OS_WORKER_INSTANCE_ID: spec.workerInstanceId,
          CONSUELO_OS_SUPERVISOR_PID: String(process.pid),
          CONSUELO_OS_WORKER_RELEASE_PATH: runtime.root,
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
  let rollingReload: Promise<void> | null = null;
  const requestRollingReload = (): void => {
    if (closing || rollingReload) return;
    process.stderr.write('[Consuelo OS] rolling worker reload requested\n');
    rollingReload = pool.replaceAllRolling()
      .then(() => {
        process.stderr.write('[Consuelo OS] rolling worker reload complete\n');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[Consuelo OS] rolling worker reload failed: ${message}\n`);
      })
      .finally(() => {
        rollingReload = null;
      });
  };
  if (process.platform !== 'win32') process.on('SIGUSR2', requestRollingReload);

  const stopSupervisor = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    if (process.platform !== 'win32') process.off('SIGUSR2', requestRollingReload);
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
