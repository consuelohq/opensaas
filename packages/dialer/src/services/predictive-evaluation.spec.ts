import {
  buildCalibrationBins,
  compareProbabilisticModels,
  evaluateProbabilisticPredictions,
  populationStabilityIndex,
  splitTemporalEvaluationExamples,
} from './predictive-evaluation';

describe('predictive evaluation science', () => {
  it('reports proper probabilistic scores rather than accuracy alone', () => {
    const metrics = evaluateProbabilisticPredictions([
      { probability: 0.8, responded: true },
      { probability: 0.2, responded: false },
    ]);

    expect(metrics.brierScore).toBeCloseTo(0.04, 10);
    expect(metrics.logLoss).toBeCloseTo(-Math.log(0.8), 10);
    expect(metrics.sampleSize).toBe(2);
  });

  it('summarizes empirical calibration without treating a ranking score as a probability', () => {
    const bins = buildCalibrationBins(
      [
        { probability: 0.1, responded: false },
        { probability: 0.2, responded: false },
        { probability: 0.8, responded: true },
        { probability: 0.9, responded: true },
      ],
      2,
    );

    expect(bins).toEqual([
      {
        lowerBound: 0,
        upperBound: 0.5,
        count: 2,
        meanPrediction: 0.15,
        observedRate: 0,
      },
      {
        lowerBound: 0.5,
        upperBound: 1,
        count: 2,
        meanPrediction: 0.85,
        observedRate: 1,
      },
    ]);
  });

  it('uses chronological holdout ordering and compares D4 against the D3 control', () => {
    const examples = [
      { evaluatedAt: '2026-08-15T12:03:00.000Z', responded: true },
      { evaluatedAt: '2026-08-15T12:01:00.000Z', responded: false },
      { evaluatedAt: '2026-08-15T12:04:00.000Z', responded: true },
      { evaluatedAt: '2026-08-15T12:02:00.000Z', responded: false },
    ];
    const split = splitTemporalEvaluationExamples(examples, 0.5);

    expect(split.training.map((item) => item.evaluatedAt)).toEqual([
      '2026-08-15T12:01:00.000Z',
      '2026-08-15T12:02:00.000Z',
    ]);
    expect(split.holdout.map((item) => item.evaluatedAt)).toEqual([
      '2026-08-15T12:03:00.000Z',
      '2026-08-15T12:04:00.000Z',
    ]);

    const comparison = compareProbabilisticModels([
      {
        responded: false,
        controlProbability: 0.7,
        challengerProbability: 0.2,
      },
      {
        responded: true,
        controlProbability: 0.3,
        challengerProbability: 0.8,
      },
    ]);
    expect(comparison.challenger.brierScore).toBeLessThan(
      comparison.control.brierScore,
    );
    expect(comparison.brierImprovement).toBeGreaterThan(0);
    expect(comparison.logLossImprovement).toBeGreaterThan(0);
  });

  it('detects material distribution drift in predicted probabilities', () => {
    const drift = populationStabilityIndex(
      [0.08, 0.1, 0.12, 0.15, 0.18, 0.2],
      [0.75, 0.8, 0.82, 0.85, 0.88, 0.9],
      [0, 0.25, 0.5, 0.75, 1],
    );

    expect(drift).toBeGreaterThan(1);
  });

  it('keeps population-stability smoothing normalized and symmetric with empty bins', () => {
    const forward = populationStabilityIndex(
      [0.01, 0.02, 0.03],
      [0.91, 0.92, 0.93],
      [0, 0.5, 1],
    );
    const reverse = populationStabilityIndex(
      [0.91, 0.92, 0.93],
      [0.01, 0.02, 0.03],
      [0, 0.5, 1],
    );
    expect(Number.isFinite(forward)).toBe(true);
    expect(forward).toBeCloseTo(reverse, 12);
  });
});
