import { estimateBernoulliWilson } from './binomial-estimate';

describe('estimateBernoulliWilson', () => {
  it('matches the 95% Wilson score interval for a known Bernoulli sample', () => {
    const estimate = estimateBernoulliWilson(5, 10);

    expect(estimate).not.toBeNull();
    expect(estimate?.probability).toBeCloseTo(0.5, 12);
    expect(estimate?.lowerBound).toBeCloseTo(0.2365930905, 9);
    expect(estimate?.upperBound).toBeCloseTo(0.7634069095, 9);
  });

  it('keeps the estimate ordered and bounded at the Bernoulli boundaries', () => {
    for (const [successes, trials] of [
      [0, 10],
      [10, 10],
      [1, 1],
    ] as const) {
      const estimate = estimateBernoulliWilson(successes, trials);

      expect(estimate).not.toBeNull();
      expect(estimate!.lowerBound).toBeGreaterThanOrEqual(0);
      expect(estimate!.lowerBound).toBeLessThanOrEqual(estimate!.probability);
      expect(estimate!.probability).toBeLessThanOrEqual(estimate!.upperBound);
      expect(estimate!.upperBound).toBeLessThanOrEqual(1);
    }
  });

  it('shrinks uncertainty as equally-proportioned evidence accumulates', () => {
    const small = estimateBernoulliWilson(5, 10)!;
    const large = estimateBernoulliWilson(50, 100)!;

    expect(large.upperBound - large.lowerBound).toBeLessThan(
      small.upperBound - small.lowerBound,
    );
  });

  it('returns no estimate for zero trials and rejects invalid counts', () => {
    expect(estimateBernoulliWilson(0, 0)).toBeNull();
    expect(() => estimateBernoulliWilson(2, 1)).toThrow();
    expect(() => estimateBernoulliWilson(-1, 2)).toThrow();
    expect(() => estimateBernoulliWilson(0.5, 2)).toThrow();
  });
});
