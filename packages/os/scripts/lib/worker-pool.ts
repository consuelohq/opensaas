export const MAX_OS_WORKERS = 16;

export type WorkerPoolConfiguration = {
  desiredWorkers: number;
  basePort: number;
  workerPorts: number[];
  restartDelayMs: number;
  drainTimeoutMs: number;
};

export type WorkerSpec = {
  slot: number;
  workerId: string;
  workerInstanceId: string;
  port: number;
};

export type WorkerProcessHandle = {
  pid: number;
  exited: Promise<number>;
  kill(signal?: NodeJS.Signals): boolean;
};

export type WorkerPoolWorkerSnapshot = {
  workerId: string;
  workerInstanceId: string;
  slot: number;
  port: number;
  pid?: number;
  state: 'starting' | 'ready' | 'draining' | 'failed' | 'stopped';
  restartCount: number;
  lastExitCode?: number;
};

export type WorkerPoolSnapshot = {
  schemaVersion: 1;
  desiredWorkers: number;
  basePort: number;
  supervisorPid?: number;
  generatedAt: string;
  workers: WorkerPoolWorkerSnapshot[];
};

export type WorkerPoolSupervisor = {
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): WorkerPoolSnapshot;
};

type WorkerSlot = WorkerPoolWorkerSnapshot & {
  process?: WorkerProcessHandle;
};

