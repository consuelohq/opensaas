import { describe, expect, it } from 'bun:test';
import { scenarios } from './fixtures';
import { independentScenarios } from './independent';
import {
  observeScenario,
  serializeReport,
  summarizeOutcomes,
} from './observer';

describe('synthetic replay observer', () => {
  it('keeps separately authored holdouts, negatives and the six life insurance families', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(60);
    expect(new Set(scenarios.map((item) => item.id)).size).toBe(
      scenarios.length,
    );
    expect(new Set(scenarios.map((item) => item.family)).size).toBe(6);
    expect(
      scenarios.filter(
        (item) =>
          item.partition === 'holdout' && !item.acceptableCardIds.length,
      ).length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      scenarios.every((item) => item.windowMs[0] <= item.windowMs[1]),
    ).toBe(true);
  });

  it('detects an injected wrong card and a no-cue interruption', () => {
    const positive = scenarios.find((item) => item.acceptableCardIds.length)!;
    const negative = scenarios.find((item) => !item.acceptableCardIds.length)!;
    expect(
      observeScenario(positive, [{ atMs: 10, cardId: 'beneficiaries' }])
        .verdict,
    ).toBe('wrong-card');
    expect(
      observeScenario(negative, [{ atMs: 10, cardId: 'beneficiaries' }])
        .verdict,
    ).toBe('false-interrupt');
    expect(
      observeScenario(positive, [
        { atMs: 10, cardId: positive.acceptableCardIds[0]! },
      ]).verdict,
    ).toBe('hit');
    expect(observeScenario(positive, []).verdict).toBe('miss');
  });

  it('does not count late cards as hits, and counts transition churn', () => {
    const item = scenarios[0]!;
    const result = observeScenario(item, [
      { atMs: 10, cardId: 'beneficiaries' },
      { atMs: 20, cardId: item.acceptableCardIds[0]! },
      { atMs: 6000, cardId: 'beneficiaries' },
    ]);
    expect(result.verdict).toBe('hit');
    expect(result.wrongVisible).toBe(2);
    expect(result.correctVisible).toBe(1);
    expect(result.churn).toBe(2);
    expect(
      observeScenario(item, [
        { atMs: 6000, cardId: item.acceptableCardIds[0]! },
      ]).verdict,
    ).toBe('miss');
    expect(() =>
      observeScenario(item, [
        { atMs: 10, cardId: null },
        { atMs: 9, cardId: 'beneficiaries' },
      ]),
    ).toThrow();
  });

  it('rejects uncontrolled identifiers, extra fields and raw transcript in artifacts', () => {
    const report = {
      schemaVersion: 1 as const,
      seed: 17,
      outcomes: [observeScenario(scenarios[0]!, [])],
    };
    expect(JSON.parse(serializeReport(report)).outcomes[0].scenarioId).toBe(
      'S001',
    );
    expect(() => serializeReport({ ...report, seed: -1 })).toThrow();
    expect(() =>
      serializeReport({
        ...report,
        outcomes: [{ ...report.outcomes[0]!, scenarioId: 'raw customer text' }],
      }),
    ).toThrow();
    expect(() =>
      serializeReport({
        ...report,
        outcomes: [{ ...report.outcomes[0]!, scenarioId: 'S999' }],
      }),
    ).toThrow();
    expect(() =>
      serializeReport({
        ...report,
        outcomes: [report.outcomes[0]!, report.outcomes[0]!],
      }),
    ).toThrow();
    expect(() =>
      serializeReport({
        ...report,
        transcript: 'raw customer text',
      } as typeof report),
    ).toThrow();
    expect(serializeReport(report)).not.toContain(scenarios[0]!.text);
    const independent = {
      ...report,
      outcomes: [observeScenario(independentScenarios[0]!, [])],
    };
    expect(
      JSON.parse(serializeReport(independent)).outcomes[0].scenarioId,
    ).toBe('H001');
    expect(serializeReport(independent)).not.toContain(
      independentScenarios[0]!.text,
    );
    expect(() =>
      serializeReport({
        ...independent,
        outcomes: [{ ...independent.outcomes[0]!, scenarioId: 'H037' }],
      }),
    ).toThrow();
  });

  it('reports scenario denominators and never substitutes zero for an absent measurement', () => {
    const positive = scenarios[0]!;
    const negative = scenarios.find((item) => !item.acceptableCardIds.length)!;
    const results = [
      observeScenario(positive, [
        { atMs: 4, cardId: positive.acceptableCardIds[0]! },
      ]),
      observeScenario(negative, [{ atMs: 5, cardId: 'beneficiaries' }]),
      observeScenario(positive, []),
    ];
    expect(summarizeOutcomes(results)).toMatchObject({
      scenarios: 3,
      hits: 1,
      misses: 1,
      falseInterrupts: 1,
      recall: 0.5,
      cuePrecision: 0.5,
      correctAbstentions: 0,
      firstCueOffsetMs: { count: 2, p50: 4, p95: 5, p99: 5 },
    });
    expect(summarizeOutcomes([])).toMatchObject({
      recall: null,
      cuePrecision: null,
      firstCueOffsetMs: { count: 0, p50: null, p95: null, p99: null },
    });
  });
});
