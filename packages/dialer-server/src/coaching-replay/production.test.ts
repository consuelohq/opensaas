import { describe, expect, it } from 'bun:test';
import { scenarios } from './fixtures';
import { runTextReplay } from './runner';
import { createProductionReplaySession } from './production';

describe('production Script session text replay', () => {
  it('observes an applied source-linked rule decision and no cue for negated text', async () => {
    const base = scenarios.find(
      (item) =>
        item.family === 'existing-coverage' && item.acceptableCardIds.length,
    )!;
    const cases = [
      { ...base, id: 'S013', text: 'I have existing coverage' },
      {
        ...base,
        id: 'S023',
        text: 'I do not have existing coverage',
        acceptableCardIds: [],
      },
    ];
    const result = await runTextReplay({
      cases,
      concurrency: 1,
      seed: 17,
      create: createProductionReplaySession('rules'),
    });
    expect(result.map((item) => item.outcome.verdict)).toEqual([
      'hit',
      'correct-abstention',
    ]);
    expect(result[0]?.firstCueWallMs).not.toBeNull();
    expect(result[0]?.selectorRequests).toBe(0);
  });

  it('runs every frozen case through real isolated sessions at 1, 5 and 20 call scopes', async () => {
    for (const concurrency of [1, 5, 20] as const) {
      const results = await runTextReplay({
        cases: scenarios,
        concurrency,
        seed: 17,
        create: createProductionReplaySession('rules'),
      });
      expect(results).toHaveLength(scenarios.length);
      expect(results.every((result) => result.selectorRequests === 0)).toBe(
        true,
      );
    }
  });

  it('runs a local closed-set mock selector through the real session without provider calls', async () => {
    const base = scenarios.find(
      (item) =>
        item.family === 'existing-coverage' && item.acceptableCardIds.length,
    )!;
    const results = await runTextReplay({
      cases: [{ ...base, text: 'I have existing coverage' }],
      concurrency: 1,
      seed: 17,
      create: createProductionReplaySession('mock-selector'),
    });
    expect(results[0]?.selectorRequests).toBe(1);
    expect(results[0]?.outcome.verdict).toBe('hit');
  });
});
