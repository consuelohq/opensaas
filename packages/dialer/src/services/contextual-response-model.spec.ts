import type { PredictiveDecisionContext } from '../types';
import {
  ContextualResponseModel,
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
});
