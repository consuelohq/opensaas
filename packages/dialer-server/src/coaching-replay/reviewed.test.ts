import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import baseline from './rejected-phrase-baseline.json';
import { scenarios } from './fixtures';
import { independentScenarios } from './independent';
import { observeScenario } from './observer';
import { assessReplay, qualityFailures, QUALITY_TARGETS } from './quality';

describe('frozen replay and offline quality gate', () => {
  it('preserves independently frozen labels and rejects the recorded phrase-only hypothesis', () => {
    const bytes = readFileSync(
      new URL('./independent-cases.json', import.meta.url),
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'f9636b98b4512d102bb46013d8e4f7567f32b6090c0fb5d798184614cf58fde6',
    );
    expect(independentScenarios).toHaveLength(36);
    expect(
      independentScenarios.filter((item) => item.acceptableCardIds.length),
    ).toHaveLength(24);
    expect(
      independentScenarios.every(
        (item) => item.windowMs[0] === 0 && item.windowMs[1] === 5000,
      ),
    ).toBe(true);
    expect(QUALITY_TARGETS).toEqual({
      fixedHits: 45,
      independentHits: 18,
      negatives: 12,
    });
    expect(qualityFailures(baseline.fixed, baseline.independent)).toEqual([
      'fixed:hits',
      'independent:hits',
    ]);
  });
  it('detects a planted wrong cue, false interruption, late cue and misses even after a correct cue', () => {
    const cases = [...scenarios, ...independentScenarios];
    const allHits = cases.map((c) =>
      observeScenario(
        c,
        c.acceptableCardIds.length
          ? [{ atMs: 1, cardId: c.acceptableCardIds[0]! }]
          : [],
      ),
    );
    expect(assessReplay(allHits).failures).toEqual([]);
    const fixedPositive = scenarios[0]!,
      fixedNegative = scenarios.find((c) => !c.acceptableCardIds.length)!;
    const wrong = observeScenario(fixedPositive, [
      { atMs: 1, cardId: 'beneficiaries' },
      { atMs: 2, cardId: fixedPositive.acceptableCardIds[0]! },
    ]);
    expect(wrong.verdict).toBe('hit');
    expect(wrong.wrongVisible).toBe(1);
    const altered = allHits.map((o) =>
      o.scenarioId === fixedPositive.id
        ? wrong
        : o.scenarioId === fixedNegative.id
          ? observeScenario(fixedNegative, [
              { atMs: 1, cardId: 'affordability' },
            ])
          : o,
    );
    expect(assessReplay(altered).failures).toContain('fixed:wrong-visible');
    expect(assessReplay(altered).failures).toContain('fixed:negatives');
    const late = observeScenario(fixedPositive, [
      { atMs: 6000, cardId: fixedPositive.acceptableCardIds[0]! },
    ]);
    expect(late.verdict).toBe('miss');
    expect(late.lateVisible).toBe(1);
    const withLate = allHits.map((o) =>
      o.scenarioId === fixedPositive.id ? late : o,
    );
    expect(assessReplay(withLate).failures).toContain('fixed:late-visible');
    const misses = allHits.map((o, i) =>
      i < 20 ? observeScenario(cases[i]!, []) : o,
    );
    expect(assessReplay(misses).failures).toContain('fixed:hits');
    expect(() => assessReplay(allHits.slice(1))).toThrow();
  });
});