function integerFromEnv(input: {
  raw: string | undefined;
  fallback: number;
  label: string;
  min: number;
  max: number;
}): number {
  const raw = input.raw?.trim();
  if (!raw) return input.fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${input.label} must be an integer between ${input.min} and ${input.max}`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < input.min || value > input.max) {
    throw new Error(`${input.label} must be an integer between ${input.min} and ${input.max}`);
  }
  return value;
}

export function resolveWorkerPoolConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): WorkerPoolConfiguration {
  const desiredWorkers = integerFromEnv({
    raw: env.CONSUELO_OS_WORKER_COUNT,
    fallback: 1,
    label: 'OS worker count',
    min: 1,
    max: MAX_OS_WORKERS,
  });
  const basePort = integerFromEnv({
    raw: env.CONSUELO_OS_PORT ?? env.PORT ?? env.WORKSPACE_DAEMON_PORT,
    fallback: 46321,
    label: 'OS worker base port',
    min: 1,
    max: 65_535,
  });
  if (basePort + desiredWorkers - 1 > 65_535) {
    throw new Error('OS worker port range exceeds port 65535');
  }
  const restartDelayMs = integerFromEnv({
    raw: env.CONSUELO_OS_WORKER_RESTART_DELAY_MS,
    fallback: 250,
    label: 'OS worker restart delay',
    min: 0,
    max: 60_000,
  });
  const drainTimeoutMs = integerFromEnv({
    raw: env.CONSUELO_OS_DRAIN_TIMEOUT_MS,
    fallback: 30_000,
    label: 'OS worker drain timeout',
    min: 0,
    max: 300_000,
  });
  return {
    desiredWorkers,
    basePort,
    workerPorts: Array.from(
      { length: desiredWorkers },
      (_, index) => basePort + index,
    ),
    restartDelayMs,
    drainTimeoutMs,
  };
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export function createWorkerPoolSupervisor(input: {
  configuration: WorkerPoolConfiguration;
  spawnWorker: (spec: WorkerSpec) => WorkerProcessHandle;
  probeReady: (spec: WorkerSpec) => Promise<boolean>;
  writeSnapshot: (snapshot: WorkerPoolSnapshot) => void;
  instanceId?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
  supervisorPid?: number;
}): WorkerPoolSupervisor {
  const slots = new Map<number, WorkerSlot>();
  const instanceId = input.instanceId ?? (() => crypto.randomUUID());
  const sleep = input.sleep ?? defaultSleep;
  const now = input.now ?? (() => new Date());
  let started = false;
  let stopping = false;

  const snapshot = (): WorkerPoolSnapshot => ({
    schemaVersion: 1,
    desiredWorkers: input.configuration.desiredWorkers,
    basePort: input.configuration.basePort,
    ...(input.supervisorPid ? { supervisorPid: input.supervisorPid } : {}),
    generatedAt: now().toISOString(),
    workers: [...slots.values()]
      .sort((left, right) => left.slot - right.slot)
      .map(({ process: _process, ...worker }) => ({ ...worker })),
  });

  const publish = (): void => input.writeSnapshot(snapshot());

  const restartAfterExit = async (
    slotIndex: number,
    expectedInstanceId: string,
    exitCode: number,
  ): Promise<void> => {
    const current = slots.get(slotIndex);
    if (!current || current.workerInstanceId !== expectedInstanceId) return;
    current.pid = undefined;
    current.process = undefined;
    current.lastExitCode = exitCode;
    current.state = stopping ? 'stopped' : 'failed';
    publish();
    if (stopping) return;
    await sleep(input.configuration.restartDelayMs);
    if (stopping) return;
    await relaunchSlot(slotIndex, current.restartCount + 1);
  };

  const relaunchSlot = async (slotIndex: number, initialRestartCount: number): Promise<void> => {
    let restartCount = initialRestartCount;
    while (!stopping) {
      try {
        await launchSlot(slotIndex, restartCount);
        return;
      } catch {
        const current = slots.get(slotIndex);
        if (current?.process) return;
        if (current) {
          current.restartCount = restartCount;
          current.state = 'failed';
          publish();
        }
        restartCount += 1;
        await sleep(input.configuration.restartDelayMs);
      }
    }
  };

  const launchSlot = async (slotIndex: number, restartCount: number): Promise<void> => {
    if (stopping) return;
    const workerId = `worker-${slotIndex}`;
    const workerInstanceId = instanceId();
    const spec: WorkerSpec = {
      slot: slotIndex,
      workerId,
      workerInstanceId,
      port: input.configuration.workerPorts[slotIndex]!,
    };
    const processHandle = input.spawnWorker(spec);
    const slot: WorkerSlot = {
      ...spec,
      pid: processHandle.pid,
      state: 'starting',
      restartCount,
      process: processHandle,
    };
    slots.set(slotIndex, slot);
    publish();

    void processHandle.exited.then(
      (exitCode) => restartAfterExit(slotIndex, workerInstanceId, exitCode),
      () => restartAfterExit(slotIndex, workerInstanceId, 1),
    ).catch(() => undefined);

    const ready = await input.probeReady(spec);
    const current = slots.get(slotIndex);
    if (!current || current.workerInstanceId !== workerInstanceId || stopping) return;
    if (!ready) {
      current.state = 'failed';
      publish();
      try {
        processHandle.kill('SIGTERM');
      } catch {
        // The process may already have exited; the exit handler owns recovery.
      }
      throw new Error(`${workerId} did not become ready on port ${spec.port}`);
    }
    current.state = 'ready';
    publish();
  };

  return {
    async start() {
      if (started) return;
      started = true;
      stopping = false;
      await Promise.all(
        input.configuration.workerPorts.map((_port, index) => launchSlot(index, 0)),
      );
    },
    async stop() {
      if (!started) return;
      stopping = true;
      const active = [...slots.values()];
      for (const slot of active) {
        if (slot.state === 'ready' || slot.state === 'starting') slot.state = 'draining';
      }
      publish();
      for (const slot of active) {
        try {
          slot.process?.kill('SIGTERM');
        } catch {
          // The worker may already be gone; its exit handler will normalize state.
        }
      }
      const exits = active
        .map((slot) => slot.process?.exited)
        .filter((value): value is Promise<number> => Boolean(value));
      if (exits.length > 0) {
        const completed = Promise.allSettled(exits).then(() => true);
        const timedOut = sleep(input.configuration.drainTimeoutMs).then(() => false);
        const graceful = await Promise.race([completed, timedOut]);
        if (!graceful) {
          for (const slot of active) {
            try {
              slot.process?.kill('SIGKILL');
            } catch {
              // A process that already exited needs no further action.
            }
          }
        }
      }
      for (const slot of slots.values()) {
        slot.pid = undefined;
        slot.process = undefined;
        slot.state = 'stopped';
      }
      publish();
      started = false;
    },
    snapshot,
  };
}
