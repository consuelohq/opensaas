import { describe, expect, it } from 'bun:test';
import { scenarios } from './fixtures';
import { runTextReplay } from './runner';

describe('replay scheduler (stub port only)', () => {
  it('runs all cases with bounded concurrency, stable order and cleanup', async () => {
    let active = 0;
    let peak = 0;
    let disposed = 0;
    const calls: string[] = [];
    const factory: Parameters<typeof runTextReplay>[0]['create'] = (scope) => {
      active++;
      peak = Math.max(peak, active);
      calls.push(scope.callSessionId);
      return {
        ingest: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
        },
        flush: async () => {},
        dispose: () => {
          active--;
          disposed++;
        },
      };
    };
    const selected = scenarios.slice(0, 12);
    const result = await runTextReplay({
      cases: selected,
      concurrency: 5,
      seed: 19,
      create: factory,
    });
    expect(result.map((item) => item.scenarioId)).toEqual(
      selected.map((item) => item.id),
    );
    expect(new Set(calls).size).toBe(12);
    expect(peak).toBe(5);
    expect(disposed).toBe(12);
    expect(active).toBe(0);
    const firstOrder = [...calls];
    calls.length = 0;
    await runTextReplay({
      cases: selected,
      concurrency: 5,
      seed: 19,
      create: factory,
    });
    expect(calls).toEqual(firstOrder);
  });

  it('disposes a failed session and surfaces the original failure', async () => {
    let disposed = 0;
    await expect(
      runTextReplay({
        cases: scenarios.slice(0, 1),
        concurrency: 1,
        seed: 0,
        create: () => ({
          ingest: async () => {
            throw new Error('fixture failure');
          },
          flush: async () => {},
          dispose: () => {
            disposed++;
          },
        }),
      }),
    ).rejects.toThrow('fixture failure');
    expect(disposed).toBe(1);
  });

  it('waits for already-started sessions even when another factory throws', async () => {
    let created = 0;
    let disposed = 0;
    await expect(
      runTextReplay({
        cases: scenarios.slice(0, 3),
        concurrency: 3,
        seed: 1,
        create: () => {
          if (++created === 2) throw new Error('factory failure');
          return {
            ingest: async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
            },
            flush: async () => {},
            dispose: () => {
              disposed++;
            },
          };
        },
      }),
    ).rejects.toThrow('factory failure');
    expect(disposed).toBe(1);
  });

  it('scores a delayed cue against wall time without changing the virtual observation', async () => {
    // Narrow test-only window makes the timing distinction observable quickly.
    const item = { ...scenarios[0]!, windowMs: [0, 1] as const };
    const [result] = await runTextReplay({
      cases: [item],
      concurrency: 1,
      seed: 0,
      captureWallOutcomes: true,
      create: (_scope, emit) => ({
        ingest: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          emit(item.acceptableCardIds[0]!);
        },
        flush: async () => {},
        dispose: () => {},
      }),
    });
    expect(result?.outcome.verdict).toBe('hit');
    expect(result?.wallOutcome?.verdict).toBe('miss');
    expect(result?.wallOutcome?.lateVisible).toBe(1);
    expect(result?.selectorMetrics?.discards).toBeNull();
  });

  it('measures cue callback wall time separately from virtual offsets', async () => {
    const item = scenarios[0]!;
    const [result] = await runTextReplay({
      cases: [item],
      concurrency: 1,
      seed: 0,
      create: (_scope, emit, clock) => ({
        ingest: async () => {
          clock.advanceTo(1030);
          emit(item.acceptableCardIds[0]!);
        },
        flush: async () => {},
        dispose: () => {},
      }),
    });
    expect(result?.outcome.firstCueMs).toBe(30);
    expect(result?.firstCueWallMs).toBeGreaterThanOrEqual(0);
    expect(result?.settleWallMs).toBeGreaterThanOrEqual(
      result!.firstCueWallMs!,
    );
  });
});
