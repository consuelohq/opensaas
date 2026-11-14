export type ContextScheduler = ReturnType<typeof createContextScheduler>;
export type ContextAdmissionOutcome = 'finished' | 'expired' | 'cancelled';
type Job = {
  owner: object;
  run: () => Promise<void>;
  settle: (outcome: ContextAdmissionOutcome) => void;
  expiresAt: number;
};
export function createContextScheduler(
  options: {
    concurrency?: number;
    maxWaiting?: number;
    maxRequestsPerMinute?: number;
    maxWaitMs?: number;
  } = {},
) {
  const concurrency = options.concurrency ?? 4,
    maxWaiting = options.maxWaiting ?? 64,
    maxRequests = options.maxRequestsPerMinute ?? 120,
    maxWait = options.maxWaitMs ?? 30000;
  if (
    ![concurrency, maxWaiting, maxRequests, maxWait].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    concurrency > 4 ||
    maxWaiting > 64 ||
    maxRequests > 120 ||
    maxWait > 30000
  )
    throw new Error('Invalid bounded context scheduler configuration');
  const queue: Job[] = [];
  const active = new Set<object>();
  const starts: number[] = [];
  let failures = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;
  const prune = (now: number) => {
    while (starts.length && starts[0]! <= now - 60000) starts.shift();
  };
  const drain = () => {
    clearTimeout(wake);
    wake = undefined;
    const now = Date.now();
    prune(now);
    for (let i = queue.length - 1; i >= 0; i--)
      if (queue[i]!.expiresAt <= now) {
        queue.splice(i, 1)[0]!.settle('expired');
      }
    while (
      queue.length &&
      active.size < concurrency &&
      starts.length < maxRequests
    ) {
      const job = queue.shift()!;
      active.add(job.owner);
      starts.push(now);
      const finish = () => {
        active.delete(job.owner);
        job.settle('finished');
        drain();
      };
      void Promise.resolve()
        .then(job.run)
        .then(finish, () => {
          failures++;
          finish();
        });
    }
    if (queue.length) {
      const expiry = Math.min(...queue.map((j) => j.expiresAt));
      const budget = starts.length >= maxRequests ? starts[0]! + 60000 : expiry;
      wake = setTimeout(
        drain,
        Math.max(1, Math.min(expiry, budget) - Date.now()),
      );
      wake.unref?.();
    }
  };
  return {
    enqueue(
      owner: object,
      run: () => Promise<void>,
    ): Promise<ContextAdmissionOutcome> | null {
      if (
        active.has(owner) ||
        queue.some((j) => j.owner === owner) ||
        queue.length >= maxWaiting
      )
        return null;
      let settle!: (outcome: ContextAdmissionOutcome) => void;
      const pending = new Promise<ContextAdmissionOutcome>((r) => {
        settle = r;
      });
      queue.push({ owner, run, settle, expiresAt: Date.now() + maxWait });
      drain();
      return pending;
    },
    cancel(owner: object) {
      const index = queue.findIndex((j) => j.owner === owner);
      if (index >= 0) queue.splice(index, 1)[0]!.settle('cancelled');
      drain();
    },
    diagnostics() {
      prune(Date.now());
      return {
        active: active.size,
        waiting: queue.length,
        startedInWindow: starts.length,
        failures,
      };
    },
  };
}
export const sharedContextScheduler = createContextScheduler();
