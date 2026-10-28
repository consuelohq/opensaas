type ProbabilisticPrediction = {
  probability: number;
  responded: boolean;
};

type ModelComparisonPrediction = {
  responded: boolean;
  controlProbability: number;
  challengerProbability: number;
};

const LOG_EPSILON = 1e-15;
const PSI_EPSILON = 1e-6;

const validateProbability = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('probability must be finite and in [0, 1]');
  }
  return value;
};

const mean = (values: readonly number[]): number => {
  if (values.length === 0) throw new RangeError('cannot average an empty sample');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stableDecimal = (value: number): number => Number(value.toFixed(12));

export const evaluateProbabilisticPredictions = (
  predictions: readonly ProbabilisticPrediction[],
) => {
  if (predictions.length === 0) {
    throw new RangeError('probabilistic evaluation requires predictions');
  }
  const brierTerms: number[] = [];
  const logTerms: number[] = [];
  for (const prediction of predictions) {
    const rawProbability = validateProbability(prediction.probability);
    const target = prediction.responded ? 1 : 0;
    brierTerms.push((rawProbability - target) ** 2);
    const boundedProbability = Math.min(
      Math.max(rawProbability, LOG_EPSILON),
      1 - LOG_EPSILON,
    );
    logTerms.push(
      -(
        target * Math.log(boundedProbability) +
        (1 - target) * Math.log(1 - boundedProbability)
      ),
    );
  }
  return {
    sampleSize: predictions.length,
    brierScore: mean(brierTerms),
    logLoss: mean(logTerms),
  };
};

export const buildCalibrationBins = (
  predictions: readonly ProbabilisticPrediction[],
  binCount = 10,
) => {
  if (!Number.isInteger(binCount) || binCount < 1) {
    throw new RangeError('binCount must be a positive integer');
  }
  if (predictions.length === 0) return [];

  const buckets = Array.from({ length: binCount }, () => [] as ProbabilisticPrediction[]);
  for (const prediction of predictions) {
    const probability = validateProbability(prediction.probability);
    const index = Math.min(Math.floor(probability * binCount), binCount - 1);
    buckets[index]!.push(prediction);
  }

  return buckets.flatMap((bucket, index) => {
    if (bucket.length === 0) return [];
    const lowerBound = index / binCount;
    const upperBound = (index + 1) / binCount;
    return [
      {
        lowerBound,
        upperBound,
        count: bucket.length,
        meanPrediction: stableDecimal(
          mean(bucket.map((item) => item.probability)),
        ),
        observedRate: stableDecimal(
          mean(bucket.map((item) => (item.responded ? 1 : 0))),
        ),
      },
    ];
  });
};

export const splitTemporalEvaluationExamples = <
  T extends { evaluatedAt: string | Date },
>(examples: readonly T[], trainingFraction = 0.8) => {
  if (!Number.isFinite(trainingFraction) || trainingFraction <= 0 || trainingFraction >= 1) {
    throw new RangeError('trainingFraction must be between 0 and 1');
  }
  if (examples.length < 2) {
    throw new RangeError('temporal evaluation requires at least two observations');
  }
  const ordered = [...examples].sort((left, right) => {
    const leftTime = new Date(left.evaluatedAt).getTime();
    const rightTime = new Date(right.evaluatedAt).getTime();
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
      throw new RangeError('evaluatedAt values must be valid dates');
    }
    return leftTime - rightTime;
  });
  const trainingSize = Math.min(
    Math.max(Math.floor(ordered.length * trainingFraction), 1),
    ordered.length - 1,
  );
  return {
    training: ordered.slice(0, trainingSize),
    holdout: ordered.slice(trainingSize),
  };
};

export const compareProbabilisticModels = (
  predictions: readonly ModelComparisonPrediction[],
) => {
  const control = evaluateProbabilisticPredictions(
    predictions.map((item) => ({
      probability: item.controlProbability,
      responded: item.responded,
    })),
  );
  const challenger = evaluateProbabilisticPredictions(
    predictions.map((item) => ({
      probability: item.challengerProbability,
      responded: item.responded,
    })),
  );
  return {
    control,
    challenger,
    brierImprovement: control.brierScore - challenger.brierScore,
    logLossImprovement: control.logLoss - challenger.logLoss,
  };
};

const binCounts = (values: readonly number[], edges: readonly number[]): number[] => {
  if (edges.length < 2) throw new RangeError('PSI requires at least two bin edges');
  for (let index = 1; index < edges.length; index += 1) {
    if (!(edges[index]! > edges[index - 1]!)) {
      throw new RangeError('PSI bin edges must be strictly increasing');
    }
  }
  const counts = Array.from({ length: edges.length - 1 }, () => 0);
  for (const value of values) {
    if (!Number.isFinite(value)) throw new RangeError('PSI values must be finite');
    let assigned = false;
    for (let index = 0; index < edges.length - 1; index += 1) {
      const lower = edges[index]!;
      const upper = edges[index + 1]!;
      const last = index === edges.length - 2;
      if (value >= lower && (value < upper || (last && value <= upper))) {
        counts[index] += 1;
        assigned = true;
        break;
      }
    }
    if (!assigned) throw new RangeError('PSI value falls outside supplied bin edges');
  }
  return counts;
};

export const populationStabilityIndex = (
  reference: readonly number[],
  comparison: readonly number[],
  edges: readonly number[],
): number => {
  if (reference.length === 0 || comparison.length === 0) {
    throw new RangeError('PSI requires non-empty reference and comparison samples');
  }
  const referenceCounts = binCounts(reference, edges);
  const comparisonCounts = binCounts(comparison, edges);
  const binCount = referenceCounts.length;
  const referenceDenominator = reference.length + PSI_EPSILON * binCount;
  const comparisonDenominator = comparison.length + PSI_EPSILON * binCount;
  return referenceCounts.reduce((sum, count, index) => {
    const referenceShare = (count + PSI_EPSILON) / referenceDenominator;
    const comparisonShare =
      (comparisonCounts[index]! + PSI_EPSILON) / comparisonDenominator;
    return (
      sum +
      (comparisonShare - referenceShare) *
        Math.log(comparisonShare / referenceShare)
    );
  }, 0);
};
