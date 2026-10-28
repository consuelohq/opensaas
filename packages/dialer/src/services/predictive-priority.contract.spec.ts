import { PredictivePriorityService } from './predictive-priority.service';

describe('scientific predictive priority contract', () => {
  const service = new PredictivePriorityService();

  it('scores optimistic expected net value from a calibrated upper probability bound', () => {
    const result = service.computePriority({
      answerProbability: 0.2,
      answerProbabilityUpperBound: 0.5,
      valuePerConnection: 100,
      costPerAttempt: 2,
    });

    expect(result.score).toBeCloseTo(48, 12);
    expect(result.components).toEqual({
      expectedReward: 20,
      optimisticReward: 50,
      uncertaintyBonus: 30,
      cost: 2,
    });
  });

  it('increases with uncertainty-supported upside and decreases with attempt cost', () => {
    const baseline = service.computePriority({
      answerProbability: 0.2,
      answerProbabilityUpperBound: 0.3,
      valuePerConnection: 100,
      costPerAttempt: 2,
    });
    const moreUpside = service.computePriority({
      answerProbability: 0.2,
      answerProbabilityUpperBound: 0.5,
      valuePerConnection: 100,
      costPerAttempt: 2,
    });
    const moreCost = service.computePriority({
      answerProbability: 0.2,
      answerProbabilityUpperBound: 0.3,
      valuePerConnection: 100,
      costPerAttempt: 10,
    });

    expect(moreUpside.score).toBeGreaterThan(baseline.score);
    expect(moreCost.score).toBeLessThan(baseline.score);
  });

  it('falls back to the point estimate when no interval evidence exists', () => {
    const result = service.computePriority({
      answerProbability: 0.2,
      valuePerConnection: 100,
      costPerAttempt: 2,
    });

    expect(result.score).toBeCloseTo(18, 12);
    expect(result.components.uncertaintyBonus).toBe(0);
  });
});
