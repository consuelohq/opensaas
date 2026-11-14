import { describe, expect, it } from 'bun:test';
import { scenarios } from './fixtures';
import { createProductionReplaySession } from './production';
import { runTextReplay } from './runner';

describe('contextual replay mechanics with synthetic mock only', () => {
  it('runs integrated sessions with a four-slot selector queue and actual wall observations', async () => {
    let active = 0,
      peak = 0,
      calls = 0;
    const selector = {
      sourceVersion: 'fixture-v1',
      select: async () => {
        active++;
        calls++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        return { cardId: null, slotIds: [], evidence: [] };
      },
    };
    const results = await runTextReplay({
      cases: scenarios.slice(0, 20),
      concurrency: 20,
      seed: 17,
      captureWallOutcomes: true,
      create: createProductionReplaySession('context-provider', selector),
    });
    expect(results).toHaveLength(20);
    expect(calls).toBe(20);
    expect(peak).toBeLessThanOrEqual(4);
    expect(
      results.every(
        (r) => r.selectorRequests === 1 && r.wallOutcome && r.selectorMetrics,
      ),
    ).toBe(true);
  });
  it('observes unchanged-card promotion to a visible approved cue', async () => {
    const base = scenarios.find(
      (c) => c.family === 'existing-coverage' && c.acceptableCardIds.length,
    )!;
    const item = { ...base, text: 'A topic with no authored matching phrase' };
    const selector = {
      sourceVersion: 'fixture-v1',
      select: async ({
        cards,
        turns,
      }: import('../coaching/context-selector').ClosedSetSelectorInput) => {
        const card = cards.find((c) => c.cardId === 'existing-coverage')!,
          turn = turns.at(-1)!;
        return {
          cardId: card.cardId,
          slotIds: card.slotIds,
          evidence: [{ segmentId: turn.id, segmentRevision: turn.revision }],
        };
      },
    };
    const [result] = await runTextReplay({
      cases: [item],
      concurrency: 1,
      seed: 17,
      captureWallOutcomes: true,
      create: (scope, emit, clock) => {
        const session = createProductionReplaySession(
          'context-provider',
          selector,
        )(scope, emit, clock) as import('./runner').ReplaySession & {
          control(action: 'auto'): void;
        };
        return {
          ingest: async (event) => {
            session.control('auto');
            return session.ingest(event);
          },
          flush: () => session.flush(),
          dispose: () => session.dispose(),
          diagnostics: () => session.diagnostics!(),
        };
      },
    });
    expect(result?.wallOutcome?.verdict).toBe('hit');
    expect(result?.selectorMetrics?.checkpoints).toBe(1);
  });
  it('counts a wrong visible rule cue before a later correct mock selection', async () => {
    const item = { ...scenarios[0]!, text: 'beneficiary' };
    const selector = {
      sourceVersion: 'fixture-v1',
      select: async ({
        cards,
        turns,
      }: import('../coaching/context-selector').ClosedSetSelectorInput) => {
        await new Promise((resolve) => setTimeout(resolve, 1550));
        const card = cards.find((c) => c.cardId === 'affordability')!,
          turn = turns.at(-1)!;
        return {
          cardId: card.cardId,
          slotIds: card.slotIds,
          evidence: [{ segmentId: turn.id, segmentRevision: turn.revision }],
        };
      },
    };
    const [result] = await runTextReplay({
      cases: [item],
      concurrency: 1,
      seed: 17,
      captureWallOutcomes: true,
      create: createProductionReplaySession('context-provider', selector),
    });
    expect(result?.wallOutcome?.verdict).toBe('hit');
    expect(result?.wallOutcome?.wrongVisible).toBe(1);
    expect(result?.wallOutcome?.correctVisible).toBe(1);
  }, 5000);
});
