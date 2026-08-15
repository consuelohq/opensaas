import { describe, expect, test } from 'vitest';

import { startTaskWorktreeGcScheduler } from '../scripts/lib/task-worktree-gc-scheduler';

describe('task worktree GC scheduler', () => {
  test('never overlaps runs and stops future execution', async () => {
    let runCount = 0;
    let resolveRun: (() => void) | null = null;
    const scheduler = startTaskWorktreeGcScheduler({
      intervalMs: 60_000,
      run: () => {
        runCount += 1;
        return new Promise<void>((resolve) => {
          resolveRun = resolve;
        });
      },
    });

    const firstRun = scheduler.runNow();
    expect(runCount).toBe(1);
    await expect(scheduler.runNow()).resolves.toBe(false);
    expect(runCount).toBe(1);

    resolveRun?.();
    await expect(firstRun).resolves.toBe(true);

    scheduler.stop();
    await expect(scheduler.runNow()).resolves.toBe(false);
    expect(runCount).toBe(1);
  });

  test('reports failures without permanently wedging the scheduler', async () => {
    const errors: string[] = [];
    let attempt = 0;
    const scheduler = startTaskWorktreeGcScheduler({
      intervalMs: 60_000,
      run: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('gc failed');
      },
      onError(error) {
        errors.push(error instanceof Error ? error.message : String(error));
      },
    });

    await expect(scheduler.runNow()).resolves.toBe(true);
    await expect(scheduler.runNow()).resolves.toBe(true);
    expect(attempt).toBe(2);
    expect(errors).toEqual(['gc failed']);
    scheduler.stop();
  });
});
