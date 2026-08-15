import type { PredictiveDecisionContext } from '../types';
import {
  DiscreteTimeResponseHazardModel,
  expandDiscreteTimeObservation,
} from './discrete-time-response-hazard';

const context = (localHour: number): PredictiveDecisionContext => ({
  schemaVersion: 2,
  capturedAt: '2026-08-15T12:00:00.000Z',
  timezone: 'UTC',
  timezoneSource: 'workspace_fallback',
  localHour,
  localDayOfWeek: 6,
  attemptsUsed: 0,
  attemptsToday: 0,
  attemptsThisWeek: 0,
  minutesSinceLastAttempt: null,
  localPresenceRequested: true,
  source: { opportunityValue: 500, opportunityStatus: 'open' },
  d3: {
    nextAttemptNumber: 1,
    answerProbability: 0.5,
    answerProbabilityUpperBound: 0.7,
    score: 69,
    hazardSource: 'exact_local_slot',
    suppressed: false,
  },
});

describe('discrete-time response hazard science', () => {
  it('does not convert a partially observed censor interval into a non-response label', () => {
    expect(
      expandDiscreteTimeObservation(
        {
          durationMs: 6_000,
          eventObserved: false,
          outcomeClass: 'censored',
          censorReason: 'competing_winner',
        },
        { intervalMs: 5_000, horizonMs: 20_000 },
      ),
    ).toEqual([{ intervalIndex: 0, eventObserved: false }]);
  });

  it('places a response in its event interval after preserving prior at-risk intervals', () => {
    expect(
      expandDiscreteTimeObservation(
        {
          durationMs: 7_000,
          eventObserved: true,
          outcomeClass: 'response',
          censorReason: null,
        },
        { intervalMs: 5_000, horizonMs: 20_000 },
      ),
    ).toEqual([
      { intervalIndex: 0, eventObserved: false },
      { intervalIndex: 1, eventObserved: true },
    ]);
  });

  it('learns cumulative response-by-horizon differences from contextual event-time evidence', () => {
    const examples = Array.from({ length: 240 }, (_, index) => {
      const highResponseContext = index < 120;
      return {
        context: context(highResponseContext ? 11 : 3),
        observation: highResponseContext
          ? {
              durationMs: 2_000 + (index % 3) * 5_000,
              eventObserved: true,
              outcomeClass: 'response' as const,
              censorReason: null,
            }
          : {
              durationMs: 20_000,
              eventObserved: false,
              outcomeClass: 'non_response' as const,
              censorReason: null,
            },
      };
    });

    const model = DiscreteTimeResponseHazardModel.fit(examples, {
      intervalMs: 5_000,
      horizonMs: 20_000,
      l2Penalty: 1,
      learningRate: 0.15,
      iterations: 500,
    });

    const high = model.predictResponseByHorizonProbability(context(11));
    const low = model.predictResponseByHorizonProbability(context(3));

    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(0.7);
    expect(low).toBeLessThan(0.3);
    expect(model.predictIntervalHazards(context(11))).toHaveLength(4);
  });
});
