import {
  VirtualClock,
  type ConversationScope,
  type TranscriptEvent,
} from '@consuelo/conversation';
import type { CardId, Scenario } from './fixtures';
import { observeScenario, type Observation, type Outcome } from './observer';
import { fixtureScope, segment } from './transcript';

/** Adapter must use a real production session; stub implementations are only scheduler tests. */
export interface ReplaySession {
  ingest(event: TranscriptEvent): Promise<unknown>;
  flush(): Promise<void>;
  dispose(): void;
  diagnostics?(): { requests: number };
}
export interface ReplayResult {
  readonly scenarioId: string;
  readonly outcome: Outcome;
  readonly ingestWallMs: number;
  readonly settleWallMs: number;
  readonly firstCueWallMs: number | null;
  readonly selectorRequests: number | null;
}

export async function runTextReplay(input: {
  readonly cases: readonly Scenario[];
  readonly concurrency: number;
  readonly seed: number;
  readonly create: (
    scope: ConversationScope,
    emit: (cardId: CardId | null) => void,
    clock: VirtualClock,
  ) => ReplaySession;
}): Promise<readonly ReplayResult[]> {
  if (
    !Number.isSafeInteger(input.concurrency) ||
    input.concurrency < 1 ||
    input.concurrency > 20 ||
    !Number.isSafeInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffffffff ||
    new Set(input.cases.map((item) => item.id)).size !== input.cases.length
  )
    throw new Error('invalid replay configuration');
  const order = input.cases.map((_, index) => index);
  let random = (input.seed || 0x9e3779b9) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    const j = (random >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const results: ReplayResult[] = new Array(order.length);
  let next = 0;
  let failure: unknown;
  let failed = false;
  async function worker() {
    while (!failed && next < order.length) {
      const index = order[next++]!;
      const scenario = input.cases[index]!;
      const scope = fixtureScope(index + 1);
      const clock = new VirtualClock(1000);
      const observations: Observation[] = [];
      let session: ReplaySession | undefined;
      let start: number | undefined;
      let firstCueWallMs: number | null = null;
      try {
        session = input.create(
          scope,
          (cardId) => {
            if (start === undefined) throw new Error('cue before replay start');
            observations.push({ atMs: clock.nowMs() - 1000, cardId });
            if (cardId !== null && firstCueWallMs === null)
              firstCueWallMs = performance.now() - start;
          },
          clock,
        );
        start = performance.now();
        await session.ingest(segment(scope, 1, 0, { text: scenario.text }));
        const afterIngest = performance.now();
        await session.flush();
        const afterFlush = performance.now();
        results[index] = {
          scenarioId: scenario.id,
          outcome: observeScenario(scenario, observations),
          ingestWallMs: afterIngest - start,
          settleWallMs: afterFlush - start,
          firstCueWallMs,
          selectorRequests: session.diagnostics?.().requests ?? null,
        };
      } catch (error: unknown) {
        if (!failed) failure = error;
        failed = true;
      } finally {
        try {
          session?.dispose();
        } catch (error: unknown) {
          if (!failed) failure = error;
          failed = true;
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(input.concurrency, order.length) }, worker),
  );
  if (failed) throw failure;
  return results;
}
