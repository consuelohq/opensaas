export const DEFAULT_TASK_WORKTREE_GC_INTERVAL_MS = 60 * 60 * 1000;

export type TaskWorktreeGcScheduler = {
  runNow(): Promise<boolean>;
  stop(): void;
};

export function startTaskWorktreeGcScheduler(input: {
  intervalMs?: number;
  run: () => Promise<void>;
  onError?: (error: unknown) => void;
}): TaskWorktreeGcScheduler {
  const intervalMs = input.intervalMs ?? DEFAULT_TASK_WORKTREE_GC_INTERVAL_MS;
  if (!Number.isInteger(intervalMs) || intervalMs < 1) {
    throw new Error('task worktree GC interval must be a positive integer');
  }

  let running = false;
  let stopped = false;

  const runNow = async (): Promise<boolean> => {
    if (stopped || running) return false;
    running = true;
    try {
      await input.run();
    } catch (error: unknown) {
      input.onError?.(error);
    } finally {
      running = false;
    }
    return true;
  };

  const timer = setInterval(() => {
    void runNow();
  }, intervalMs);
  timer.unref?.();

  return {
    runNow,
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}
