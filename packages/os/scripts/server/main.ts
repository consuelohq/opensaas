#!/usr/bin/env bun

import path from 'node:path';

import { resolveConsueloHomeLayout } from '../lib/consuelo-home';
import { startDefaultNativeLifecycleEndpoint } from '../lib/native-lifecycle-endpoint';
import { startWorkspaceNodeHeartbeatScheduler } from '../lib/workspace-node-heartbeat-scheduler';
import { sendWorkspaceNodeHeartbeatFromConfig } from '../workspace-node-heartbeat';
import { createLocalOsApp } from './app';
import { loadLocalOsServerConfig } from './env';
import { createWorkerRuntimeStateFromEnv } from './worker-runtime-state';

function resolveDrainTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.CONSUELO_OS_DRAIN_TIMEOUT_MS?.trim();
  if (!raw) return 30_000;
  if (!/^\d+$/.test(raw)) throw new Error('Invalid OS worker drain timeout');
  const timeout = Number(raw);
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > 300_000) {
    throw new Error('Invalid OS worker drain timeout');
  }
  return timeout;
}

export async function runDrainAndExit(
  drain: () => Promise<void>,
  dependencies: {
    exit?: (code: number) => unknown;
    report?: (message: string) => void;
  } = {},
): Promise<void> {
  const exit = dependencies.exit ?? ((code: number) => process.exit(code));
  const report = dependencies.report ?? ((message: string) => process.stderr.write(`[Consuelo OS] ${message}\n`));
  try {
    await drain();
    exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    report(`worker drain failed: ${message}`);
    exit(1);
  }
}

if (import.meta.main) {
  process.env.CONSUELO_OS_DAEMON_PROCESS = '1';
  const supervisedWorker = process.env.CONSUELO_OS_WORKER_PROCESS === '1';
  const config = loadLocalOsServerConfig();
  const workerState = createWorkerRuntimeStateFromEnv();
  const app = createLocalOsApp(config, { workerState });

  const lifecycleEndpoint = process.platform === 'darwin' && !supervisedWorker
    ? await startDefaultNativeLifecycleEndpoint()
    : undefined;
  const heartbeatScheduler = process.platform === 'win32' && !supervisedWorker
    ? startWorkspaceNodeHeartbeatScheduler({
        configPath: path.join(resolveConsueloHomeLayout().nodeSecurityGeneratedDir, 'workspace-node-heartbeat.json'),
        send: sendWorkspaceNodeHeartbeatFromConfig,
        onError(error: unknown) {
          const message = error instanceof Error ? error.message : 'workspace node heartbeat failed';
          process.stderr.write(`[Consuelo OS] ${message}\n`);
        },
      })
    : undefined;

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({ hostname: '127.0.0.1', port: config.port, fetch: app.fetch });
  } catch (error: unknown) {
    heartbeatScheduler?.stop();
    await lifecycleEndpoint?.close();
    throw error;
  }


  let shuttingDown = false;
  let parentMonitor: ReturnType<typeof setInterval> | undefined;
  // worker lifecycle continuation
  const drainServer = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (parentMonitor) clearInterval(parentMonitor);
    workerState.startDraining();
    process.stderr.write(`[Consuelo OS] ${workerState.snapshot().workerId} draining (${reason})\n`);
    const gracefulStop = Promise.resolve(server.stop(false));
    const idle = await workerState.waitForIdle(resolveDrainTimeoutMs());
    if (!idle) await Promise.resolve(server.stop(true));
    await gracefulStop.catch(() => undefined);
    heartbeatScheduler?.stop();
    await lifecycleEndpoint?.close();
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void runDrainAndExit(() => drainServer(signal));
    });
  }

  if (supervisedWorker) {
    const supervisorPid = Number(process.env.CONSUELO_OS_SUPERVISOR_PID);
    if (Number.isInteger(supervisorPid) && supervisorPid > 1) {
      parentMonitor = setInterval(() => {
        if (process.ppid !== supervisorPid) {
          void runDrainAndExit(() => drainServer('supervisor-exited'));
        }
      }, 500);
      parentMonitor.unref?.();
    }
  }

  const worker = workerState.snapshot();
  process.stderr.write(
    `[Consuelo OS] ${config.name} ${worker.workerId}/${worker.workerInstanceId} listening on 127.0.0.1:${config.port}\n`,
  );
}
