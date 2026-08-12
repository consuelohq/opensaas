export type WorkerRuntimeSnapshot = {
  workerId: string;
  workerInstanceId: string;
  activeRequests: number;
  draining: boolean;
};

export type WorkerRuntimeState = {
  beginRequest(): boolean;
  endRequest(): void;
  startDraining(): void;
  snapshot(): WorkerRuntimeSnapshot;
  waitForIdle(timeoutMs: number): Promise<boolean>;
};

type IdleWaiter = {
  resolve: (idle: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function createWorkerRuntimeState(input: {
  workerId: string;
  workerInstanceId: string;
}): WorkerRuntimeState {
  let activeRequests = 0;
  let draining = false;
  const idleWaiters = new Set<IdleWaiter>();

  const resolveIdleWaiters = (): void => {
    if (activeRequests !== 0) return;
    for (const waiter of idleWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(true);
    }
    idleWaiters.clear();
  };

  return {
    beginRequest() {
      if (draining) return false;
      activeRequests += 1;
      return true;
    },
    endRequest() {
      if (activeRequests <= 0) {
        throw new Error('OS worker request accounting underflow');
      }
      activeRequests -= 1;
      resolveIdleWaiters();
    },
    startDraining() {
      draining = true;
      resolveIdleWaiters();
    },
    snapshot() {
      return {
        workerId: input.workerId,
        workerInstanceId: input.workerInstanceId,
        activeRequests,
        draining,
      };
    },
    waitForIdle(timeoutMs) {
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new Error('OS worker drain timeout must be a non-negative number');
      }
      if (activeRequests === 0) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const waiter: IdleWaiter = {
          resolve,
          timer: setTimeout(() => {
            idleWaiters.delete(waiter);
            resolve(false);
          }, timeoutMs),
        };
        idleWaiters.add(waiter);
      });
    },
  };
}

export function createWorkerRuntimeStateFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkerRuntimeState {
  return createWorkerRuntimeState({
    workerId: env.CONSUELO_OS_WORKER_ID?.trim() || 'worker-0',
    workerInstanceId:
      env.CONSUELO_OS_WORKER_INSTANCE_ID?.trim()
      || `standalone-${process.pid}`,
  });
}
