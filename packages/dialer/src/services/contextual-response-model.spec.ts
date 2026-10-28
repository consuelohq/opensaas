import type { PredictiveDecisionContext } from '../types';
import {
  ContextualResponseModel,
  contextualResponseGradient,
  contextualResponseObjective,
  encodePredictiveContext,
  scoreContextualCandidateEconomics,
} from './contextual-response-model';

const context = (
  overrides: Partial<PredictiveDecisionContext> = {},
): PredictiveDecisionContext => ({
  schemaVersion: 2,
  capturedAt: '2026-08-15T12:00:00.000Z',
  timezone: 'America/New_York',
  timezoneSource: 'workspace_fallback',
  localHour: 12,
  localDayOfWeek: 6,
  attemptsUsed: 0,
  attemptsToday: 0,
  attemptsThisWeek: 0,
  minutesSinceLastAttempt: null,
  localPresenceRequested: true,
  source: {
    pipelineId: 'pipeline-1',
    stageId: 'stage-1',
    opportunityStatus: 'open',
    opportunityValue: 500,
  },
  d3: {
    nextAttemptNumber: 1,
    answerProbability: 0.5,
    answerProbabilityUpperBound: 0.7,
    score: 49,
    hazardSource: 'exact_local_slot',
    suppressed: false,
  },
  ...overrides,
});

describe('ContextualResponseModel', () => {
  it('learns a regularized contextual response signal without changing the D3 policy contract', () => {
    const examples = Array.from({ length: 240 }, (_, index) => {
      const highResponseContext = index < 120;
      const withinGroup = index % 120;
      const responded = highResponseContext
        ? withinGroup % 5 !== 0
        : withinGroup % 5 === 0;
      return {
        context: context({
          localHour: highResponseContext ? 11 : 3,
          localDayOfWeek: withinGroup % 7,
          attemptsUsed: withinGroup % 3,
          attemptsToday: withinGroup % 2,
          minutesSinceLastAttempt: withinGroup === 0 ? null : 90,
        }),
        responded,
      };
    });

    const model = ContextualResponseModel.fit(examples, {
      l2Penalty: 1,
      learningRate: 0.15,
      iterations: 500,
    });

    const high = model.predictProbability(context({ localHour: 11 }));
    const low = model.predictProbability(context({ localHour: 3 }));

    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(0.5);
    expect(low).toBeLessThan(0.5);
    expect(Number.isFinite(high)).toBe(true);
    expect(Number.isFinite(low)).toBe(true);
  });

  it('keeps candidate-specific opportunity economics separate from response probability', () => {
    expect(
      scoreContextualCandidateEconomics({
        responseProbability: 0.5,
        opportunityValue: 1_000,
        closeRate: 0.2,
        costPerAttempt: 2,
      }),
    ).toEqual({
      responseProbability: 0.5,
      valuePerConnection: 200,
      expectedValue: 100,
      costPerAttempt: 2,
      expectedNetValue: 98,
    });
  });

  it('matches the penalized Bernoulli objective gradient by finite differences', () => {
    const examples = [
      { context: context({ localHour: 11 }), responded: true },
      { context: context({ localHour: 3 }), responded: false },
      { context: context({ localHour: 8 }), responded: true },
    ];
    const featureCount = encodePredictiveContext(examples[0]!.context).length;
    const weights = Array.from({ length: featureCount }, (_, index) =>
      index === 0 ? -0.2 : (index % 3 - 1) * 0.03,
    );
    const lambda = 0.7;
    const analytic = contextualResponseGradient(weights, examples, lambda);
    const epsilon = 1e-6;
    const numeric = weights.map((_, index) => {
      const plus = [...weights];
      const minus = [...weights];
      plus[index]! += epsilon;
      minus[index]! -= epsilon;
      return (
        contextualResponseObjective(plus, examples, lambda) -
        contextualResponseObjective(minus, examples, lambda)
      ) / (2 * epsilon);
    });

    analytic.forEach((value, index) =>
      expect(value).toBeCloseTo(numeric[index]!, 5),
    );
  });

  it('keeps regularization strength stable when the empirical sample is replicated', () => {
    const sample = Array.from({ length: 40 }, (_, index) => ({
      context: context({ localHour: index % 2 === 0 ? 11 : 3 }),
      responded: index % 4 !== 1,
    }));
    const replicated = Array.from({ length: 20 }, () => sample).flat();
    const options = { l2Penalty: 0.5, iterations: 800, learningRate: 0.08 };
    const small = ContextualResponseModel.fit(sample, options);
    const large = ContextualResponseModel.fit(replicated, options);

    for (const probe of [context({ localHour: 3 }), context({ localHour: 11 })]) {
      expect(large.predictProbability(probe)).toBeCloseTo(
        small.predictProbability(probe),
        3,
      );
    }
  });

  it('does not regularize the intercept and keeps extreme encoded values finite', () => {
    const examples = [
      { context: context({ localHour: 11 }), responded: true },
      { context: context({ localHour: 3 }), responded: false },
    ];
    const featureCount = encodePredictiveContext(examples[0]!.context).length;
    const weights = Array.from({ length: featureCount }, () => 0.25);
    const noPenalty = contextualResponseGradient(weights, examples, 0);
    const heavyPenalty = contextualResponseGradient(weights, examples, 100);

    expect(heavyPenalty[0]).toBeCloseTo(noPenalty[0]!, 12);
    expect(heavyPenalty[1]).not.toBeCloseTo(noPenalty[1]!, 5);

    const extreme = context({
      source: {
        opportunityValue: 1e300,
        opportunityStatus: 'open',
      },
    });
    expect(encodePredictiveContext(extreme).every(Number.isFinite)).toBe(true);
  });

  it('encodes missing spacing differently from a real zero-minute spacing', () => {
    expect(
      encodePredictiveContext(context({ minutesSinceLastAttempt: null })),
    ).not.toEqual(
      encodePredictiveContext(context({ minutesSinceLastAttempt: 0 })),
    );
  });
});
